#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：Controller 与 services 的契约
"""
from __future__ import annotations

from pathlib import Path

from src.gui_launcher.controller import Controller, ControllerOptions


def test_controller_ensure_vite_delegates(tmp_path: Path) -> None:
    logs = tmp_path / "logs"
    options = ControllerOptions(component_root=tmp_path, logs_dir=logs, on_log=None)
    c = Controller(options)

    called = {"ok": False, "args": None, "kwargs": None}

    def _fake_ensure_vite(port: int, *, component_root: Path, logs_dir: Path, ai_module=None):
        called["ok"] = True
        called["args"] = (port,)
        called["kwargs"] = {"component_root": component_root, "logs_dir": logs_dir, "ai_module": ai_module}
        return 4321, int(port)

    c.attach_services(ensure_vite=_fake_ensure_vite)
    pid, used = c.ensure_vite_dev(5173, ai_module=None)
    assert called["ok"] is True
    assert pid == 4321 and used == 5173
    assert called["kwargs"]["component_root"] == tmp_path
    assert called["kwargs"]["logs_dir"] == logs


def test_gui_launcher_uses_controller_statics() -> None:
    # 纯文本静态检查，避免引入 PyQt 依赖
    root = Path(".")
    for rel in ["gui_launcher.py", "dist/latest/gui_launcher.py"]:
        p = root / rel
        text = p.read_text(encoding="utf-8")
        assert "from src.gui_launcher.controller import Controller, ControllerOptions" in text
        assert "self._controller.ensure_vite_dev" in text
        assert "self._controller.init_status_watchers" in text

