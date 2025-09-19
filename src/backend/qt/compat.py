"""
Qt 兼容层：优先使用 Anki 的 aqt.qt 导出；若不可用再回退到 PyQt6。

在代码中尽量从本模块导入 Qt 符号，避免直接依赖 PyQt6：
from src.backend.qt.compat import (
    QtCore, QtGui, QtWidgets, QtNetwork, QtWebSockets,
    QtWebEngineWidgets, QtWebEngineCore,
    QApplication, QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction,
    QDialog, QTextEdit, QPushButton, QUrl, pyqtSignal, pyqtSlot, QTimer,
    QWebEngineView, QWebEnginePage, QWebEngineSettings,
    QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket,
    QWebSocketServer, QWebSocket,
)

注意：在非 Anki 环境且未安装 PyQt6 的情况下，导入将抛出 ImportError。
"""

import os
import sys

# 仅在明确处于 Anki 进程（或已加载）时才尝试导入 aqt
_should_use_aqt = os.environ.get('RUNNING_IN_ANKI') == '1' or ('aqt' in sys.modules)

try:
    # 优先使用 Anki 的 Qt 绑定（仅在 Anki 环境）
    if not _should_use_aqt:
        raise ImportError('aqt not in active environment')
    from aqt import qt as _qt

    QtCore = _qt.QtCore
    QtGui = _qt.QtGui
    QtWidgets = _qt.QtWidgets
    QtNetwork = _qt.QtNetwork
    QtWebSockets = _qt.QtWebSockets
    QtWebEngineWidgets = _qt.QtWebEngineWidgets
    QtWebEngineCore = _qt.QtWebEngineCore

    # 直接导出常用符号（便于 from compat import QApplication 这种用法）
    from aqt.qt import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction, QObject,
        QDialog, QTextEdit, QPushButton, QFileDialog, QUrl, pyqtSignal, pyqtSlot, QTimer,
        QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket,
        QWebSocketServer, QWebSocket,
    )
    # WebEngine 相关（部分老版本可能不存在，按需导入）
    try:
        from aqt.qt import QWebEngineView
    except Exception:  # pragma: no cover - 某些环境下缺失
        QWebEngineView = None
    try:
        from aqt.qt import QWebEnginePage, QWebEngineSettings
    except Exception:  # pragma: no cover
        QWebEnginePage = None
        QWebEngineSettings = None

except Exception:
    # 回退到 PyQt6（用于独立运行环境）
    try:
        from PyQt6 import QtCore, QtGui, QtWidgets, QtNetwork, QtWebSockets
        try:
            from PyQt6 import QtWebEngineWidgets, QtWebEngineCore
        except Exception:
            QtWebEngineWidgets = None
            QtWebEngineCore = None

        from PyQt6.QtWidgets import (
            QApplication, QMainWindow, QWidget, QVBoxLayout, QStatusBar,
            QDialog, QTextEdit, QPushButton, QFileDialog,
        )
        # Qt6: QAction 位于 QtGui 而非 QtWidgets
        from PyQt6.QtGui import QAction
        from PyQt6.QtCore import QUrl, pyqtSignal, pyqtSlot, QTimer, QByteArray, QObject
        try:
            from PyQt6.QtWebEngineWidgets import QWebEngineView
        except Exception:
            QWebEngineView = None
        try:
            from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
        except Exception:
            QWebEnginePage = None
            QWebEngineSettings = None
        from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket
        from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
    except Exception as e:
        raise ImportError(
            "未检测到 Anki 运行环境 (aqt) 且未安装可用的 PyQt6。\n"
            "请在 Anki 中运行插件，或在独立环境安装 PyQt6 与 QtWebEngine 后再运行。\n"
            f"原始错误: {e}"
        )


