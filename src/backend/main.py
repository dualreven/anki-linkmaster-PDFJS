#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 主程序入口

这是应用程序的主入口点，负责启动PyQt6应用。
"""

import sys
import os
DEBUG_PORT = "9223"
os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = DEBUG_PORT

# 将backend目录添加到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication
from app.application import AnkiLinkMasterApp


def main():
    """主函数"""
    try:
        # 创建QApplication实例
        app = QApplication(sys.argv)
        
        # 设置应用属性
        app.setApplicationName("Anki LinkMaster PDFJS")
        app.setApplicationVersion("1.0.0")
        app.setOrganizationName("Anki LinkMaster")
        
        # 创建并运行应用
        main_app = AnkiLinkMasterApp()
        main_app.run()
        
        # 启动事件循环
        return app.exec()
        
    except Exception as e:
        print(f"应用启动失败: {e}")
        return 1


