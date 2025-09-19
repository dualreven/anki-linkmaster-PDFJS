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

try:
    # 优先使用 Anki 的 Qt 绑定
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
        QApplication, QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction,
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
    from PyQt6 import QtCore, QtGui, QtWidgets, QtNetwork, QtWebSockets
    try:
        from PyQt6 import QtWebEngineWidgets, QtWebEngineCore
    except Exception as _e:  # pragma: no cover - 无 WebEngine 时占位
        QtWebEngineWidgets = None
        QtWebEngineCore = None

    from PyQt6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction,
        QDialog, QTextEdit, QPushButton, QFileDialog,
    )
    from PyQt6.QtCore import QUrl, pyqtSignal, pyqtSlot, QTimer, QAbstractSocket, QByteArray
    try:
        from PyQt6.QtWebEngineWidgets import QWebEngineView
    except Exception:  # pragma: no cover
        QWebEngineView = None
    try:
        from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
    except Exception:  # pragma: no cover
        QWebEnginePage = None
        QWebEngineSettings = None
    from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress
    from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket


