#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：从 gui_launcher 启动 pdf-home 的通路（CLI 与 Hosted）是否通畅。

策略：
- 通过注入 PyQt6 的最小桩模块，避免真实 GUI 依赖；
- 对 services.start_pdf_home_{cli,hosted} 打桩，验证被调用且参数齐全；
- 对 GUILauncher 进行轻量实例化（跳过 UI 构建与文件监听），并补齐所需属性。
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

    # QtWidgets（仅占位，避免 __init__ 期间调用失败）
    QtWidgets = types.ModuleType("PyQt6.QtWidgets")

    class QMainWindow:
        def __init__(self):
            pass

        def setWindowTitle(self, *_):
            pass

        def setGeometry(self, *_):
            pass

        def setMinimumSize(self, *_):
            pass

        def setCentralWidget(self, *_):
            pass

        def findChild(self, *_):
            return None

    class QWidget:
        pass

    class QTabWidget:
        pass

    class QLabel:
        def __init__(self, *_):
            pass

        def setStyleSheet(self, *_):
            pass

        def setTextInteractionFlags(self, *_):
            pass

        def setFont(self, *_):
            pass

        def setAlignment(self, *_):
            pass

    # 其他控件占位
    for name in [
        "QVBoxLayout", "QHBoxLayout", "QGroupBox", "QPushButton",
        "QLineEdit", "QTextEdit", "QComboBox", "QCheckBox",
        "QSpinBox", "QDoubleSpinBox", "QScrollArea", "QMessageBox",
        "QRadioButton", "QButtonGroup", "QSizePolicy"
    ]:
        setattr(QtWidgets, name, type(name, (), {}) )

    class QApplication:
        @staticmethod
        def instance():
            return object()

    QtWidgets.QMainWindow = QMainWindow
    QtWidgets.QWidget = QWidget
    QtWidgets.QTabWidget = QTabWidget
    QtWidgets.QLabel = QLabel
    QtWidgets.QApplication = QApplication

    # QtGui（占位）
    QtGui = types.ModuleType("PyQt6.QtGui")
    QtGui.QFont = type("QFont", (), {}) 
    QtGui.QTextCursor = type("QTextCursor", (), {}) 

    # 根包
    PyQt6 = types.ModuleType("PyQt6")
    sys.modules['PyQt6'] = PyQt6
    sys.modules['PyQt6.QtCore'] = QtCore
    sys.modules['PyQt6.QtWidgets'] = QtWidgets
    sys.modules['PyQt6.QtGui'] = QtGui


def test_cli_path_start_pdf_home(tmp_path: Path, monkeypatch):
    _install_pyqt_stubs()
    import importlib.util as _il
    name = "gui_launcher_mod_for_test_cli"
    spec = _il.spec_from_file_location(name, str(Path("gui_launcher.py").resolve()))
    assert spec and spec.loader
    mod = _il.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]

    called = {}

    def fake_start_pdf_home_cli(cfg, *, is_prod: bool, on_log=None):
        called["cfg"] = cfg
        called["is_prod"] = is_prod
        if on_log:
            on_log("[FAKE] start_pdf_home_cli called")
        return True

    monkeypatch.setattr(mod._gl_services, "start_pdf_home_cli", fake_start_pdf_home_cli, raising=True)

    # 构造线程参数（CLI 路径）
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
        "is_prod": False,
        "enable_outline": True,
    }
    t = mod.LauncherThread("pdf-home", params)
    # 直接在当前线程运行
    t.run()

    # 断言委托被调用，且关键参数存在
    assert "cfg" in called and called["is_prod"] is False
    assert str(called["cfg"].paths.logs_dir).endswith("logs")
    assert int(called["cfg"].ports.msgCenter_port) == 8765


def test_hosted_path_start_pdf_home(tmp_path: Path, monkeypatch):
    _install_pyqt_stubs()
    import importlib.util as _il
    name = "gui_launcher_mod_for_test_hosted"
    spec = _il.spec_from_file_location(name, str(Path("gui_launcher.py").resolve()))
    assert spec and spec.loader
    mod = _il.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]

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
        def ensure_vite_dev(self, *_a, **_k):
            return None, 5173
        def init_status_watchers(self, **_k):
            pass
    monkeypatch.setattr(mod, "Controller", lambda *a, **k: _DummyCtl(), raising=False)
    # 伪造 importlib.util.spec_from_file_location，避免真实加载前端 launcher
    import importlib.util as _il
    class _DummyLoader:
        def create_module(self, spec):
            import types as _types
            return _types.ModuleType(spec.name if hasattr(spec, "name") else "pdf_home_launcher")
        def exec_module(self, module):
            return None
    _orig_spec_fn = _il.spec_from_file_location
    def _fake_spec_from_file_location(name, location):
        # 基于原始 spec，替换为无副作用的 loader
        spec = _orig_spec_fn(name, location)
        if spec is not None:
            spec.loader = _DummyLoader()
        return spec
    monkeypatch.setattr(_il, "spec_from_file_location", _fake_spec_from_file_location, raising=True)

    called = {}
    def fake_start_pdf_home_hosted(cfg, *, parent_app, on_log=None):
        called["cfg"] = cfg
        if on_log:
            on_log("[FAKE] start_pdf_home_hosted called")
        return 0
    monkeypatch.setattr(mod._gl_services, "start_pdf_home_hosted", fake_start_pdf_home_hosted, raising=True)

    # 实例化并补齐必要 UI 属性（被 _start_pdf_home_hosted 读取）
    g = mod.GUILauncher()
    g._logs_dir = tmp_path / "logs"
    # 必要的 UI 属性桩
    g.runtime_mode_select = types.SimpleNamespace(currentText=lambda: "single")
    g.frontend_prod_checkbox = types.SimpleNamespace(isChecked=lambda: False)
    g.vite_port_input = types.SimpleNamespace(value=lambda: 5173)
    g.msgCenter_port_input = types.SimpleNamespace(value=lambda: 8765)
    g.pdfFile_port_input = types.SimpleNamespace(value=lambda: 8080)
    g.ankiaddon_root_input = types.SimpleNamespace(text=lambda: "")
    # 开发模式下，确保“端口监听检查”通过（避免引入真实网络依赖）
    g._is_port_listening = lambda *_a, **_k: True

    # 调用 Hosted 路径
    logs = []
    g._log = lambda m: logs.append(m)
    g._start_pdf_home_hosted()
    # 若未调用，打印日志便于诊断（断言前）
    if "cfg" not in called:
        # 降噪：仅保留 ERROR/TRACE 关键字
        filtered = [l for l in logs if ("[ERROR]" in l or "[TRACE" in l or "PDF-Home" in l)]
        raise AssertionError("start_pdf_home_hosted 未触发; logs=" + "\n".join(filtered))
    assert "cfg" in called
    assert int(called["cfg"].ports.msgCenter_port) == 8765
    assert str(called["cfg"].paths.logs_dir).endswith("logs")
