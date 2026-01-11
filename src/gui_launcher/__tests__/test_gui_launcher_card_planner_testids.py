#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher Card Planner 测试便捷入口（F）
要求（v001-spec）：
- 填充测试ID：ann_test_1,ann_test_2
- 复制样例 token：[[ann_test_1]] [[ann_test_2]]
- 一键 bulk-get：用测试ID执行 annotation:bulk-get，并在 GUI label 展示 count/contains
"""
from __future__ import annotations

import json
import sys
import types
import importlib.util as _il
from pathlib import Path


def _install_pyqt_stubs() -> dict:
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

    class QThread:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            return None

    class Qt:
        class AlignmentFlag:
            AlignCenter = 0
            AlignRight = 0
            AlignLeft = 0
            AlignTop = 0

    class QUrl:
        def __init__(self, *_a, **_k):
            self._s = ""

        def toString(self):
            return self._s

    class QFileSystemWatcher:
        def __init__(self, *args, **kwargs):
            self._files = []

        def addPath(self, p: str):
            self._files.append(p)

        def files(self):
            return list(self._files)

    QtCore.pyqtSignal = _Signal
    QtCore.QTimer = QTimer
    QtCore.QEventLoop = QEventLoop
    QtCore.QThread = QThread
    QtCore.Qt = Qt
    QtCore.QUrl = QUrl
    QtCore.QFileSystemWatcher = QFileSystemWatcher

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

    class _Clipboard:
        def __init__(self):
            self.text = ""

        def setText(self, t: str):
            self.text = str(t)

    clipboard = _Clipboard()

    class QApplication:
        @staticmethod
        def clipboard():
            return clipboard

    class QLabel:
        def __init__(self, text: str = ""):
            self._text = str(text)

        def setText(self, text: str):
            self._text = str(text)

        def text(self):
            return self._text

    class QLineEdit:
        def __init__(self):
            self._text = ""

        def setText(self, text: str):
            self._text = str(text)

        def text(self):
            return self._text

        def setPlaceholderText(self, _t: str):
            return None

    QtWidgets.QMainWindow = QMainWindow
    QtWidgets.QMessageBox = _QMessageBox
    QtWidgets.QApplication = QApplication
    QtWidgets.QLabel = QLabel
    QtWidgets.QLineEdit = QLineEdit

    for name in [
        "QWidget",
        "QVBoxLayout",
        "QHBoxLayout",
        "QPushButton",
        "QSpinBox",
        "QCheckBox",
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

    return {"clipboard": clipboard, "QLabel": QLabel, "QLineEdit": QLineEdit}


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


def _load_gui_launcher_as(name: str):
    spec = _il.spec_from_file_location(name, str(Path("gui_launcher.py").resolve()))
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load gui_launcher.py spec")
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_card_planner_fill_test_ids_sets_ann_ids_input(monkeypatch):
    stubs = _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_card_planner_testids_fill")

    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)

    g = mod.GUILauncher()
    g.annotation_bulk_get_ann_ids_input = stubs["QLineEdit"]()
    logs = []
    g._log = lambda m: logs.append(str(m))

    g._card_planner_fill_test_ids()
    assert g.annotation_bulk_get_ann_ids_input.text() == "ann_test_1,ann_test_2"
    assert any("ann_test_1,ann_test_2" in x for x in logs)


def test_card_planner_copy_sample_tokens_writes_clipboard(monkeypatch):
    stubs = _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_card_planner_testids_copy")

    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)

    g = mod.GUILauncher()
    g._log = lambda _m: None

    g._card_planner_copy_sample_tokens()
    assert stubs["clipboard"].text == "[[ann_test_1]] [[ann_test_2]]"


def test_bulk_get_selftest_with_test_ids_updates_label(monkeypatch):
    stubs = _install_pyqt_stubs()
    _install_standard_message_handler_stub()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_card_planner_testids_bulk")

    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_runtime_ports", lambda self: {"msgCenter_port": 8765}, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_is_port_listening", lambda self, host, port, timeout=0.6: True, raising=False)

    sent = {}

    ack_text = json.dumps(
        {
            "type": "annotation:bulk-get:completed",
            "request_id": "rid_ack",
            "timestamp": 0,
            "code": 200,
            "status": "ok",
            "message": "ok",
            "data": {
                "annotations": [
                    {"id": "ann_test_1", "title": "t1", "type": "note"},
                    {"id": "ann_test_2", "title": "t2", "type": "note"},
                ]
            },
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
    g.annotation_bulk_get_ann_ids_input = stubs["QLineEdit"]()
    g.annotation_bulk_get_result_label = stubs["QLabel"]("bulk-get: (未运行)")
    g._log = lambda _m: None

    g._annotation_bulk_get_selftest_with_test_ids()

    msg = json.loads(sent["text"])
    assert msg["type"] == "annotation:bulk-get:requested"
    assert msg["to"] == "backend"
    assert msg["data"]["ann_ids"] == ["ann_test_1", "ann_test_2"]
    assert "count=2" in g.annotation_bulk_get_result_label.text()
    assert "contains_test_ids=True" in g.annotation_bulk_get_result_label.text()

