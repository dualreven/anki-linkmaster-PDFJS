#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: backend mutual-exclusive navigation (URL vs WS)
- New instance (no existing viewer) → URL params are used
- Existing instance alive → URL params suppressed, WS navigate is used

This test uses stubs to avoid launching Qt/WS. It validates the decision logic only.
"""
from __future__ import annotations

import sys
import types
from dataclasses import dataclass
from typing import Optional, Any, Dict

# Ensure project root on path
from pathlib import Path
# __smoke__ → pdf-viewer → pdf-viewer → frontend → src → <ROOT>
ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# ---- stub modules required by _on_msgcenter_message path ----
mod_cfg = types.ModuleType("src.launcher.config")

@dataclass
class LauncherPorts:
    msgCenter_port: Optional[int] = None
    pdfFile_port: Optional[int] = None
    vite_port: Optional[int] = None

@dataclass
class LauncherPaths:
    data_dir: Optional[str] = None
    db_path: Optional[str] = None
    static_dir: Optional[str] = None
    pdfs_dir: Optional[str] = None
    logs_dir: Optional[str] = None

@dataclass
class LauncherOptions:
    runtime_mode: Optional[str] = None
    ankiaddon_root_path: Optional[str] = None
    keep_backend: bool = True
    frontend_prod: bool = True
    vite_port: Optional[int] = None

@dataclass
class LauncherConfig:
    ports: LauncherPorts
    paths: LauncherPaths
    options: LauncherOptions

mod_cfg.LauncherPorts = LauncherPorts
mod_cfg.LauncherPaths = LauncherPaths
mod_cfg.LauncherOptions = LauncherOptions
mod_cfg.LauncherConfig = LauncherConfig
sys.modules["src.launcher.config"] = mod_cfg

calls = {"ensure": [], "navigate": []}

def ensure_pdf_viewer_hosted(cfg: LauncherConfig, *, parent_app, pdf_id: Optional[str] = None,
                             page_at: Optional[int] = None, position: Optional[float] = None,
                             anchor_id: Optional[str] = None, annotation_id: Optional[str] = None,
                             outline_item_id: Optional[str] = None, enable_outline: Optional[bool] = None,
                             on_log=None) -> int:
    calls["ensure"].append({
        "pdf_id": pdf_id, "page_at": page_at, "position": position,
        "anchor_id": anchor_id, "annotation_id": annotation_id, "outline_item_id": outline_item_id
    })
    return 0

mod_runner = types.ModuleType("src.launcher.runner")
mod_runner.ensure_pdf_viewer_hosted = ensure_pdf_viewer_hosted
mod_runner.ensure_pdf_home_hosted = lambda *a, **k: 0
sys.modules["src.launcher.runner"] = mod_runner

def navigate_viewer(_server, rid, nav_req: Dict[str, Any]):
    calls["navigate"].append(nav_req)
    return {"status": "ok"}

pkg_handlers = types.ModuleType("src.backend.msgCenter_server.handlers")
pkg_pdf_viewer = types.ModuleType("src.backend.msgCenter_server.handlers.pdf_viewer")
mod_viewer = types.ModuleType("src.backend.msgCenter_server.handlers.pdf_viewer.viewer")
mod_viewer.navigate_viewer = navigate_viewer
sys.modules["src.backend.msgCenter_server.handlers"] = pkg_handlers
sys.modules["src.backend.msgCenter_server.handlers.pdf_viewer"] = pkg_pdf_viewer
sys.modules["src.backend.msgCenter_server.handlers.pdf_viewer.viewer"] = mod_viewer

from src.backend.launcher_core.session_registry import get_registry  # noqa
from src.backend.launcher_core.pyqt_launcher import BackendLauncher  # noqa

class DummyWin:
    def objectName(self):
        return "dummy"

class DummyApp:
    def __init__(self, alive: bool):
        self.window = DummyWin() if alive else None

class DummyWSServer:
    def __init__(self):
        self._server = object()
        self.port = 8765

class DummyHTTPServer:
    def __init__(self):
        self.port = 8080

def reset_env():
    reg = get_registry()
    try:
        for k in list(reg._viewer_by_pdf.keys()):  # type: ignore[attr-defined]
            reg.discard_viewer(k)
    except Exception:
        pass
    calls["ensure"].clear()
    calls["navigate"].clear()

def make_launcher() -> BackendLauncher:
    inst = BackendLauncher(parent_app=None, show_ui=False, data_dir=".", db_path=".", static_dir=".", pdfs_dir=".", logs_dir=str(ROOT / "AItemp"))
    inst.ws_server = DummyWSServer()
    inst.http_server = DummyHTTPServer()
    return inst

def case_new_instance_uses_url_only():
    reset_env()
    launcher = make_launcher()
    msg = {"type": "pdf-library:viewer:requested", "data": {"pdf_id": "c83c60c58ad2", "outline_item_id": "outlineItem-XYZ"}}
    launcher._on_msgcenter_message(client=None, message=msg)
    assert len(calls["ensure"]) == 1
    ec = calls["ensure"][0]
    # For new instance: URL params are passed; WS navigate is not used
    assert ec["outline_item_id"] == "outlineItem-XYZ"
    assert len(calls["navigate"]) == 0

def case_existing_instance_uses_ws_only():
    reset_env()
    reg = get_registry()
    reg.set_viewer("c83c60c58ad2", DummyApp(alive=True))
    launcher = make_launcher()
    msg = {"type": "pdf-library:viewer:requested", "data": {"pdf_id": "c83c60c58ad2", "outline_item_id": "outlineItem-XYZ"}}
    launcher._on_msgcenter_message(client=None, message=msg)
    assert len(calls["ensure"]) == 1
    ec = calls["ensure"][0]
    # For existing instance: URL params are suppressed; WS navigate is used
    assert ec["outline_item_id"] is None
    assert len(calls["navigate"]) == 1
    nav = calls["navigate"][0]
    assert nav["to"]["pdf_uuid"] == "c83c60c58ad2"
    assert nav["target"]["type"] == "outline"
    assert nav["target"]["outline_item_id"] == "outlineItem-XYZ"

if __name__ == "__main__":
    case_new_instance_uses_url_only()
    case_existing_instance_uses_ws_only()
    print("OK mutual-exclusive navigation")
