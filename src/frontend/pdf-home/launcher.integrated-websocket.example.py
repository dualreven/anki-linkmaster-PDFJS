"""
PDF-Home 启动器 - 集成 WebSocket 服务器示例

此示例展示如何将 WebSocket 服务器集成到 PDF-Home 主窗口中，
实现完全无阻塞的后台服务。

使用方法：
    python src/frontend/pdf-home/launcher.integrated-websocket.example.py
"""

import sys
import os
import json
import logging
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.qt.compat import QApplication
from src.frontend.pdf_home.main_window import MainWindow

# ✅ 导入嵌入式 WebSocket 服务器
from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(project_root / 'logs' / 'pdf-home.log', mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def load_port_config() -> int:
    """从配置文件加载 WebSocket 端口"""
    try:
        ports_file = project_root / 'logs' / 'runtime-ports.json'
        if ports_file.exists():
            with open(ports_file, 'r', encoding='utf-8') as f:
                ports = json.load(f)
                port = ports.get('msgCenter_port', 8765)
                logger.info(f"从配置文件加载端口: {port}")
                return port
    except Exception as e:
        logger.warning(f"加载端口配置失败: {e}")

    # 使用默认端口
    default_port = 8765
    logger.info(f"使用默认端口: {default_port}")
    return default_port


def main():
    """主函数"""
    logger.info("="*60)
    logger.info("启动 PDF-Home（集成 WebSocket 服务器）")
    logger.info("="*60)

    # 创建 Qt 应用
    app = QApplication(sys.argv)
    app.setApplicationName("Anki LinkMaster PDFJS")
    app.setOrganizationName("Anki LinkMaster")

    # 创建主窗口
    window = MainWindow(
        app=app,
        remote_debug_port=9222,
        stop_backend_on_close=True  # 窗口关闭时停止后端服务
    )

    # ✅ 创建嵌入式 WebSocket 服务器
    ws_port = load_port_config()
    websocket_server = EmbedMsgCenterServer(
        port=ws_port,
        parent=window  # 设为主窗口的子对象，随窗口自动清理
    )

    # 连接服务器信号到主窗口
    websocket_server.server_started.connect(
        lambda: window.status_bar.showMessage(f'✅ WebSocket 服务器: ws://127.0.0.1:{ws_port}')
    )

    websocket_server.server_stopped.connect(
        lambda: window.status_bar.showMessage('🛑 WebSocket 服务器已停止')
    )

    websocket_server.server_error.connect(
        lambda err: window.status_bar.showMessage(f'❌ 服务器错误: {err}')
    )

    websocket_server.client_count_changed.connect(
        lambda count: logger.info(f"📊 WebSocket 客户端数: {count}")
    )

    # 启动 WebSocket 服务器（无阻塞）
    if websocket_server.start():
        logger.info(f"✅ WebSocket 服务器已启动: ws://127.0.0.1:{ws_port}")
        logger.info(f"   状态: {'运行中' if websocket_server.is_running() else '已停止'}")
    else:
        logger.error("❌ WebSocket 服务器启动失败")
        window.status_bar.showMessage('❌ WebSocket 服务器启动失败')

    # 保存 WebSocket 服务器引用到主窗口
    window.websocket_server = websocket_server

    # ⚠️ 修改关闭事件，确保服务器被正确关闭
    original_close_event = window.closeEvent

    def enhanced_close_event(event):
        """增强的关闭事件：先停止服务器，再执行原有逻辑"""
        logger.info("窗口关闭：停止 WebSocket 服务器...")
        if hasattr(window, 'websocket_server'):
            window.websocket_server.stop()
        original_close_event(event)

    window.closeEvent = enhanced_close_event

    # 加载前端页面
    frontend_url = f"http://localhost:3000"  # Vite 开发服务器地址
    window.load_frontend(frontend_url)
    logger.info(f"加载前端页面: {frontend_url}")

    # 显示主窗口
    window.show()
    logger.info("主窗口已显示")

    # 应用退出时停止服务器（双重保险）
    app.aboutToQuit.connect(lambda: websocket_server.stop())

    logger.info("\n" + "="*60)
    logger.info("✅ 应用启动完成")
    logger.info(f"   主窗口: Anki LinkMaster PDFJS")
    logger.info(f"   WebSocket: ws://127.0.0.1:{ws_port}")
    logger.info(f"   前端: {frontend_url}")
    logger.info("="*60 + "\n")

    # 运行 Qt 事件循环（WebSocket 服务器在后台运行，无阻塞）
    exit_code = app.exec()

    logger.info(f"应用退出，退出码: {exit_code}")
    return exit_code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        logger.info("\n用户中断，正在退出...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"应用崩溃: {e}", exc_info=True)
        sys.exit(1)
