#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import types
import importlib.util
import sys

from src.launcher.config import LauncherConfig, LauncherPorts, LauncherPaths, LauncherOptions
from src.launcher import runner


class _StubWindow:
    def __init__(self) -> None:
        self.activated = 0

    def show(self) -> None:
        self.activated += 1

    def raise_(self) -> None:  # noqa: A003
        self.activated += 1

    def activateWindow(self) -> None:  # noqa: N802
        self.activated += 1


class _StubApp:
    def __init__(self, *_a, **_k) -> None:
        self.window = _StubWindow()

    def run(self) -> int:
        return 0


class _StubWindowLifecycle:
    def __init__(self) -> None:
        self._entries = {}
        self.register_calls = 0

    def get_entry(self, client_id: str):
        return dict(self._entries.get(client_id)) if client_id in self._entries else None

    def register_window(self, client_id: str, app, window, meta=None) -> None:
        self.register_calls += 1
        if client_id in self._entries:
            raise RuntimeError("duplicate register")
        self._entries[client_id] = {"app": app, "window": window, "meta": dict(meta or {})}

    def on_window_closed(self, window) -> None:
        for cid, entry in list(self._entries.items()):
            if entry.get("window") is window:
                self._entries.pop(cid, None)


def test_ensure_new_card_scheduler_hosted_singleton_second_call_activates(monkeypatch):
    cfg = LauncherConfig(
        ports=LauncherPorts(msgCenter_port=1, pdfFile_port=2, url_port=3, vite_port=None),
        paths=LauncherPaths(logs_dir="logs"),
        options=LauncherOptions(frontend_prod=False, keep_backend=True),
    )

    # 让 runner 不依赖真实 Qt / sip
    monkeypatch.setattr(runner, "_is_qobject_alive", lambda _w: True)

    # 注入一个假的 LaunchConfig 模块，避免导入真实前端依赖
    fake_launch_config_mod = types.ModuleType("src.frontend.common.launch_config")

    class _FakeLaunchConfig:  # minimal
        def __init__(self, **_kwargs) -> None:
            pass

    fake_launch_config_mod.LaunchConfig = _FakeLaunchConfig  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "src.frontend.common.launch_config", fake_launch_config_mod)

    # 劫持 importlib loader，把 tool-windows launcher 替换为 Stub module
    orig_spec_from_file_location = importlib.util.spec_from_file_location

    lifecycle = _StubWindowLifecycle()

    created = {"count": 0}

    def _counting_ctor(*a, **k):
        created["count"] += 1
        return _StubApp(*a, **k)

    # 让 loader 使用计数构造器
    def _fake_spec_from_file_location2(name, location, *args, **kwargs):
        spec = orig_spec_from_file_location(name, location, *args, **kwargs)
        assert spec is not None

        class _Loader:
            def create_module(self, _spec):  # pragma: no cover
                return None

            def exec_module(self, module):
                module.NewCardSchedulerApp = _counting_ctor  # type: ignore[attr-defined]

        spec.loader = _Loader()  # type: ignore[assignment]
        return spec

    monkeypatch.setattr(importlib.util, "spec_from_file_location", _fake_spec_from_file_location2)

    rc1 = runner.ensure_new_card_scheduler_hosted(cfg, parent_app=None, window_lifecycle=lifecycle)
    assert rc1 == 0
    assert created["count"] == 1
    assert lifecycle.register_calls == 1

    rc2 = runner.ensure_new_card_scheduler_hosted(cfg, parent_app=None, window_lifecycle=lifecycle)
    assert rc2 == 0
    assert created["count"] == 1
    assert lifecycle.register_calls == 1
