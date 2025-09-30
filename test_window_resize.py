"""
测试MainWindow窗口大小调整功能

验证QWebEngineView是否能正确响应窗口大小变化
"""

import sys
from pathlib import Path

# 添加项目根目录��Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from PyQt6.QtWidgets import QApplication
from src.frontend.pyqtui.main_window import MainWindow


def test_window_resize():
    """测试窗口大小调整功能"""
    app = QApplication(sys.argv)

    # 创建主窗口
    print("创建主窗口...")
    window = MainWindow(app, remote_debug_port=9224, js_log_file="logs/test-resize.log")

    # 加载测试页面
    print("加载测试页面...")
    window.load_frontend("http://localhost:3000/pdf-home/index.html")

    # 显示窗口
    window.show()

    # 打印初始大小
    print(f"初始窗口大小: {window.width()} x {window.height()}")
    print(f"初始WebView大小: {window.web_view.width()} x {window.web_view.height()}")

    # 提示用户
    print("\n测试说明:")
    print("1. 请手动调整窗口大小")
    print("2. 观察WebView是否随窗口大小变化")
    print("3. WebView应该始终占满整个窗口内容区域（除菜单栏和状态栏）")
    print("4. 关闭窗口结束测试\n")

    # 运行应用
    sys.exit(app.exec())


if __name__ == "__main__":
    test_window_resize()
