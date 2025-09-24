"""
Qt 兼容层：优先使用 Anki 的 aqt.qt 导出；若不可用再回退到 PyQt6。

专注于网络服务器功能和桌面集成组件：
from src.qt.compat import (
    QtCore, QtNetwork, QtWebSockets,
    QObject, QUrl, pyqtSignal, pyqtSlot, QTimer,
    QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket,
    QWebSocketServer, QWebSocket, QApplication, QWebChannel, QFileDialog,
)

注意：在非 Anki 环境且未安装 PyQt6 的情况下，导入将抛出 ImportError。
注意：QApplication 的创建和管理由外层启动器(ai-launcher.py)负责。
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
    QtNetwork = _qt.QtNetwork
    QtWebSockets = _qt.QtWebSockets

    # 导出网络服务器所需的核心组件 + UI组件
    from aqt.qt import (
        QObject, QUrl, pyqtSignal, pyqtSlot, QTimer,
        QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket,
        QWebSocketServer, QWebSocket,
    )
    from aqt.qt import (
        QApplication, QWebChannel, QFileDialog,
        QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction,
        QWebEngineView, QWebEnginePage, QWebEngineSettings
    )

except Exception:
    # 回退到 PyQt6（用于独立运行环境）
    try:
        from PyQt6 import QtCore, QtNetwork, QtWebSockets

        from PyQt6.QtWidgets import (
            QApplication, QFileDialog, QMainWindow, QWidget, QVBoxLayout, QStatusBar
        )
        from PyQt6.QtGui import QAction
        from PyQt6.QtCore import QUrl, pyqtSignal, pyqtSlot, QTimer, QByteArray, QObject
        from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket
        from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
        from PyQt6.QtWebChannel import QWebChannel

        # WebEngine组件 - 可能不可用，使用try-except处理
        try:
            from PyQt6.QtWebEngineWidgets import QWebEngineView
            from PyQt6.QtWebEngineCore import QWebEngineSettings, QWebEnginePage
        except ImportError:
            # 如果WebEngine不可用，设置为None
            QWebEngineView = None
            QWebEngineSettings = None
            QWebEnginePage = None
    except Exception as e:
        raise ImportError(
            "未检测到 Anki 运行环境 (aqt) 且未安装可用的 PyQt6。\n"
            "请在 Anki 中运行插件，或在独立环境安装 PyQt6 与 QtWebEngine 后再运行。\n"
            f"原始错误: {e}"
        )


