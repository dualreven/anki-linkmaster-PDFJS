"""
Anki LinkMaster PDFJS 主应用类
负责管理整个应用程序的生命周期
"""

from PyQt6.QtWidgets import QApplication
from src.backend.ui.main_window import MainWindow
from src.backend.websocket.standard_server import StandardWebSocketServer
from src.backend.pdf_manager.manager import PDFManager
from src.backend.http_server import HttpFileServer
import logging
import json
import os

# 导入拆分后的模块
from .application_subcode.helpers import get_vite_port
from .application_subcode.response_handlers import ResponseHandlers
from .application_subcode.websocket_handlers import WebSocketHandlers
from .application_subcode.client_handler import ClientHandler
from .application_subcode.command_line_handler import CommandLineHandler

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnkiLinkMasterApp:
    """主应用类"""
    
    def __init__(self):
        """初始化应用"""
        self.main_window = None
        self.websocket_server = None
        self.pdf_manager = None
        self.http_server = None
        self.file_path = None
        
        # 初始化子模块
        self.response_handlers = None
        self.websocket_handlers = None
        self.client_handler = None
        self.command_line_handler = None
    
    def run(self, module="pdf-viewer", vite_port=3000, file_path=None):
        """运行应用
        
        Args:
            module: 要加载的前端模块 (pdf-home 或 pdf-viewer)
            vite_port: Vite开发服务器端口
            file_path: PDF文件路径 (仅pdf-viewer模块有效)
        """
        # 存储文件路径供后续使用
        self.file_path = file_path
        # 初始化PDF管理器
        self.pdf_manager = PDFManager()
        logger.info("PDF管理器初始化成功")
        
        # 初始化HTTP文件服务器
        self.http_server = HttpFileServer(port=8080)
        if self.http_server.start():
            logger.info("HTTP文件服务器启动成功")
        else:
            logger.warning("HTTP文件服务器启动失败，文件传输功能受限")
        
        # 初始化并启动WebSocket服务器
        self.websocket_server = StandardWebSocketServer(host="127.0.0.1", port=8765)
        if self.websocket_server.start():
            logger.info("WebSocket服务器启动成功")
            # 初始化响应处理器
            self.response_handlers = ResponseHandlers(self.websocket_server)
            # 初始化WebSocket消息处理器
            self.websocket_handlers = WebSocketHandlers(self, self.response_handlers)
            # 初始化客户端处理器
            self.client_handler = ClientHandler(self)
            # 初始化命令行处理器
            self.command_line_handler = CommandLineHandler(self)
            
            # 设置WebSocket消息处理程序
            self.setup_websocket_handlers()
            
            # QtWebEngine优化：改为客户端连接时主动推送数据
            logger.info("WebSocket服务器启动成功，等待客户端连接...")
            # NEW: notify frontend to open pdf-viewer after backend ready
            try:
                from datetime import datetime, timezone
                ws = getattr(self, 'websocket_server', None) or getattr(self, 'ws_server', None)
                if ws:
                    payload = {"action": "open_pdf_viewer", "timestamp": datetime.now(timezone.utc).isoformat()}
                    try:
                        # 首选使用 broadcast_event（若实现存在）
                        if hasattr(ws, "broadcast_event"):
                            ws.broadcast_event("open_pdf_viewer", payload)
                        else:
                            # 回退到通用的 broadcast_message
                            ws.broadcast_message({"event": "open_pdf_viewer", "payload": payload})
                        from src.backend.logging.pdfjs_logger import get_pdfjs_logger
                        get_pdfjs_logger().info("Sent open_pdf_viewer event to frontend")
                    except Exception:
                        # 如果 broadcast_event 失败，尝试备用发送方式并记录
                        try:
                            ws.broadcast_message({"event": "open_pdf_viewer", "payload": payload})
                            from src.backend.logging.pdfjs_logger import get_pdfjs_logger
                            get_pdfjs_logger().info("Sent open_pdf_viewer (fallback) event to frontend via broadcast_message")
                        except Exception as inner_e:
                            import logging as _logging
                            _logging.getLogger("pdfjs_init").exception("Failed to send open_pdf_viewer via ws methods: %s", inner_e)
            except Exception as e:
                import logging as _logging
                _logging.getLogger("pdfjs_init").exception("Failed to notify frontend: %s", e)
            
        else:
            logger.error("WebSocket服务器启动失败")
            return  # WebSocket启动失败，直接返回
        
        # 初始化主窗口
        self.main_window = MainWindow(self)
        self.main_window.send_debug_message_requested.connect(self.handle_send_debug_message)
        
        # 使用传入的端口或自动检测
        actual_vite_port = get_vite_port() if vite_port == 3000 else vite_port
        logger.info(f"Vite端口: {actual_vite_port}")
        logger.info(f"加载模块: {module}")
        
        # 加载前端页面，使用Vite配置的端口和正确的入口路径
        self.main_window.load_frontend(f"http://localhost:{actual_vite_port}/{module}/index.html")
        self.main_window.show()
        
        # 处理命令行传入的文件路径
        if self.command_line_handler:
            self.command_line_handler.handle_command_line_file(file_path, module)

    def handle_send_debug_message(self):
        """处理来自UI的发送调试消息的请求"""
        logger.info("[DEBUG] 收到来自菜单的广播请求。")
        if self.websocket_server:
            self.websocket_server.broadcast_message({
                "type": "debug",
                "content": "你好，这是一个来自菜单的调试消息！"
            })

    def setup_websocket_handlers(self):
        """设置WebSocket消息处理程序"""
        if self.websocket_server and self.websocket_handlers and self.client_handler:
            self.websocket_server.message_received.connect(self.websocket_handlers.handle_websocket_message)
            # QtWebEngine优化：监听客户端连接事件
            self.websocket_server.client_connected.connect(self.client_handler.on_client_connected)
            logger.info("WebSocket消息处理程序设置成功")

    def shutdown(self):
        """关闭应用"""
        # 停止WebSocket服务器
        if self.websocket_server:
            self.websocket_server.stop()
            logger.info("WebSocket服务器已停止")
            
        # 关闭主窗口
        if self.main_window:
            self.main_window.close()

    def broadcast_pdf_list(self):
        """广播PDF文件列表更新"""
        if self.client_handler:
            self.client_handler.broadcast_pdf_list()