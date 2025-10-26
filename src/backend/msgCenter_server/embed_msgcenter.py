"""
嵌入式 WebSocket 消息中心服务器 - 无阻塞版本

此模块提供一个可以嵌入到现有 PyQt 应用中的 WebSocket 服务器，
无需独立进程，完全无阻塞，共享主应用的 Qt 事件循环。

使用方式：
    from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer

    # 在主应用中创建服务器实例（不启动独立事件循环）
    server = EmbedMsgCenterServer(port=8765)
    if server.start():
        print("WebSocket 服务器已启动（无阻塞）")

特性：
  - ✅ 完全无阻塞：共享主应用的 Qt 事件循环
  - ✅ 自动清理：应用退出时自动停止服务器
  - ✅ 信号槽通信：与主应用无缝集成
  - ✅ 跨平台兼容：Windows/Linux/macOS
"""

import logging
from pathlib import Path
from typing import Optional

# 确保项目根目录在 sys.path 中
import sys
project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer
from src.qt.compat import QObject, pyqtSignal, pyqtSlot

logger = logging.getLogger(__name__)


class EmbedMsgCenterServer(QObject):
    """
    嵌入式 WebSocket 消息中心服务器包装器

    封装 StandardWebSocketServer，提供无阻塞的启动方式。

    信号：
        server_started: 服务器启动成功时发出
        server_stopped: 服务器停止时发出
        server_error: 服务器发生错误时发出 (str: 错误信息)
        client_count_changed: 客户端数量变化时发出 (int: 当前客户端数)
    """

    server_started = pyqtSignal()
    server_stopped = pyqtSignal()
    server_error = pyqtSignal(str)
    client_count_changed = pyqtSignal(int)

    def __init__(self, host: str = "127.0.0.1", port: int = 8765, parent: Optional[QObject] = None, *,
                 db_path: Optional[str] = None,
                 data_dir: Optional[str] = None):
        """初始化嵌入式服务器

        Args:
            host: 监听地址（默认 127.0.0.1）
            port: 监听端口（默认 8765）
            parent: 父 QObject（用于自动清理）
        """
        super().__init__(parent)
        self.host = host
        self.port = port
        self._server: Optional[StandardWebSocketServer] = None
        self._db_path = db_path
        self._data_dir = data_dir

        logger.info(f"初始化嵌入式 WebSocket 服务器: {host}:{port}")

    def start(self) -> bool:
        """启动服务器（无阻塞）

        Returns:
            bool: 启动成功返回 True，否则返回 False
        """
        if self._server and self._server.running:
            logger.warning("服务器已在运行")
            return True

        try:
            # 创建服务器实例（不传递独立的 QCoreApplication）
            # 严格参数：必须显式传入 data_dir 与 db_path（由 BackendLauncher 提供）
            if not self._data_dir or not self._db_path:
                raise RuntimeError("EmbedMsgCenterServer 启动缺少必要参数（data_dir 或 db_path），禁止兜底。")
            self._server = StandardWebSocketServer(
                host=self.host,
                port=self.port,
                app=None,  # 不创建独立的 QApplication
                db_path=self._db_path,
                data_dir=self._data_dir,
            )

            # 连接信号
            self._server.client_connected.connect(self._on_client_connected)
            self._server.client_disconnected.connect(self._on_client_disconnected)

            # 启动服务器（不调用 app.exec()，使用主应用的事件循环）
            if self._server.start():
                logger.info(f"✅ WebSocket 服务器启动成功: ws://{self.host}:{self.port}")
                self.server_started.emit()
                return True
            else:
                error_msg = f"服务器启动失败: {self._server.server.errorString()}"
                logger.error(f"❌ {error_msg}")
                self.server_error.emit(error_msg)
                return False

        except Exception as e:
            error_msg = f"服务器启动异常: {e}"
            logger.error(f"❌ {error_msg}", exc_info=True)
            self.server_error.emit(error_msg)
            return False

    def stop(self) -> None:
        """停止服务器"""
        if self._server and self._server.running:
            logger.info("正在停止 WebSocket 服务器...")
            self._server.stop()
            logger.info("✅ WebSocket 服务器已停止")
            self.server_stopped.emit()
        else:
            logger.debug("服务器未运行，无需停止")

    def is_running(self) -> bool:
        """检查服务器是否正在运行

        Returns:
            bool: 运行中返回 True，否则返回 False
        """
        return self._server is not None and self._server.running

    def get_client_count(self) -> int:
        """获取当前连接的客户端数量

        Returns:
            int: 客户端数量
        """
        if self._server:
            return self._server.get_client_count()
        return 0

    def broadcast_message(self, message: dict) -> None:
        """广播消息到所有客户端

        Args:
            message: 要广播的消息字典（将被转换为 JSON）
        """
        if self._server:
            self._server.broadcast_message(message)
        else:
            logger.warning("服务器未运行，无法广播消息")

    @pyqtSlot()
    def _on_client_connected(self):
        """客户端连接事件处理"""
        client_count = self.get_client_count()
        logger.info(f"新客户端已连接，当前客户端数: {client_count}")
        self.client_count_changed.emit(client_count)

    @pyqtSlot()
    def _on_client_disconnected(self):
        """客户端断开连接事件处理"""
        client_count = self.get_client_count()
        logger.info(f"客户端已断开，当前客户端数: {client_count}")
        self.client_count_changed.emit(client_count)

    def __del__(self):
        """析构函数：确保服务器被正确关闭"""
        self.stop()


def setup_embed_server(app, port: int = 8765) -> Optional[EmbedMsgCenterServer]:
    """辅助函数：在主应用中设置嵌入式服务器

    这个函数简化了服务器的设置过程，自动将服务器绑定到主应用的生命周期。

    Args:
        app: QApplication 或 QCoreApplication 实例
        port: WebSocket 服务器端口（默认 8765）

    Returns:
        EmbedMsgCenterServer: 服务器实例，如果启动失败则返回 None

    示例:
        from PyQt6.QtWidgets import QApplication
        from src.backend.msgCenter_server.embed_msgcenter import setup_embed_server

        app = QApplication(sys.argv)
        server = setup_embed_server(app, port=8765)

        if server:
            print(f"服务器已启动，当前客户端: {server.get_client_count()}")

        sys.exit(app.exec())
    """
    # 将服务器实例设为应用的父对象，应用退出时自动清理
    server = EmbedMsgCenterServer(port=port, parent=app)

    # 连接应用退出信号，确保服务器被正确关闭
    if hasattr(app, 'aboutToQuit'):
        app.aboutToQuit.connect(server.stop)

    # 启动服务器
    if server.start():
        logger.info(f"✅ 嵌入式服务器设置完成，端口: {port}")
        return server
    else:
        logger.error("❌ 嵌入式服务器启动失败")
        return None


# 示例：独立运行（测试用）
if __name__ == "__main__":
    from src.qt.compat import QCoreApplication
    import sys

    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # 创建 Qt 应用
    app = QCoreApplication(sys.argv)

    # 设置服务器
    server = setup_embed_server(app, port=8765)

    if server:
        print(f"\n{'='*60}")
        print(f"🚀 嵌入式 WebSocket 服务器已启动")
        print(f"   地址: ws://127.0.0.1:{server.port}")
        print(f"   状态: {'运行中' if server.is_running() else '已停止'}")
        print(f"{'='*60}\n")

        # 连接信号以监控服务器状态
        server.client_count_changed.connect(
            lambda count: print(f"📊 客户端数量: {count}")
        )

        # 运行事件循环
        sys.exit(app.exec())
    else:
        print("❌ 服务器启动失败")
        sys.exit(1)
