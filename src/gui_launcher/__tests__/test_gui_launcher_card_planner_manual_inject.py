#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher 新增“Card Planner 测试：注入样例草稿卡”按钮对应的注入逻辑。
要求（v001-spec）：
- 点击后会通过 _send_ws_text_qt 发送两条 card-planner:ingest:requested
- payload 中包含 type/to/data.op/annotation_ids 等关键字段
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
            # 不实际计时，直接触发
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

    class Qt:
        class AlignmentFlag:
            AlignCenter = 0

    class QFileSystemWatcher:
        def __init__(self, *args, **kwargs):
            self._files = []

        def addPath(self, p: str):
            self._files.append(p)

        def files(self):
            return list(self._files)

    class QUrl:
        def __init__(self, *_a, **_k):
            self._s = ""

        def toString(self):
            return self._s

    QtCore.QTimer = QTimer
    QtCore.QEventLoop = QEventLoop
    QtCore.QUrl = QUrl
    QtCore.Qt = Qt
    QtCore.QThread = QThread
    QtCore.pyqtSignal = _Signal
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


def test_card_planner_manual_inject_sends_two_ingest_messages(monkeypatch):
    _install_pyqt_stubs()
    mod = _load_gui_launcher_as("gui_launcher_mod_test_card_planner_inject")

    # stub StandardMessageHandler，避免测试环境缺少后端依赖导致导入失败
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

    # 跳过 UI 构建、状态刷新与监听绑定
    monkeypatch.setattr(mod.GUILauncher, "_init_ui", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_init_status_watchers", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_update_status", lambda self: None, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_runtime_ports", lambda self: {"msgCenter_port": 8765}, raising=False)
    monkeypatch.setattr(mod.GUILauncher, "_is_port_listening", lambda self, host, port, timeout=0.6: True, raising=False)

    started = {"called": False}
    monkeypatch.setattr(
        mod.GUILauncher,
        "_start_new_card_scheduler_hosted",
        lambda self: started.__setitem__("called", True),
        raising=False,
    )

    sent_calls = []

    def fake_send_ws(self, port, text, timeout_ms=2000, *, expect_types=(), correlation_id=None):
        sent_calls.append(
            {
                "port": port,
                "text": text,
                "timeout_ms": timeout_ms,
                "expect_types": tuple(expect_types),
                "correlation_id": correlation_id,
            }
        )
        return ""

    monkeypatch.setattr(mod.GUILauncher, "_send_ws_text_qt", fake_send_ws, raising=False)

    g = mod.GUILauncher()
    g.msgCenter_port_input = types.SimpleNamespace(value=lambda: 8765)
    logs = []
    g._log = lambda m: logs.append(str(m))

    g._card_planner_manual_test_inject_sample_draft_cards()

    assert started["called"] is True
    assert len(sent_calls) == 2

    for call in sent_calls:
        assert call["port"] == 8765
        assert "card-planner:ingest:" in call["text"]
        assert call["timeout_ms"] == 2000
        assert call["expect_types"] == ("card-planner:ingest:completed", "card-planner:ingest:failed")

        msg = json.loads(call["text"])
        assert msg["type"] == "card-planner:ingest:requested"
        assert isinstance(msg["to"], list)
        assert msg["to"][0]["client_id"] == "new-card-scheduler"
        assert isinstance(msg.get("request_id"), str) and msg["request_id"]
        assert isinstance(msg.get("timestamp"), int)
        assert "data" in msg and "op" in msg["data"]
        assert isinstance(msg["data"]["annotation_ids"], list)

        assert call["correlation_id"] == msg["request_id"]

    first = json.loads(sent_calls[0]["text"])
    second = json.loads(sent_calls[1]["text"])

    assert first["data"]["op"]["kind"] == "all-to-one"
    assert first["data"]["op"]["target"]["kind"] == "new"
    assert first["data"]["op"]["face"] == "Q"
    assert first["data"]["annotation_ids"] == ["ann_1", "ann_2"]

    assert second["data"]["op"]["kind"] == "all-to-one"
    assert second["data"]["op"]["target"]["kind"] == "last"
    assert second["data"]["op"]["face"] == "A"
    assert second["data"]["annotation_ids"] == ["ann_3"]
