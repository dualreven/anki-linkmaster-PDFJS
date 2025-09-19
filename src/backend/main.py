#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 主程序入口

这是应用程序的主入口点，负责启动PyQt6应用。
"""

import sys
import os
# Respect existing env if provided by launcher; fallback to 9223
_debug_port = os.environ.get('QTWEBENGINE_REMOTE_DEBUGGING', '9223')
os.environ['QTWEBENGINE_REMOTE_DEBUGGING'] = _debug_port

# 将backend目录添加到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.backend.qt.compat import QApplication
from src.backend.app.application import AnkiLinkMasterApp


def main(module="pdf-viewer", vite_port=3000, file_path=None):
    """主函数
    
    Args:
        module: 要加载的前端模块 (pdf-home 或 pdf-viewer)
        vite_port: Vite开发服务器端口
        file_path: PDF文件路径 (仅pdf-viewer模块有效)
    """
    try:
        # 创建QApplication实例
        app = QApplication(sys.argv)
        
        # 设置应用属性
        app.setApplicationName("Anki LinkMaster PDFJS")
        app.setApplicationVersion("1.0.0")
        app.setOrganizationName("Anki LinkMaster")
        
        # 创建并运行应用
        main_app = AnkiLinkMasterApp()
        main_app.run(module, vite_port, file_path)
        
        # 启动事件循环
        return app.exec()
        
    except Exception as e:
        print(f"应用启动失败: {e}")
        return 1


