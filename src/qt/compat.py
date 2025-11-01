"""
Qt 兼容层：优先使用 Anki 的 aqt.qt 导出；若不可用再回退到 PyQt6。

专注于网络服务器功能和桌面集成组件：
from src.qt.compat import (
    QtCore, QtNetwork, QtWebSockets,
    QObject, QUrl, pyqtSignal, pyqtSlot, QTimer, QEvent, Qt,
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
        QWebSocketServer, QWebSocket, QEvent, Qt,
    )
    from aqt.qt import (
        QApplication, QWebChannel, QFileDialog,
        QMainWindow, QWidget, QVBoxLayout, QStatusBar, QAction,
        QWebEngineView, QWebEnginePage, QWebEngineSettings, QSizePolicy
    )

except Exception:
    # 回退到 PyQt6（用于独立运行环境）
    try:
        from PyQt6 import QtCore, QtNetwork, QtWebSockets

        from PyQt6.QtWidgets import (
            QApplication, QFileDialog, QMainWindow, QWidget, QVBoxLayout, QStatusBar, QSizePolicy
        )
        from PyQt6.QtGui import QAction
        from PyQt6.QtCore import (
            QUrl, pyqtSignal, pyqtSlot, QTimer, QByteArray, QObject, QCoreApplication,
            QEvent, Qt
        )
        from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress, QAbstractSocket
        from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket

        # WebEngine组件 - 某些环境对导入顺序敏感，这里进行多策略尝试
        QWebEngineView = None
        QWebEngineSettings = None
        QWebEnginePage = None

        def _try_import_widgets_then_core() -> bool:
            global QWebEngineView, QWebEngineSettings, QWebEnginePage
            try:
                from PyQt6.QtWebEngineWidgets import QWebEngineView as _View
                from PyQt6.QtWebEngineCore import QWebEngineSettings as _Settings, QWebEnginePage as _Page
                QWebEngineView, QWebEngineSettings, QWebEnginePage = _View, _Settings, _Page
                return True
            except Exception:
                return False

        def _try_import_core_then_widgets() -> bool:
            global QWebEngineView, QWebEngineSettings, QWebEnginePage
            try:
                from PyQt6.QtWebEngineCore import QWebEngineSettings as _Settings, QWebEnginePage as _Page
                from PyQt6.QtWebEngineWidgets import QWebEngineView as _View
                QWebEngineView, QWebEngineSettings, QWebEnginePage = _View, _Settings, _Page
                return True
            except Exception:
                return False

        def _try_import_via_importlib() -> bool:
            global QWebEngineView, QWebEngineSettings, QWebEnginePage
            try:
                import importlib as _il
                _wec = _il.import_module('PyQt6.QtWebEngineCore')
                _wew = _il.import_module('PyQt6.QtWebEngineWidgets')
                QWebEngineView = getattr(_wew, 'QWebEngineView', None)
                QWebEngineSettings = getattr(_wec, 'QWebEngineSettings', None)
                QWebEnginePage = getattr(_wec, 'QWebEnginePage', None)
                return bool(QWebEngineView and QWebEngineSettings and QWebEnginePage)
            except Exception:
                return False

        def ensure_webengine_loaded() -> bool:
            """在运行期重试加载 QtWebEngine（供上层在 QApplication 创建后调用）。"""
            global QWebEngineView, QWebEngineSettings, QWebEnginePage
            if QWebEngineView and QWebEngineSettings and QWebEnginePage:
                return True
            return (_try_import_widgets_then_core() or _try_import_core_then_widgets() or _try_import_via_importlib())

        # 模块导入阶段先尝试一次加载
        if not ensure_webengine_loaded():
            # 最终保留为 None，由上层根据 None 做降级处理与提示
            QWebEngineView = None
            QWebEngineSettings = None
            QWebEnginePage = None

        # 注意：为避免潜在的导入顺序问题，将 QWebChannel 的导入放到 WebEngine 尝试之后
        from PyQt6.QtWebChannel import QWebChannel
    except Exception as e:
        raise ImportError(
            "未检测到 Anki 运行环境 (aqt) 且未安装可用的 PyQt6。\n"
            "请在 Anki 中运行插件，或在独立环境安装 PyQt6 与 QtWebEngine 后再运行。\n"
            f"原始错误: {e}"
        )


