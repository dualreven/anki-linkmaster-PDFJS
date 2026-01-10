#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher 的 Annotation Bulk-Get 自检按钮（F）
要求：
- 请求必须包含 to="backend"
- payload.data.ann_ids 解析正确
- 失败 ACK 能被解析并打印 ACK_META（至少包含 code 与 error_code）
"""
from __future__ import annotations

import json
import sys
import types
import importlib.util as _il
from pathlib import Path


def _install_pyqt_stubs() -> None:
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
            return None

    class QTimer:
        def __init__(self, *args, **kwargs):
            self.timeout = _Signal()

        def setSingleShot(self, _v: bool):
            return None

        def start(self, _ms: int):
            self.timeout.emit()

        def stop(self):
            return None

    class QEventLoop:
        def __init__(self, *a, **k):
            pass

        def exec(self):
            return 0

        def quit(self):
            return None

    class QFileSystemWatcher:
        def __init__(self, *args, **kwargs):
            self._files = []

        def addPath(self, p: str):
            self._files.append(p)

        def files(self):
            return list(self._files)

    class Qt:
        class AlignmentFlag:
            AlignCenter = 0

    class QUrl:
        def __init__(self, *_a, **_k):
            self._s = ""

        def toString(self):
            return self._s

    QtCore.QThread = QThread
    QtCore.pyqtSignal = _Signal
    QtCore.QTimer = QTimer
    QtCore.QEventLoop = QEventLoop
    QtCore.QFileSystemWatcher = QFileSystemWatcher
    QtCore.Qt = Qt
    QtCore.QUrl = QUrl

    QtWidgets = types.ModuleType("PyQt6.QtWidgets")

    class QMainWindow:
        def __init__(self, *a, **k):
            pass

        def setWindowTitle(self, *a, **k):
            return None

        def setGeometry(self, *a, **k):
            return None

        def setMinimumSize(self, *a, **k):
            return None

        def setCentralWidget(self, *a, **k):
            return None

        def show(self):
            return None

    class _QMessageBox:
        @staticmethod
        def critical(*_a, **_k):
            return None

        @staticmethod
        def warning(*_a, **_k):
            return None

        @staticmethod
        def information(*_a, **_k):
            return None

    QtWidgets.QMainWindow = QMainWindow
    QtWidgets.QMessageBox = _QMessageBox
    for name in [
        "QApplication",
        "QWidget",
        "QVBoxLayout",
        "QHBoxLayout",
        "QLabel",
        "QPushButton",
        "QSpinBox",
        "QCheckBox",
        "QLineEdit",
        "QFormLayout",
        "QGroupBox",
    ]:
        setattr(QtWidgets, name, type(name, (), {}))

    QtGui = types.ModuleType("PyQt6.QtGui")
    QtGui.QFont = type("QFont", (), {})
    QtGui.QTextCursor = type("QTextCursor", (), {})

    QtWebSockets = types.ModuleType("PyQt6.QtWebSockets")

    class QWebSocket:
        def __init__(self, *a, **k):
            pass

        def sendTextMessage(self, *a, **k):
            return None

        def close(self):
            return None

        # 信号占位（测试不会真正触发连接）
        connected = _Signal()
        textMessageReceived = _Signal()
        errorOccurred = _Signal()
        disconnected = _Signal()

        def open(self, *_a, **_k):
            return None

    QtWebSockets.QWebSocket = QWebSocket

    PyQt6 = types.ModuleType("PyQt6")
    sys.modules["PyQt6"] = PyQt6
    sys.modules["PyQt6.QtCore"] = QtCore
    sys.modules["PyQt6.QtWidgets"] = QtWidgets
    sys.modules["PyQt6.QtGui"] = QtGui
    sys.modules["PyQt6.QtWebSockets"] = QtWebSockets


def _load_gui_launcher_as(name: str):
    spec = _il.spec_from_file_location(name, str(Path("gui_launcher.py").resolve()))
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load gui_launcher.py spec")
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _install_standard_message_handler_stub() -> None:
    std_mod = types.ModuleType("src.backend.msgCenter_server.standard_protocol")

    class _SMH:
        _i = 0

        @staticmethod
        def generate_request_id() -> str:
            _SMH._i += 1
            return f"rid_test_{_SMH._i}"

        @staticmethod
        def serialize_message(msg) -> str:
            return json.dumps(msg, ensure_ascii=False)

    std_mod.StandardMessageHandler = _SMH
    sys.modules["src.backend.msgCenter_server.standard_protocol"] = std_mod


def test_annotation_bulk_get_selftest_builds_message_and_logs_ack(monkeypatch):
    _install_pyqt_stubs()
    _install_standard_message_handler_stub()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_annotation_bulk_get_selftest")

    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_runtime_ports", lambda self: {"msgCenter_port": 8765}, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_is_port_listening", lambda self, host, port, timeout=0.6: True, raising=False)

    sent = {}

    ack_text = json.dumps(
        {
            "type": "annotation:bulk-get:failed",
            "request_id": "rid_ack",
            "timestamp": 0,
            "code": 400,
            "status": "error",
            "message": "invalid request",
            "error_code": "INVALID_REQUEST",
        },
        ensure_ascii=False,
    )

    def fake_send_ws(self, port, text, timeout_ms=2000, *, expect_types=(), correlation_id=None):
        sent["port"] = port
        sent["text"] = text
        sent["timeout_ms"] = timeout_ms
        sent["expect_types"] = tuple(expect_types)
        sent["correlation_id"] = correlation_id
        return ack_text

    monkeypatch.setattr(mod.GUILauncher, "_send_ws_text_qt", fake_send_ws, raising=False)

    g = mod.GUILauncher()
    g.msgCenter_port_input = types.SimpleNamespace(value=lambda: 8765)
    g.annotation_bulk_get_ann_ids_input = types.SimpleNamespace(text=lambda: "ann_1, ann_2")
    logs = []
    g._log = lambda m: logs.append(str(m))

    g._annotation_bulk_get_selftest()

    msg = json.loads(sent["text"])
    assert msg["type"] == "annotation:bulk-get:requested"
    assert msg["to"] == "backend"
    assert msg["data"]["ann_ids"] == ["ann_1", "ann_2"]

    joined = "\n".join(logs)
    assert "[ACK_META]" in joined
    assert "code=400" in joined
    assert "error_code=INVALID_REQUEST" in joined

