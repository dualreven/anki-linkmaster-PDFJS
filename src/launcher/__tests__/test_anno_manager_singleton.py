from __future__ import annotations

from dataclasses import dataclass, field

import pytest


@dataclass
class _DummyPorts:
    url_port: int = 5173
    msgCenter_port: int = 8765
    pdfFile_port: int = 9000
    vite_port: int | None = None


@dataclass
class _DummyPaths:
    data_dir: str = "data"
    db_path: str = "db.sqlite3"
    static_dir: str | None = None
    pdfs_dir: str | None = None
    logs_dir: str | None = None


@dataclass
class _DummyOptions:
    frontend_prod: bool = False
    keep_backend: bool = True
    runtime_mode: str = "single"
    ankiaddon_root_path: str | None = None


@dataclass
class _DummyCfg:
    ports: _DummyPorts = field(default_factory=_DummyPorts)
    paths: _DummyPaths = field(default_factory=_DummyPaths)
    options: _DummyOptions = field(default_factory=_DummyOptions)


class _DummyWindow:
    def __init__(self) -> None:
        self.activated = 0

    def show(self) -> None:
        self.activated += 1

    def raise_(self) -> None:
        return None

    def activateWindow(self) -> None:
        return None

    def objectName(self) -> str:
        return "dummy"


class _DummyAnnoManagerApp:
    created = 0

    def __init__(self, *_args, **_kwargs) -> None:
        type(self).created += 1
        self.window = _DummyWindow()

    def run(self) -> int:
        return 0


def test_ensure_anno_manager_hosted_is_singleton(monkeypatch: pytest.MonkeyPatch) -> None:
    from src.launcher import runner

    reg = runner.get_registry()
    reg.discard_anno_manager()
    _DummyAnnoManagerApp.created = 0

    monkeypatch.setattr(runner, "_load_launcher_class", lambda *_a, **_k: _DummyAnnoManagerApp)
    monkeypatch.setattr(runner, "_is_qobject_alive", lambda _obj: True)

    cfg = _DummyCfg()

    rc1 = runner.ensure_anno_manager_hosted(cfg, parent_app=object())
    assert rc1 == 0
    assert _DummyAnnoManagerApp.created == 1

    rc2 = runner.ensure_anno_manager_hosted(cfg, parent_app=object())
    assert rc2 == 0
    assert _DummyAnnoManagerApp.created == 1

