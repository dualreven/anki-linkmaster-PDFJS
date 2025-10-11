"""
嵌入式 HTTP 文件服务器 - 无阻塞版本

此模块提供一个可以嵌入到现有 PyQt 应用中的 HTTP 文件服务器，
无需独立进程，完全无阻塞，共享主应用的 Qt 事件循环。

使用方式：
    from src.backend.pdfFile_server.embed_fileserver import EmbedFileServer

    # 在主应用中创建服务器实例（不启动独立事件循环）
    server = EmbedFileServer(root_dir="data/pdfs", port=8080)
    if server.start():
        print("HTTP 文件服务器已启动（无阻塞）")

特性：
  - ✅ 完全无阻塞：共享主应用的 Qt 事件循环
  - ✅ 静态文件服务：支持 PDF、图片、JSON 等
  - ✅ CORS 支持：跨域资源共享
  - ✅ 安全路径检查：防止路径穿越攻击
  - ✅ 自动清理：应用退出时自动停止服务器
  - ✅ 信号槽通信：与主应用无缝集成
"""

import logging
import mimetypes
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

# 确保项目根目录在 sys.path 中
import sys
project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.qt.compat import QObject, pyqtSignal
from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress

logger = logging.getLogger(__name__)


class EmbedFileServer(QObject):
    """
    嵌入式 HTTP 文件服务器

    基于 QTcpServer 实现的轻量级 HTTP 文件服务器，
    专为嵌入 PyQt 应用设计，无阻塞启动。

    信号：
        server_started: 服务器启动成功时发出
        server_stopped: 服务器停止时发出
        server_error: 服务器发生错误时发出 (str: 错误信息)
        request_received: 收到请求时发出 (str: method, str: path)
    """

    server_started = pyqtSignal()
    server_stopped = pyqtSignal()
    server_error = pyqtSignal(str)
    request_received = pyqtSignal(str, str)  # (method, path)

    def __init__(self, root_dir: str, host: str = "127.0.0.1", port: int = 8080,
                 parent: Optional[QObject] = None):
        """初始化嵌入式文件服务器

        Args:
            root_dir: 文件服务根目录（如 "data/pdfs"）
            host: 监听地址（默认 127.0.0.1）
            port: 监听端口（默认 8080）
            parent: 父 QObject（用于自动清理）
        """
        super().__init__(parent)

        self.root_dir = Path(root_dir).resolve()
        self.host = host
        self.port = port
        self.server = QTcpServer(self)

        # 连接新连接信号
        self.server.newConnection.connect(self._handle_new_connection)

        logger.info(f"初始化嵌入式 HTTP 文件服务器: {host}:{port}")
        logger.info(f"  根目录: {self.root_dir}")

    def start(self) -> bool:
        """启动服务器（无阻塞）

        Returns:
            bool: 启动成功返回 True，否则返回 False
        """
        if self.server.isListening():
            logger.warning("服务器已在运行")
            return True

        try:
            # 启动 TCP 服务器
            if self.server.listen(QHostAddress(self.host), self.port):
                logger.info(f"✅ HTTP 文件服务器启动成功: http://{self.host}:{self.port}")
                logger.info(f"   根目录: {self.root_dir}")
                self.server_started.emit()
                return True
            else:
                error_msg = f"服务器启动失败: {self.server.errorString()}"
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
        if self.server.isListening():
            logger.info("正在停止 HTTP 文件服务器...")
            self.server.close()
            logger.info("✅ HTTP 文件服务器已停止")
            self.server_stopped.emit()
        else:
            logger.debug("服务器未运行，无需停止")

    def is_running(self) -> bool:
        """检查服务器是否正在运行

        Returns:
            bool: 运行中返回 True，否则返回 False
        """
        return self.server.isListening()

    # ---- 请求处理 ----

    def _handle_new_connection(self):
        """处理新的 TCP 连接"""
        socket = self.server.nextPendingConnection()
        if socket:
            socket.readyRead.connect(lambda: self._handle_request(socket))
            socket.disconnected.connect(socket.deleteLater)

    def _handle_request(self, socket: QTcpSocket):
        """处理 HTTP 请求"""
        # 读取请求数据
        request_data = socket.readAll().data()

        try:
            request = request_data.decode('utf-8')
        except UnicodeDecodeError:
            self._send_400(socket, "Invalid UTF-8 encoding")
            socket.close()
            return

        # 解析请求行
        lines = request.split('\r\n')
        if not lines:
            self._send_400(socket, "Empty request")
            socket.close()
            return

        request_line = lines[0]
        parts = request_line.split(' ')

        if len(parts) < 2:
            self._send_400(socket, "Invalid request line")
            socket.close()
            return

        method, path = parts[0], parts[1]

        # 发出请求信号
        self.request_received.emit(method, path)
        logger.debug(f"收到请求: {method} {path}")

        # 只支持 GET 请求
        if method != 'GET':
            self._send_405(socket)
            socket.close()
            return

        # 解析路径
        file_path = self._resolve_path(path)

        if not file_path:
            self._send_404(socket, path)
            socket.close()
            return

        # 发送文件
        self._send_file(socket, file_path)
        socket.close()

    def _resolve_path(self, url_path: str) -> Optional[Path]:
        """解析 URL 路径到文件系统路径

        Args:
            url_path: URL 路径（如 "/sample.pdf" 或 "/pdfs/sample.pdf"）

        Returns:
            Path: 文件系统路径，如果无效则返回 None
        """
        # URL 解码
        url_path = unquote(url_path)

        # 去除查询参数
        if '?' in url_path:
            url_path = url_path.split('?')[0]

        # 去除 /pdfs/ 前缀（兼容代理重写）
        # 例如: /pdfs/sample.pdf → sample.pdf
        if url_path.startswith('/pdfs/'):
            url_path = url_path[6:]  # 去掉 '/pdfs/' 前缀

        # 构建完整路径
        relative_path = url_path.lstrip('/')
        file_path = (self.root_dir / relative_path).resolve()

        # 安全检查：防止路径穿越
        try:
            file_path.relative_to(self.root_dir)
        except ValueError:
            logger.warning(f"⚠️ 路径穿越尝试: {url_path}")
            return None

        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            logger.debug(f"文件不存在: {file_path}")
            return None

        return file_path

    def _send_file(self, socket: QTcpSocket, file_path: Path):
        """发送文件响应

        Args:
            socket: TCP 套接字
            file_path: 文件路径
        """
        try:
            # 读取文件内容
            content = file_path.read_bytes()

            # 构建 HTTP 响应头
            mime_type = self._get_mime_type(file_path)
            response_headers = [
                "HTTP/1.1 200 OK",
                f"Content-Length: {len(content)}",
                f"Content-Type: {mime_type}",
                "Access-Control-Allow-Origin: *",  # CORS
                "Cache-Control: max-age=3600",
                "Connection: close",
                ""
            ]

            # 发送响应
            header_data = "\r\n".join(response_headers).encode('utf-8') + b"\r\n"
            socket.write(header_data)
            socket.write(content)
            socket.flush()

            logger.debug(f"✅ 发送文件: {file_path.name} ({len(content)} bytes, {mime_type})")

        except Exception as e:
            logger.error(f"❌ 发送文件失败: {e}", exc_info=True)
            self._send_500(socket, str(e))

    def _get_mime_type(self, file_path: Path) -> str:
        """获取 MIME 类型

        Args:
            file_path: 文件路径

        Returns:
            str: MIME 类型字符串
        """
        mime_type, _ = mimetypes.guess_type(str(file_path))
        return mime_type or 'application/octet-stream'

    # ---- HTTP 错误响应 ----

    def _send_400(self, socket: QTcpSocket, message: str = "Bad Request"):
        """发送 400 错误"""
        self._send_error(socket, 400, "Bad Request", message)

    def _send_404(self, socket: QTcpSocket, path: str):
        """发送 404 错误"""
        self._send_error(socket, 404, "Not Found", f"File not found: {path}")

    def _send_405(self, socket: QTcpSocket):
        """发送 405 错误"""
        self._send_error(socket, 405, "Method Not Allowed", "Only GET is supported")

    def _send_500(self, socket: QTcpSocket, message: str):
        """发送 500 错误"""
        self._send_error(socket, 500, "Internal Server Error", message)

    def _send_error(self, socket: QTcpSocket, code: int, status: str, message: str):
        """发送 HTTP 错误响应

        Args:
            socket: TCP 套接字
            code: HTTP 状态码
            status: 状态描述
            message: 错误消息
        """
        body = f"<h1>{code} {status}</h1><p>{message}</p>"
        response = [
            f"HTTP/1.1 {code} {status}",
            "Content-Type: text/html; charset=utf-8",
            f"Content-Length: {len(body)}",
            "Connection: close",
            "",
            body
        ]
        socket.write("\r\n".join(response).encode('utf-8'))
        socket.flush()

    def __del__(self):
        """析构函数：确保服务器被正确关闭"""
        try:
            # 检查对象是否还有效
            if hasattr(self, 'server') and self.server is not None:
                self.stop()
        except RuntimeError:
            # Qt对象可能已被删除，忽略错误
            pass


def setup_embed_fileserver(app, root_dir: str, port: int = 8080) -> Optional[EmbedFileServer]:
    """辅助函数：在主应用中设置嵌入式文件服务器

    这个函数简化了服务器的设置过程，自动将服务器绑定到主应用的生命周期。

    Args:
        app: QApplication 或 QCoreApplication 实例
        root_dir: 文件服务根目录
        port: HTTP 服务器端口（默认 8080）

    Returns:
        EmbedFileServer: 服务器实例，如果启动失败则返回 None

    示例:
        from PyQt6.QtWidgets import QApplication
        from src.backend.pdfFile_server.embed_fileserver import setup_embed_fileserver

        app = QApplication(sys.argv)
        server = setup_embed_fileserver(app, root_dir="data/pdfs", port=8080)

        if server:
            print(f"服务器已启动: http://127.0.0.1:{server.port}")

        sys.exit(app.exec())
    """
    # 将服务器实例设为应用的父对象，应用退出时自动清理
    server = EmbedFileServer(root_dir=root_dir, port=port, parent=app)

    # 连接应用退出信号，确保服务器被正确关闭
    if hasattr(app, 'aboutToQuit'):
        app.aboutToQuit.connect(server.stop)

    # 启动服务器
    if server.start():
        logger.info(f"✅ 嵌入式文件服务器设置完成，端口: {port}")
        return server
    else:
        logger.error("❌ 嵌入式文件服务器启动失败")
        return None


# 示例：独立运行（测试用）
if __name__ == "__main__":
    from src.qt.compat import QCoreApplication
    import sys

    # 配置日志
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # 创建 Qt 应用
    app = QCoreApplication(sys.argv)

    # 设置服务器（使用项目根目录下的 data/pdfs）
    root_dir = project_root / "data" / "pdfs"
    server = setup_embed_fileserver(app, root_dir=str(root_dir), port=8080)

    if server:
        print(f"\n{'='*60}")
        print(f"🚀 嵌入式 HTTP 文件服务器已启动")
        print(f"   地址: http://127.0.0.1:{server.port}")
        print(f"   根目录: {server.root_dir}")
        print(f"   状态: {'运行中' if server.is_running() else '已停止'}")
        print(f"{'='*60}\n")
        print(f"💡 测试方法:")
        print(f"   curl http://127.0.0.1:{server.port}/sample.pdf")
        print(f"   或在浏览器打开上述地址")
        print(f"\n按 Ctrl+C 停止服务器\n")

        # 连接信号以监控服务器状态
        server.request_received.connect(
            lambda method, path: print(f"📥 收到请求: {method} {path}")
        )

        # 运行事件循环
        sys.exit(app.exec())
    else:
        print("❌ 服务器启动失败")
        sys.exit(1)
