#!/usr/bin/env python3
"""
PyQt Bridge for QWebChannel

通过 QWebChannel 暴露 PyQt 功能给前端 JavaScript。
负责原生 UI 交互（文件选择对话框、确认对话框等）。

Usage:
    bridge = PyQtBridge(parent_window)
    channel.registerObject('pyqtBridge', bridge)
"""

import logging
from pathlib import Path
from PyQt6.QtCore import QObject, pyqtSlot

logger = logging.getLogger("pdf-home.pyqt-bridge")


class PyQtBridge(QObject):
    """
    PyQt 桥接对象

    通过 QWebChannel 暴露给前端，提供原生 UI 功能。

    Attributes:
        parent: 父窗口对象，用于显示对话框
    """

    def __init__(self, parent=None):
        """
        初始化 PyQtBridge

        Args:
            parent: 父窗口对象（MainWindow）
        """
        super().__init__(parent)
        self.parent = parent
        logger.info("[PyQtBridge] PyQtBridge 初始化")

    @pyqtSlot(result=str)
    def testConnection(self):
        """
        测试 QWebChannel 连接

        用于验证 PyQt 和 JavaScript 之间的通信是否正常。

        Returns:
            str: 测试消息 "PyQt Bridge Connected"
        """
        logger.info("[PyQtBridge] testConnection 被调用")
        logger.info("[PyQtBridge] QWebChannel 连接正常")
        return "PyQt Bridge Connected"
