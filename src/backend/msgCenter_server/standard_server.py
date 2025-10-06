"""
标准WebSocket服务器 - 基于JSON通信标准
"""
import logging
import json
import time
import subprocess
import os
from typing import Dict, Any, Optional, List

# Add project root to Python path for standalone execution
import sys
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.qt.compat import (
    QObject, pyqtSignal, pyqtSlot,
    QWebSocketServer, QWebSocket,
    QHostAddress, QAbstractSocket,
    QCoreApplication
)
import argparse
import sys

from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, PDFMessageBuilder, MessageType
from src.backend.pdf_manager.manager import PDFManager
# 移除传输优化模块的依赖
# from src.backend.pdf_manager.page_transfer_manager import page_transfer_manager

logger = logging.getLogger(__name__)

def setup_logging():
    """配置日志记录"""
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "ws-server.log")

    # 使用 'w' 模式覆盖写入，并确保 UTF-8 编码
    handler = logging.FileHandler(log_file, mode='w', encoding='utf-8')
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)

    # 配置根 logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    # 移除所有现有的 handlers，避免重复记录
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # 添加 StreamHandler 以便在控制台也看到输出
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    root_logger.addHandler(stream_handler)

    logger.info("Logging setup complete.")

def get_port(args_port=None):
    """获取端口号"""
    if args_port:
        logger.info(f"Using port from command line argument: {args_port}")
        return args_port

    try:
        with open('logs/runtime-ports.json', 'r') as f:
            ports = json.load(f)
            port = ports.get('ws_server')
            if port:
                logger.info(f"Using port from logs/runtime-ports.json: {port}")
                return port
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        logger.warning("Could not read port from logs/runtime-ports.json.")

    default_port = 8765
    logger.info(f"Using default port: {default_port}")
    return default_port

class StandardWebSocketServer(QObject):
    """标准WebSocket服务器 - 支持JSON通信标准"""
    
    # 定义信号
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    message_received = pyqtSignal(QWebSocket, dict)
    
    def __init__(self, host="127.0.0.1", port=8765, app=None):
        super().__init__()
        self.host = host
        self.port = port
        self.app = app  # 存储应用实例引用
        self.server = QWebSocketServer("Anki LinkMaster Standard Server", QWebSocketServer.SslMode.NonSecureMode)
        
        # 客户端列表
        self.clients = []
        self.running = False
        
        # PDF管理器
        self.pdf_manager = PDFManager()
        
        # 连接信号
        self.server.newConnection.connect(self.on_new_connection)
        
        # 连接PDF管理器信号
        self.pdf_manager.file_added.connect(self.on_pdf_file_added)
        self.pdf_manager.file_removed.connect(self.on_pdf_file_removed)
        self.pdf_manager.file_list_changed.connect(self.on_pdf_list_changed)
        
    def start(self):
        """启动服务器"""
        if self.running:
            logger.warning("WebSocket服务器已在运行")
            return False
        
        if self.server.listen(QHostAddress.SpecialAddress.LocalHost, self.port):
            self.running = True
            logger.info(f"标准WebSocket服务器启动成功: ws://{self.host}:{self.port}")
            return True
        else:
            logger.error(f"标准WebSocket服务器启动失败: {self.server.errorString()}")
            return False
            
    def stop(self):
        """停止服务器"""
        if not self.running:
            return
        
        self.server.close()
        for client in self.clients:
            client.close()
        self.clients.clear()
        if hasattr(self, "pdf_library_api") and self.pdf_library_api:
            self.pdf_library_api.shutdown()
        self.running = False
        logger.info("标准WebSocket服务器已停止")
        
    @pyqtSlot()
    def on_new_connection(self):
        """处理新客户端连接"""
        socket = self.server.nextPendingConnection()
        if not socket:
            logger.error("获取新连接失败")
            return
        
        logger.info(f"新客户端连接: {socket.peerAddress().toString()}:{socket.peerPort()}")
        
        # 连接信号
        socket.textMessageReceived.connect(self.on_message_received)
        socket.disconnected.connect(self.on_client_disconnected)
        socket.errorOccurred.connect(self.on_socket_error)
        
        self.clients.append(socket)
        self.client_connected.emit(socket)
        
        # 发送欢迎消息
        welcome_msg = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS.value,
            data={
                "status": "connected",
                "server_version": "1.0.0",
                "client_count": len(self.clients)
            }
        )
        self.send_message(socket, welcome_msg)
        
    @pyqtSlot(str)
    def on_message_received(self, message):
        """处理收到的消息"""
        client_socket = self.sender()
        logger.info(f"收到消息: {message[:200]}...")
        
        # 解析消息
        parsed_message, error = StandardMessageHandler.parse_message(message)
        if error:
            logger.error(f"消息解析错误: {error}")
            error_response = StandardMessageHandler.build_error_response(
                "unknown",
                "INVALID_MESSAGE",
                f"消息格式错误: {error}"
            )
            self.send_message(client_socket, error_response)
            return
        
        # 处理消息
        try:
            response = self.handle_message(parsed_message)
            if response:
                self.send_message(client_socket, response)
            
            # 发出原始消息信号
            self.message_received.emit(client_socket, parsed_message)
            
        except Exception as e:
            logger.error(f"处理消息时出错: {e}")
            request_id = parsed_message.get("request_id", "unknown")
            error_response = StandardMessageHandler.build_error_response(
                request_id,
                "PROCESSING_ERROR",
                str(e)
            )
            self.send_message(client_socket, error_response)
            
    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理具体消息"""
        message_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})

        logger.info(f"处理消息类型: {message_type}, 请求ID: {request_id}")

        # === 新规范消息处理（v2: 主语:谓语:宾语） ===
        # 获取PDF列表
        if message_type == "pdf/list":
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                return self.handle_pdf_list_v2(request_id, data)
        elif message_type == "bookmark/list":
            return self.handle_bookmark_list_request(request_id, data)
        elif message_type == "bookmark/save":
            return self.handle_bookmark_save_request(request_id, data)
        elif message_type in ["pdf-home:get:pdf-list", "get_pdf_list"]:
            return self.handle_pdf_list_request(request_id, data)

        # 添加PDF文件（支持单个/多个）
        elif message_type in ["pdf-home:add:pdf-files", "add_pdf"]:
            return self.handle_pdf_upload_request(request_id, data)

        # 删除PDF文件（统一批量处理）
        elif message_type in ["pdf-home:remove:pdf-files", "remove_pdf", "batch_remove_pdf"]:
            # 统一使用批量删除处理器
            return self.handle_batch_pdf_remove_request(request_id, data)

        # 打开PDF查看器
        elif message_type in ["pdf-home:open:pdf-file", "open_pdf"]:
           return self.handle_open_pdf_request(request_id, data)

        # 获取PDF详情
        elif message_type in ["pdf-home:get:pdf-info", "pdf_detail_request"]:
            return self.handle_pdf_detail_request(request_id, data)

        # 搜索（兼容 v1/v2）
        elif message_type in ["pdf/search", "pdf-home:search:pdf-files"]:
            return self.handle_pdf_search_request(request_id, data, message_type, message)

        # 更新PDF元数据
        elif message_type in ["pdf-home:update:pdf", "update_pdf"]:
            return self.handle_pdf_update_request(request_id, data)

        # PDF页面请求
        elif message_type == MessageType.PDF_PAGE_REQUEST.value:
            return self.handle_pdf_page_request(request_id, data)

        # PDF页面预加载请求
        elif message_type == MessageType.PDF_PAGE_PRELOAD.value:
            return self.handle_pdf_page_preload_request(request_id, data)

        # PDF页面缓存清理请求
        elif message_type == MessageType.PDF_PAGE_CACHE_CLEAR.value:
            return self.handle_pdf_page_cache_clear_request(request_id, data)

        
            return self.handle_pdf_detail_request(request_id, data)
        
        # Console日志消息
        elif message_type == "console_log":
            return self.handle_console_log_request(request_id, data)

        # 心跳消息
        elif message_type == "heartbeat":
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message="心跳响应",
                data={"timestamp": int(time.time())}
            )
        
        else:
            return StandardMessageHandler.build_error_response(
                request_id,
                "unknown_message_type",
                f"未知的消息类型: {message_type}",
                code=400
            )
    

    def handle_bookmark_list_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        pdf_uuid = (data or {}).get('pdf_uuid')
        if not pdf_uuid:
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "缺少必需的 pdf_uuid",
                },
            }
        try:
            result = {"bookmarks": [], "root_ids": []}
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                result = self.pdf_library_api.list_bookmarks(pdf_uuid) or result
            response = {
                "type": "bookmark/list",
                "timestamp": int(time.time()),
                "data": result,
            }
            if request_id:
                response["request_id"] = request_id
            return response
        except Exception as exc:
            logger.error("获取书签失败: %s", exc, exc_info=True)
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "获取书签失败",
                    "details": str(exc),
                },
            }

    def handle_bookmark_save_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        pdf_uuid = (data or {}).get('pdf_uuid')
        bookmarks = (data or {}).get('bookmarks')
        root_ids = (data or {}).get('root_ids')
        if not pdf_uuid:
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "缺少必需的 pdf_uuid",
                },
            }
        if bookmarks is None:
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "缺少必需的 bookmarks",
                },
            }
        try:
            saved = 0
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                saved = self.pdf_library_api.save_bookmarks(pdf_uuid, bookmarks, root_ids=root_ids)
            response = {
                "type": "bookmark/save",
                "timestamp": int(time.time()),
                "data": {"saved": saved},
            }
            if request_id:
                response["request_id"] = request_id
            return response
        except Exception as exc:
            logger.error("保存书签失败: %s", exc, exc_info=True)
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "保存书签失败",
                    "details": str(exc),
                },
            }

    def handle_pdf_list_v2(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            include_hidden = data.get("include_hidden", True)
            limit = data.get("limit")
            offset = data.get("offset")
            limit = int(limit) if limit is not None else None
            offset = int(offset) if offset is not None else None
            records: List[Dict[str, Any]] = []
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                records = self.pdf_library_api.list_records(include_hidden=include_hidden, limit=limit, offset=offset)
            response = {
                "type": "pdf/list",
                "timestamp": int(time.time()),
                "data": {
                    "records": records,
                    "total": len(records),
                },
            }
            if request_id:
                response["request_id"] = request_id
            return response
        except Exception as exc:
            logger.error("获取 PDF 列表失败(v2): %s", exc, exc_info=True)
            return {
                "type": "error",
                "timestamp": int(time.time()),
                "request_id": request_id,
                "data": {
                    "message": "获取PDF列表失败",
                    "details": str(exc),
                },
            }
    def handle_pdf_list_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF列表请求"""
        try:
            files = self.pdf_manager.get_files()
            return PDFMessageBuilder.build_pdf_list_response(request_id, files)
        except Exception as e:
            logger.error(f"获取PDF列表失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "PDF_LIST_ERROR",
                f"获取PDF列表失败: {str(e)}"
            )

    def handle_pdf_search_request(self, request_id: str, data: Dict[str, Any], message_type: str, raw_message: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF搜索请求（v1/v2 兼容）

        - v1: type = 'pdf-home:search:pdf-files', 顶层携带 search_text
              响应使用标准 response 包，data = { files, search_text, total_count, original_type }
        - v2: type = 'pdf/search', data = { search_text, search_fields?, include_hidden?, limit?, offset? }
              响应使用类型化消息 'pdf/search'，data = { records, count, search_text }
        """
        try:
            # 兼容两种位置的 search_text
            search_text = ''
            if raw_message and isinstance(raw_message, dict) and isinstance(raw_message.get('search_text'), str):
                search_text = (raw_message.get('search_text') or '').strip()
            else:
                search_text = (data or {}).get('search_text') or ''
                if not isinstance(search_text, str):
                    search_text = ''
                search_text = search_text.strip()

            # 当无数据库API时，回退到内存PDFManager
            records: list = []
            total: int = 0
            used_backend = 'pdf_manager'

            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                try:
                    # 构造 search payload
                    tokens = [t for t in (search_text.split() if search_text else []) if t]
                    limit = None
                    offset = None
                    if isinstance(data, dict):
                        pagination = data.get('pagination') or {}
                        limit = pagination.get('limit')
                        offset = pagination.get('offset')
                        # 兼容简化字段
                        if limit is None:
                            limit = data.get('limit')
                        if offset is None:
                            offset = data.get('offset')
                    payload = {
                        'query': search_text,
                        'tokens': tokens,
                        'pagination': {
                            'limit': int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 500,
                            'offset': int(offset) if isinstance(offset, (int, str)) and str(offset).isdigit() else 0,
                            'need_total': True,
                        }
                    }
                    result = self.pdf_library_api.search_records(payload) or { 'records': [], 'total': 0 }
                    records = result.get('records') or []
                    total = int(result.get('total') or len(records))
                    used_backend = 'pdf_library_api'
                except Exception as exc:
                    logger.error("数据库搜索失败，回退到内存搜索: %s", exc, exc_info=True)

            if used_backend == 'pdf_manager':
                # 内存搜索：空搜索返回全部
                if not search_text:
                    records = self.pdf_manager.get_files()
                else:
                    # 仅支持单关键词模糊（保持最小可用）
                    results = self.pdf_manager.search_files(search_text)
                    # 转换为 records（结构与 list_records 接近）
                    records = results
                total = len(records)

            if message_type == 'pdf/search':
                # 返回类型化响应
                response = {
                    'type': 'pdf/search',
                    'timestamp': int(time.time()),
                    'request_id': request_id,
                    'status': 'success',
                    'code': 200,
                    'message': '搜索成功',
                    'data': {
                        'records': records,
                        'count': total,
                        'search_text': search_text
                    }
                }
                return response
            else:
                # 兼容旧响应（统一 response 包）
                return StandardMessageHandler.build_response(
                    'response',
                    request_id,
                    status='success',
                    code=200,
                    message='搜索成功',
                    data={
                        'files': records,
                        'search_text': search_text,
                        'total_count': total,
                        'original_type': 'pdf-home:search:pdf-files'
                    }
                )

        except Exception as e:
            logger.error("处理搜索请求时出错: %s", e, exc_info=True)
            if message_type == 'pdf/search':
                return StandardMessageHandler.build_error_response(
                    request_id,
                    'SEARCH_ERROR',
                    f'搜索失败: {str(e)}',
                    code=500
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    'SEARCH_ERROR',
                    f'搜索失败: {str(e)}',
                    code=500
                )
    
    def handle_pdf_upload_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF上传请求"""
        try:
            filepath = data.get("filepath")
            if not filepath:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的filepath参数"
                )
            
            success = self.pdf_manager.add_file(filepath)
            if success:
                # 获取刚添加的文件信息
                file_id = None
                filename = None
                file_size = 0
                
                files = self.pdf_manager.get_files()
                for file_info in files:
                    if "original_path" in file_info and file_info["original_path"] == filepath:
                        file_id = file_info["id"]
                        filename = file_info["filename"]
                        file_size = file_info.get("size", 0)
                        break
                
                return PDFMessageBuilder.build_pdf_upload_response(
                    request_id,
                    file_id or "unknown",
                    filename or os.path.basename(filepath),
                    file_size
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "UPLOAD_FAILED",
                    "PDF文件上传失败"
                )
                
        except Exception as e:
            logger.error(f"上传PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "UPLOAD_ERROR",
                f"上传PDF失败: {str(e)}"
            )
    
    def handle_pdf_remove_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF删除请求"""
        try:
            file_id = data.get("file_id")
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            success = self.pdf_manager.remove_file(file_id)
            if success:
                return PDFMessageBuilder.build_pdf_remove_response(request_id, file_id)
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "REMOVE_FAILED",
                    "PDF文件删除失败"
                )
                
        except Exception as e:
            logger.error(f"删除PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "REMOVE_ERROR",
                f"删除PDF失败: {str(e)}"
            )
    
    def handle_batch_pdf_remove_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF批量删除请求"""
        try:
            file_ids = data.get("file_ids")
            if not file_ids or not isinstance(file_ids, list):
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_ids参数或参数类型错误"
                )
            
            # 调用PDF管理器的批量删除方法
            result = self.pdf_manager.batch_remove_files(file_ids)
            success = result.get("success", False)
            if success:
                return PDFMessageBuilder.build_batch_pdf_remove_response(
                    request_id,
                    result["removed_files"],
                    result.get("failed_files")
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "BATCH_REMOVE_FAILED",
                    result.get("message", "PDF文件批量删除失败")
                )
                
        except Exception as e:
            logger.error(f"批量删除PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "BATCH_REMOVE_ERROR",
                f"批量删除PDF失败: {str(e)}"
            )
   
    #!/usr/bin/env python3
    """
    这包含了正确的handle_open_pdf_request方法
    """
    def handle_open_pdf_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理打开PDF的请求"""
        try:
            file_id = data.get("file_id")
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "Missing required file_id parameter"
                )

            # 调试应用引用状态
            logger.info(f"[DEBUG] 检查应用引用 - hasattr(self, 'app'): {hasattr(self, 'app')}")
            if hasattr(self, 'app'):
                logger.info(f"[DEBUG] self.app 是否为None: {self.app is None}")
                logger.info(f"[DEBUG] self.app 类型: {type(self.app)}")
                if self.app is not None:
                    logger.info(f"[DEBUG] self.app 具有 open_pdf_viewer_window 方法: {hasattr(self.app, 'open_pdf_viewer_window')}")
            else:
                logger.error("[DEBUG] self 对象没有 app 属性")
            # 检查应用引用是否可用
            if not hasattr(self, 'app') or self.app is None:
                logger.error("应用引用丢失，无法打开PDF查看器")
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "APP_REFERENCE_ERROR",
                    "Application reference not available"
                )

            # 直接调用应用打开PDF查看器窗口
            success = self.app.open_pdf_viewer_window(file_id)

            if success:
                return StandardMessageHandler.build_response(
                    "response",
                    request_id,
                    status="success",
                    code=200,
                    message=f"PDF viewer window opened successfully for {file_id}.",
                    data={"file_id": file_id, "opened": True}
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "OPEN_PDF_ERROR",
                    f"Failed to open PDF viewer window for {file_id}"
                )

        except Exception as e:
            logger.error(f"Failed to open PDF viewer: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "OPEN_PDF_ERROR",
                f"Failed to open PDF viewer: {str(e)}"
            )

    def handle_pdf_detail_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF详情请求"""
        try:
            file_id = data.get("file_id")
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            file_detail = self.pdf_manager.get_file_detail(file_id)
            if file_detail:
                return PDFMessageBuilder.build_pdf_detail_response(request_id, file_detail)
            else:
                return StandardMessageHandler.build_error_response(request_id, "FILE_NOT_FOUND", f"未找到文件ID为 {file_id} 的PDF文件")
        except Exception as e:
            logger.error(f"获取PDF详情失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "DETAIL_ERROR",
                f"获取PDF详情失败: {str(e)}"
            )

    def handle_pdf_update_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF更新请求"""
        try:
            file_id = data.get("file_id")
            updates = data.get("updates", {})

            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )

            if not updates:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少updates参数"
                )

            # 调用PDF管理器更新文件
            success = self.pdf_manager.update_file(file_id, updates)

            if success:
                # 广播列表更新
                self.on_pdf_list_changed()

                return StandardMessageHandler.build_response(
                    "response",
                    request_id,
                    status="success",
                    code=200,
                    message="PDF文件更新成功",
                    data={"file_id": file_id, "updates": updates}
                )
            else:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "UPDATE_FAILED",
                    "PDF文件更新失败"
                )

        except Exception as e:
            logger.error(f"更新PDF失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "UPDATE_ERROR",
                f"更新PDF失败: {str(e)}"
            )

    def handle_pdf_page_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF页面请求"""
        try:
            file_id = data.get("file_id")
            page_number = data.get("page_number")
            compression = data.get("compression", "zlib_base64")
            
            if not file_id or not page_number:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id或page_number参数"
                )
            
            # 获取页面数据
            page_data = page_transfer_manager.get_page(file_id, page_number, compression)
            
            return PDFMessageBuilder.build_pdf_page_response(
                request_id,
                file_id,
                page_number,
                page_data,
                compression
            )
            
        except Exception as e:
            logger.error(f"获取PDF页面失败: {e}")
            return PDFMessageBuilder.build_pdf_page_error_response(
                request_id,
                data.get("file_id", "unknown"),
                data.get("page_number", 0),
                "PAGE_EXTRACTION_ERROR",
                f"提取页面失败: {str(e)}",
                retryable=True
            )
    
    def handle_pdf_page_preload_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF页面预加载请求"""
        try:
            file_id = data.get("file_id")
            start_page = data.get("start_page", 1)
            end_page = data.get("end_page", 1)
            priority = data.get("priority", "low")
            
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            # 预加载页面
            preloaded_count = page_transfer_manager.preload_pages(file_id, start_page, end_page, priority)
            
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message=f"预加载完成，成功加载 {preloaded_count} 个页面",
                data={
                    "file_id": file_id,
                    "preloaded_count": preloaded_count,
                    "start_page": start_page,
                    "end_page": end_page
                }
            )
            
        except Exception as e:
            logger.error(f"预加载PDF页面失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "PRELOAD_ERROR",
                f"预加载页面失败: {str(e)}"
            )
    
    def handle_pdf_page_cache_clear_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF页面缓存清理请求"""
        try:
            file_id = data.get("file_id")
            keep_pages = data.get("keep_pages")
            
            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id,
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数"
                )
            
            # 清理缓存
            cleared_count = page_transfer_manager.clear_cache(file_id, keep_pages)
            
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message=f"缓存清理完成，清理了 {cleared_count} 个页面",
                data={
                    "file_id": file_id,
                    "cleared_count": cleared_count,
                    "keep_pages": keep_pages
                }
            )
            
        except Exception as e:
            logger.error(f"清理PDF页面缓存失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "CACHE_CLEAR_ERROR",
                f"清理缓存失败: {str(e)}"
            )

    def handle_console_log_request(self, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """处理前端console日志消息"""
        try:
            # 从数据中提取console日志信息
            source = data.get('source', 'unknown')
            level = data.get('level', 'log')
            timestamp = data.get('timestamp', '')
            log_message = data.get('message', '')

            # 格式化时间戳
            if timestamp:
                try:
                    import datetime
                    dt = datetime.datetime.fromtimestamp(timestamp / 1000)
                    formatted_time = dt.strftime('%H:%M:%S.%f')[:-3]
                except:
                    formatted_time = str(timestamp)
            else:
                formatted_time = ''

            # 格式化日志条目
            log_entry = f"[{formatted_time}][{level.upper()}][{source}] {log_message}"

            # 写入统一日志文件
            log_file_path = "logs/unified-console.log"

            # 确保日志目录存在
            os.makedirs(os.path.dirname(log_file_path), exist_ok=True)

            # 追加写入日志文件
            with open(log_file_path, 'a', encoding='utf-8') as f:
                f.write(log_entry + '\n')
                f.flush()  # 确保立即写入磁盘

            # 同时输出到后端日志（简化格式）
            logger.debug(f"[Console-{source}] {log_message}")

            # 返回成功响应
            return StandardMessageHandler.build_response(
                "response",
                request_id,
                status="success",
                code=200,
                message="Console log recorded successfully",
                data={"logged": True, "source": source, "level": level}
            )

        except Exception as e:
            logger.error(f"处理console日志失败: {e}")
            return StandardMessageHandler.build_error_response(
                request_id,
                "CONSOLE_LOG_ERROR",
                f"处理console日志失败: {str(e)}"
            )



    @pyqtSlot()
    def on_client_disconnected(self):
        """处理客户端断开连接"""
        client_socket = self.sender()
        if client_socket in self.clients:
            self.clients.remove(client_socket)
            logger.info(f"客户端断开连接: {client_socket.peerPort()}")
            self.client_disconnected.emit(client_socket)
    
    def on_socket_error(self, error):
        """处理WebSocket错误"""
        client_socket = self.sender()
        logger.error(f"WebSocket错误 from {client_socket.peerPort()}: {error}")
        if client_socket in self.clients:
            self.clients.remove(client_socket)
    
    # PDF管理器事件处理
    def on_pdf_file_added(self, file_info: Dict[str, Any]):
        """处理PDF文件添加事件"""
        logger.info(f"PDF文件添加事件: {file_info}")
        if hasattr(self, "pdf_library_api") and self.pdf_library_api:
            try:
                self.pdf_library_api.register_file_info(file_info)
            except Exception as exc:
                logger.error("同步文件信息到数据库失败: %s", exc)
        # 可以广播给所有客户端
        message = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS,
            data={
                "event": "file_added",
                "file_info": file_info,
                "file_count": self.pdf_manager.get_file_count()
            }
        )
        self.broadcast_message(message)
    
    def on_pdf_file_removed(self, file_id: str):
        """处理PDF文件删除事件"""
        logger.info(f"PDF文件删除事件: {file_id}")
        if hasattr(self, "pdf_library_api") and self.pdf_library_api:
            try:
                self.pdf_library_api.delete_record(file_id)
            except Exception as exc:
                logger.error("删除PDF数据库记录失败: %s", exc)
        message = StandardMessageHandler.build_base_message(
            MessageType.SYSTEM_STATUS,
            data={
                "event": "file_removed",
                "file_id": file_id,
                "file_count": self.pdf_manager.get_file_count()
            }
        )
        self.broadcast_message(message)
    
    def on_pdf_list_changed(self):
        """处理PDF列表变更事件"""
        logger.info("PDF列表变更事件")
        # 广播列表更新消息，让所有客户端重新获取列表
        try:
            files = self.pdf_manager.get_files()
            message = PDFMessageBuilder.build_pdf_list_response(
                request_id=None,
                files=files
            )
            # 修改消息类型为list，让前端识别为列表更新
            message["type"] = "list"
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                try:
                    records = self.pdf_library_api.list_records()
                    v2_message = {
                        "type": "pdf/list",
                        "timestamp": int(time.time()),
                        "data": {
                            "records": records,
                            "total": len(records),
                        },
                    }
                    self.broadcast_message(v2_message)
                except Exception as exc:
                    logger.error("广播新版PDF列表失败: %s", exc)
            self.broadcast_message(message)
            logger.info(f"已广播PDF列表更新消息，共 {len(files)} 个文件")
        except Exception as e:
            logger.error(f"广播列表更新失败: {e}")
    
    def send_message(self, client: QWebSocket, message: Dict[str, Any]) -> bool:
        """发送消息给指定客户端"""
        try:
            json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
            
            if client.state() == QAbstractSocket.SocketState.ConnectedState:
                client.sendTextMessage(json_message)
                logger.info(f"向客户端 {client.peerPort()} 发送消息: {message.get('type')}")
                return True
            else:
                logger.warning(f"客户端 {client.peerPort()} 未连接，无法发送消息")
                return False
                
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            return False
    
    def broadcast_message(self, message: Dict[str, Any]):
        """广播消息给所有客户端"""
        if not isinstance(message, dict):
            return
        
        json_message = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
        
        valid_clients = []
        sent_count = 0
        
        for client in self.clients:
            if client.state() == QAbstractSocket.SocketState.ConnectedState:
                try:
                    client.sendTextMessage(json_message)
                    valid_clients.append(client)
                    sent_count += 1
                except Exception as e:
                    logger.error(f"广播消息失败: {e}")
            else:
                logger.warning(f"客户端已断开，从列表中移除")
        
        self.clients = valid_clients
        logger.info(f"广播消息完成：成功发送给 {sent_count}/{len(self.clients)} 个客户端")
    
    def get_client_count(self):
        """获取当前连接的客户端数量"""
        return len(self.clients)
    
    def get_client_ids(self):
        """获取所有客户端ID列表"""
        return [f"client_{i}" for i in range(len(self.clients))]

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="Standard WebSocket Server")
    parser.add_argument("--port", type=int, help="Port to run the server on")
    args = parser.parse_args()

    # 必须先创建 QCoreApplication 实例
    app = QCoreApplication(sys.argv)

    setup_logging()
    port = get_port(args.port)

    server = StandardWebSocketServer(port=port, app=app)
    if server.start():
        logger.info("Starting Qt event loop.")
        sys.exit(app.exec())
    else:
        logger.error("Server failed to start. Exiting.")
        sys.exit(1)

if __name__ == "__main__":
    main()
