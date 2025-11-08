#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher 的更多启动模式
- 后端 CLI 通路（LauncherThread）
- PDF-Viewer CLI 通路（LauncherThread）
- PDF-Viewer Hosted 通路（GUILauncher._start_pdf_viewer_hosted）
"""
from __future__ import annotations

import sys
import types
from pathlib import Path


def _install_pyqt_stubs():
    # QtCore
    QtCore = types.ModuleType("PyQt6.QtCore")

    class _Signal:
        def __init__(self, *args, **kwargs):
            self._subs = []

        def connect(self, slot):
            self._subs.append(slot)

        def emit(self, *a, **k):
            for s in list(self._subs):
                try:
                    s(*a, **k)
                except Exception:
                    pass

    class QThread:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            try:
                self.run()
            except Exception:
                pass

        def run(self):
            pass

    class QTimer:
        def __init__(self, *args, **kwargs):
            self._single = False
            self._active = False
            self.timeout = _Signal()

        def setSingleShot(self, v: bool):
            self._single = bool(v)

        def isActive(self):
            return self._active

        def stop(self):
            self._active = False

        def start(self, _ms: int):
            self._active = False
            # 不实际计时，直接触发
            self.timeout.emit()

    class QFileSystemWatcher:
        def __init__(self, *args, **kwargs):
            self._files = []
            self.fileChanged = _Signal()
            self.directoryChanged = _Signal()

        def addPath(self, p: str):
            self._files.append(p)

        def files(self):
            return list(self._files)

    class Qt:
        class AlignmentFlag:
            AlignCenter = 0

    QtCore.QThread = QThread
    QtCore.pyqtSignal = _Signal
    QtCore.QTimer = QTimer
    QtCore.QFileSystemWatcher = QFileSystemWatcher
    QtCore.Qt = Qt

    # QtWidgets（只占位）
    QtWidgets = types.ModuleType("PyQt6.QtWidgets")
    class QMainWindow:
        def __init__(self, *a, **k): pass
        def setWindowTitle(self, *a, **k): pass
        def setGeometry(self, *a, **k): pass
        def setMinimumSize(self, *a, **k): pass
        def setCentralWidget(self, *a, **k): pass
        def findChild(self, *a, **k): return None
        def show(self): pass
    setattr(QtWidgets, "QMainWindow", QMainWindow)
    for name in [
        "QWidget","QTabWidget","QLabel","QVBoxLayout","QHBoxLayout","QGroupBox",
        "QPushButton","QLineEdit","QTextEdit","QComboBox","QCheckBox","QSpinBox","QDoubleSpinBox",
        "QScrollArea","QMessageBox","QRadioButton","QButtonGroup","QSizePolicy"
    ]:
        setattr(QtWidgets, name, type(name, (), {}) )
    class QApplication:
        @staticmethod
        def instance():
            return object()
    QtWidgets.QApplication = QApplication

    # QtGui（占位）
    QtGui = types.ModuleType("PyQt6.QtGui")
    QtGui.QFont = type("QFont", (), {})
    QtGui.QTextCursor = type("QTextCursor", (), {})

    # 根包注册
    PyQt6 = types.ModuleType("PyQt6")
    sys.modules['PyQt6'] = PyQt6
    sys.modules['PyQt6.QtCore'] = QtCore
    sys.modules['PyQt6.QtWidgets'] = QtWidgets
    sys.modules['PyQt6.QtGui'] = QtGui


def _load_gui_launcher_as(name: str):
    import importlib.util as _il
    spec = _il.spec_from_file_location(name, str(Path("gui_launcher.py").resolve()))
    assert spec and spec.loader
    mod = _il.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    return mod


def test_backend_cli_path_via_thread(tmp_path):
    _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_backend_cli")

    called = {}
    def fake_start_backend_cli(cfg, *, on_log=None):
        called["cfg"] = cfg
        if on_log: on_log("[FAKE] start_backend_cli called")
        return True
    setattr(mod._gl_services, "start_backend_cli", fake_start_backend_cli)

    params = {
        "logs_dir": str(tmp_path / "logs"),
        "data_dir": str(tmp_path / "data"),
        "db_path": str(tmp_path / "data" / "db.sqlite"),
        "static_dir": str(tmp_path / "static"),
        "pdfs_dir": str(tmp_path / "pdfs"),
        "msgCenter_port": 8765,
        "pdfFile_port": 8080,
        "runtime_mode": "single",
    }
    t = mod.LauncherThread("backend", params)
    t.run()
    assert "cfg" in called, "start_backend_cli 未被调用"
    assert int(called["cfg"].ports.msgCenter_port) == 8765
    assert str(called["cfg"].paths.logs_dir).endswith("logs")


def test_pdf_viewer_cli_path_via_thread(tmp_path):
    _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_viewer_cli")

    called = {}
    def fake_start_pdf_viewer_cli(cfg, *, is_prod: bool, pdf_id=None, page_at=None, position=None,
                                  anchor_id=None, annotation_id=None, outline_item_id=None, on_log=None):
        called["cfg"] = cfg
        called["is_prod"] = is_prod
        called["pdf_id"] = pdf_id
        called["page_at"] = page_at
        called["position"] = position
        called["anchor_id"] = anchor_id
        called["annotation_id"] = annotation_id
        called["outline_item_id"] = outline_item_id
        if on_log: on_log("[FAKE] start_pdf_viewer_cli called")
        return True
    setattr(mod._gl_services, "start_pdf_viewer_cli", fake_start_pdf_viewer_cli)

    params = {
        "logs_dir": str(tmp_path / "logs"),
        "data_dir": str(tmp_path / "data"),
        "db_path": str(tmp_path / "data" / "db.sqlite"),
        "static_dir": str(tmp_path / "static"),
        "pdfs_dir": str(tmp_path / "pdfs"),
        "vite_port": 5173,
        "msgCenter_port": 8765,
        "pdfFile_port": 8080,
        "runtime_mode": "single",
        "is_prod": True,
        "pdf_id": "doc-123",
        "page_at": 3,
        "position": 12.5,
        "anchor_id": "anc-1",
        "annotation_id": "ann-2",
        "outline_item_id": "out-3",
    }
    t = mod.LauncherThread("pdf-viewer", params)
    t.run()
    assert "cfg" in called and called["is_prod"] is True
    assert called["pdf_id"] == "doc-123"
    assert called["page_at"] == 3 and called["position"] == 12.5
    assert called["outline_item_id"] == "out-3"


def test_pdf_viewer_hosted_path_via_ui(tmp_path, monkeypatch):
    _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_viewer_hosted")

    # 跳过 UI 构建、状态刷新与监听绑定
    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)
    # 简化路径解析与端口读取
    monkeypatch.setattr(mod.GUILauncher, "_resolved_paths_from_ui", lambda self: {
        "data_dir": str(tmp_path / "data"),
        "db_path": str(tmp_path / "data" / "db.sqlite"),
        "static_dir": str(tmp_path / "static"),
        "pdfs_dir": str(tmp_path / "pdfs"),
        "logs_dir": str(tmp_path / "logs"),
    }, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_runtime_ports", lambda self: {
        "vite_port": 5173,
        "msgCenter_port": 8765,
        "pdfFile_port": 8080,
    }, raising=False)

    # 伪造 controller，避免真实 ensure_vite_dev 调用
    class _DummyCtl:
        def ensure_vite_dev(self, *_a, **_k): return (None, 5173)
        def init_status_watchers(self, **_k): pass
    monkeypatch.setattr(mod, "Controller", lambda *a, **k: _DummyCtl(), raising=False)
    # 伪造 importlib.util.spec_from_file_location，避免真实加载前端 launcher
    import importlib.util as _il
    class _DummyLoader:
        def create_module(self, spec):
            import types as _types
            return _types.ModuleType(spec.name if hasattr(spec, "name") else "pdf_viewer_launcher")
        def exec_module(self, module): return None
    _orig_spec_fn = _il.spec_from_file_location
    def _fake_spec_from_file_location(name, location):
        spec = _orig_spec_fn(name, location)
        if spec is not None: spec.loader = _DummyLoader()
        return spec
    monkeypatch.setattr(_il, "spec_from_file_location", _fake_spec_from_file_location, raising=True)

    # 捕获 start_pdf_viewer_hosted 调用
    called = {}
    def fake_start_pdf_viewer_hosted(cfg, *, parent_app, pdf_id=None, page_at=None, position=None,
                                     anchor_id=None, annotation_id=None, outline_item_id=None, enable_outline=None, on_log=None):
        called["cfg"] = cfg
        called["pdf_id"] = pdf_id
        called["page_at"] = page_at
        called["position"] = position
        called["outline_item_id"] = outline_item_id
        called["enable_outline"] = enable_outline
        if on_log: on_log("[FAKE] start_pdf_viewer_hosted called")
        return 0
    monkeypatch.setattr(mod._gl_services, "start_pdf_viewer_hosted", fake_start_pdf_viewer_hosted, raising=True)

    # 实例化并补齐必要 UI 属性
    g = mod.GUILauncher()
    g._logs_dir = tmp_path / "logs"
    g.frontend_prod_checkbox = types.SimpleNamespace(isChecked=lambda: True)
    g.vite_port_input = types.SimpleNamespace(value=lambda: 5173)
    g.msgCenter_port_input = types.SimpleNamespace(value=lambda: 8765)
    g.pdfFile_port_input = types.SimpleNamespace(value=lambda: 8080)
    g.ankiaddon_root_input = types.SimpleNamespace(text=lambda: "")
    # viewer 相关输入
    g.viewer_pdf_id_input = types.SimpleNamespace(text=lambda: "doc-999")
    g.viewer_page_input = types.SimpleNamespace(value=lambda: 5)
    g.viewer_position_input = types.SimpleNamespace(value=lambda: 66.6)
    g.viewer_anchor_id_input = types.SimpleNamespace(text=lambda: "")
    g.viewer_annotation_id_input = types.SimpleNamespace(text=lambda: "")
    g.viewer_outline_item_id_input = types.SimpleNamespace(text=lambda: "out-9")
    g.viewer_enable_outline_checkbox = types.SimpleNamespace(isChecked=lambda: True)
    g.runtime_mode_select = types.SimpleNamespace(currentText=lambda: "single")
    # Hosted Tab 所需字段桩
    g.h_pdf_id = types.SimpleNamespace(text=lambda: "doc-999")
    g.h_page_at = types.SimpleNamespace(value=lambda: 5)
    g.h_position = types.SimpleNamespace(value=lambda: 66.6)
    g.h_id_type = types.SimpleNamespace(currentData=lambda: None)
    g.h_id_value = types.SimpleNamespace(text=lambda: "")

    logs = []
    g._log = lambda m: logs.append(m)
    g._start_pdf_viewer_hosted()
    if "cfg" not in called:
        filtered = [l for l in logs if ("[ERROR]" in l or "[TRACE" in l or "pdf-viewer" in l)]
        raise AssertionError("start_pdf_viewer_hosted 未触发; logs=" + "\n".join(filtered))
    assert "cfg" in called
    assert called["pdf_id"] == "doc-999"
    assert called["page_at"] == 5 and abs(called["position"] - 66.6) < 1e-6
    # Hosted 分支默认不强制 outline，outline_item_id 仅在选择 outline 类型且提供值时设置
    assert called["enable_outline"] in (False, None)
