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
from PyQt6.QtWidgets import QFileDialog, QMessageBox

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

    @pyqtSlot(bool, str, result=list)
    def selectFiles(self, multiple=True, fileType='pdf'):
        """
        打开文件选择对话框

        通过 Qt 原生对话框让用户选择文件。

        Args:
            multiple (bool): 是否允许多选。默认 True
            fileType (str): 文件类型过滤。'pdf' 或 'all'。默认 'pdf'

        Returns:
            list: 选中的文件路径列表。用户取消则返回空列表 []

        Example:
            files = bridge.selectFiles(True, 'pdf')
            # 返回: ['C:/path/file1.pdf', 'C:/path/file2.pdf']
        """
        logger.info(f"[PyQtBridge] [阶段2] selectFiles 被调用: multiple={multiple}, fileType={fileType}")

        try:
            # 设置文件过滤器
            if fileType == 'pdf':
                file_filter = "PDF Files (*.pdf)"
            elif fileType == 'all':
                file_filter = "All Files (*.*)"
            else:
                file_filter = "PDF Files (*.pdf)"

            logger.info(f"[PyQtBridge] [阶段2] 文件过滤器: {file_filter}")

            # 打开文件选择对话框
            if multiple:
                logger.info("[PyQtBridge] [阶段2] 打开多选文件对话框...")
                files, _ = QFileDialog.getOpenFileNames(
                    parent=self.parent,
                    caption="选择PDF文件",
                    directory="",  # 使用系统默认目录
                    filter=file_filter
                )
            else:
                logger.info("[PyQtBridge] [阶段2] 打开单选文件对话框...")
                file_path, _ = QFileDialog.getOpenFileName(
                    parent=self.parent,
                    caption="选择PDF文件",
                    directory="",
                    filter=file_filter
                )
                files = [file_path] if file_path else []

            # 记录结果
            if not files:
                logger.info("[PyQtBridge] [阶段2] 用户取消了文件选择")
            else:
                logger.info(f"[PyQtBridge] [阶段2] 用户选择了 {len(files)} 个文件:")
                for i, file_path in enumerate(files, 1):
                    logger.info(f"[PyQtBridge] [阶段2]   文件{i}: {file_path}")

            return files

        except Exception as e:
            logger.error(f"[PyQtBridge] [阶段2] selectFiles 发生错误: {e}", exc_info=True)
            return []

    @pyqtSlot(str, str, result=bool)
    def showConfirmDialog(self, title, message):
        """
        显示确认对话框

        通过 Qt 原生对话框让用户确认操作。

        Args:
            title (str): 对话框标题
            message (str): 提示消息

        Returns:
            bool: 用户是否点击确认 (True=是, False=否)

        Example:
            confirmed = bridge.showConfirmDialog('确认删除', '确定要删除此文件吗？')
            # 返回: True 或 False
        """
        logger.info(f"[PyQtBridge] [删除-阶段1] showConfirmDialog 被调用: title={title}")
        logger.info(f"[PyQtBridge] [删除-阶段1] 消息内容: {message}")

        try:
            # 显示确认对话框
            reply = QMessageBox.question(
                self.parent,
                title,
                message,
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No  # 默认选择"否"，防止误操作
            )

            confirmed = (reply == QMessageBox.StandardButton.Yes)
            logger.info(f"[PyQtBridge] [删除-阶段1] 用户选择: {'确认' if confirmed else '取消'}")

            return confirmed

        except Exception as e:
            logger.error(f"[PyQtBridge] [删除-阶段1] showConfirmDialog 发生错误: {e}", exc_info=True)
            return False  # 发生错误时默认返回取消
