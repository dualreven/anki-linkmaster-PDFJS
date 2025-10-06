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

LEGACY_TYPE_MAPPING = {
    MessageType.LEGACY_PDF_LIBRARY_LIST.value: MessageType.PDF_LIBRARY_LIST_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_GET_PDF_LIST.value: MessageType.PDF_LIBRARY_LIST_REQUESTED.value,
    "get_pdf_list": MessageType.PDF_LIBRARY_LIST_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_ADD.value: MessageType.PDF_LIBRARY_ADD_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_ADD_PDF_FILES.value: MessageType.PDF_LIBRARY_ADD_REQUESTED.value,
    "add_pdf": MessageType.PDF_LIBRARY_ADD_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_REMOVE.value: MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_REMOVE_PDF_FILES.value: MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
    "remove_pdf": MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
    "batch_remove_pdf": MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_OPEN.value: MessageType.PDF_LIBRARY_VIEWER_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_OPEN_PDF_FILE.value: MessageType.PDF_LIBRARY_VIEWER_REQUESTED.value,
    "open_pdf": MessageType.PDF_LIBRARY_VIEWER_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_INFO.value: MessageType.PDF_LIBRARY_INFO_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_GET_PDF_INFO.value: MessageType.PDF_LIBRARY_INFO_REQUESTED.value,
    "pdf_detail_request": MessageType.PDF_LIBRARY_INFO_REQUESTED.value,
    MessageType.LEGACY_PDF_HOME_UPDATE_PDF.value: MessageType.PDF_LIBRARY_RECORD_UPDATE_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_SEARCH.value: MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value,
    "pdf-home:search:pdf-files": MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_GET_CONFIG.value: MessageType.PDF_LIBRARY_CONFIG_READ_REQUESTED.value,
    "pdf-home:get:config": MessageType.PDF_LIBRARY_CONFIG_READ_REQUESTED.value,
    MessageType.LEGACY_PDF_LIBRARY_UPDATE_CONFIG.value: MessageType.PDF_LIBRARY_CONFIG_WRITE_REQUESTED.value,
    "pdf-home:update:config": MessageType.PDF_LIBRARY_CONFIG_WRITE_REQUESTED.value,
    MessageType.LEGACY_BOOKMARK_LIST.value: MessageType.BOOKMARK_LIST_REQUESTED.value,
    MessageType.LEGACY_BOOKMARK_SAVE.value: MessageType.BOOKMARK_SAVE_REQUESTED.value,
}


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

from src.backend.api.pdf_library_api import PDFLibraryAPI  # type: ignore
# ServiceRegistry 可选导入：在未提供文件时采用最小桩以维持兼容
try:  # pragma: no cover - 兼容导入
    from src.backend.api.service_registry import ServiceRegistry  # type: ignore
except Exception:  # pragma: no cover - 提供最小桩
    class ServiceRegistry:  # type: ignore
        pass


class StandardWebSocketServer(QObject):
    """标准WebSocket服务器 - 支持JSON通信标准"""
    
    # 定义信号
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    message_received = pyqtSignal(QWebSocket, dict)
    
    def __init__(self, host="127.0.0.1", port=8765, app=None, *, pdf_library_api: Optional[PDFLibraryAPI] = None, service_registry: Optional[ServiceRegistry] = None):
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

        # API 门面/服务注册表（可注入）
        self.pdf_library_api = pdf_library_api
        if self.pdf_library_api is None:
            try:
                reg = service_registry if service_registry is not None else ServiceRegistry()
                self.pdf_library_api = PDFLibraryAPI(service_registry=reg, pdf_manager=self.pdf_manager)
            except Exception as exc:
                logger.warning("创建 PDFLibraryAPI 失败: %s", exc)
        
        # 连接信号
        self.server.newConnection.connect(self.on_new_connection)
        
        # 连接PDF管理器信号
        self.pdf_manager.file_added.connect(self.on_pdf_file_added)
        self.pdf_manager.file_removed.connect(self.on_pdf_file_removed)

    def _normalize_message_type(self, message_type: Optional[str]) -> str:
        if not message_type:
            return ""
        return LEGACY_TYPE_MAPPING.get(message_type, message_type)

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
            MessageType.SYSTEM_STATUS_UPDATED.value,
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
        original_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})
        normalized_type = self._normalize_message_type(original_type)

        # 降低 console_log 的日志量
        if original_type == "console_log":
            logger.debug("处理消息类型: %s（归一化: %s）, 请求ID: %s", original_type, normalized_type, request_id)
        else:
            logger.info("处理消息类型: %s（归一化: %s）, 请求ID: %s", original_type, normalized_type, request_id)

        if normalized_type == MessageType.PDF_LIBRARY_LIST_REQUESTED.value:
            return self.handle_pdf_list_request(request_id, data, original_type=original_type)
        if normalized_type == MessageType.BOOKMARK_LIST_REQUESTED.value:
            return self.handle_bookmark_list_request(request_id, data)
        if normalized_type == MessageType.BOOKMARK_SAVE_REQUESTED.value:
            return self.handle_bookmark_save_request(request_id, data)
        if normalized_type == MessageType.PDF_LIBRARY_ADD_REQUESTED.value:
            return self.handle_pdf_upload_request(request_id, data, original_type=original_type)
        if normalized_type == MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value:
            return self.handle_batch_pdf_remove_request(request_id, data, original_type=original_type)
        if normalized_type == MessageType.PDF_LIBRARY_VIEWER_REQUESTED.value:
            return self.handle_open_pdf_request(request_id, data)
        if normalized_type == MessageType.PDF_LIBRARY_INFO_REQUESTED.value:
            return self.handle_pdf_detail_request(request_id, data)
        if normalized_type == MessageType.PDF_LIBRARY_RECORD_UPDATE_REQUESTED.value:
            return self.handle_pdf_update_request(request_id, data)
        if normalized_type == MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value:
            return self.handle_pdf_search_request(request_id, data, message)
        if normalized_type == MessageType.PDF_LIBRARY_CONFIG_READ_REQUESTED.value:
            return self.handle_pdf_home_get_config(request_id)
        if normalized_type == MessageType.PDF_LIBRARY_CONFIG_WRITE_REQUESTED.value:
            return self.handle_pdf_home_update_config(request_id, data)
        # 能力注册中心
        if normalized_type == MessageType.CAPABILITY_DISCOVER_REQUESTED.value:
            return self.handle_capability_discover_request(request_id)
        if normalized_type == MessageType.CAPABILITY_DESCRIBE_REQUESTED.value:
            return self.handle_capability_describe_request(request_id, data)
        # 存储服务（KV）
        if normalized_type == MessageType.STORAGE_KV_GET_REQUESTED.value:
            return self.handle_storage_kv_get_request(request_id, data)
        if normalized_type == MessageType.STORAGE_KV_SET_REQUESTED.value:
            return self.handle_storage_kv_set_request(request_id, data)
        if normalized_type == MessageType.STORAGE_KV_DELETE_REQUESTED.value:
            return self.handle_storage_kv_delete_request(request_id, data)
        # 存储服务（FS）
        if normalized_type == MessageType.STORAGE_FS_READ_REQUESTED.value:
            return self.handle_storage_fs_read_request(request_id, data)
        if normalized_type == MessageType.STORAGE_FS_WRITE_REQUESTED.value:
            return self.handle_storage_fs_write_request(request_id, data)
        if normalized_type == MessageType.PDF_PAGE_LOAD_REQUESTED.value or original_type == MessageType.LEGACY_PDF_PAGE_REQUEST.value:
            return self.handle_pdf_page_request(request_id, data)
        if normalized_type == MessageType.PDF_PAGE_PRELOAD_REQUESTED.value or original_type == MessageType.LEGACY_PDF_PAGE_PRELOAD.value:
            return self.handle_pdf_page_preload_request(request_id, data)
        if normalized_type == MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED.value or original_type == MessageType.LEGACY_PDF_PAGE_CACHE_CLEAR.value:
            return self.handle_pdf_page_cache_clear_request(request_id, data)

        # Annotation domain
        if normalized_type == MessageType.ANNOTATION_LIST_REQUESTED.value:
            return self.handle_annotation_list_request(request_id, data)
        if normalized_type == MessageType.ANNOTATION_SAVE_REQUESTED.value:
            return self.handle_annotation_save_request(request_id, data)
        if normalized_type == MessageType.ANNOTATION_DELETE_REQUESTED.value:
            return self.handle_annotation_delete_request(request_id, data)

        if original_type == "console_log":
            return self.handle_console_log_request(request_id, data)

        if original_type in {MessageType.LEGACY_HEARTBEAT.value, MessageType.HEARTBEAT_REQUESTED.value, "heartbeat"}:
            return StandardMessageHandler.build_response(
                MessageType.HEARTBEAT_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="心跳响应",
                data={"timestamp": int(time.time())}
            )

        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "unknown_message_type",
            f"未知的消息类型: {original_type}",
            message_type=MessageType.LEGACY_ERROR,
            code=400
        )
    def handle_pdf_list_request(self, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
        try:
            limit = None
            offset = None
            if isinstance(data, dict):
                pg = data.get("pagination") or {}
                try:
                    limit = int(pg.get("limit")) if pg.get("limit") is not None else None
                except Exception:
                    limit = None
                try:
                    offset = int(pg.get("offset")) if pg.get("offset") is not None else None
                except Exception:
                    offset = None
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                files = self.pdf_library_api.list_records(limit=limit, offset=offset)
            else:
                files = self.pdf_manager.get_files() if hasattr(self, "pdf_manager") and self.pdf_manager else []
            return PDFMessageBuilder.build_pdf_list_response(
                request_id or StandardMessageHandler.generate_request_id(),
                files,
                pagination={"limit": limit, "offset": offset} if (limit is not None or offset is not None) else None,
            )
        except Exception as exc:
            logger.error("获取PDF列表失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "LIST_ERROR",
                f"获取PDF列表失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_LIST_FAILED,
                code=500,
            )

    def handle_pdf_detail_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            pdf_id = None
            if isinstance(data, dict):
                pdf_id = data.get("pdf_id") or data.get("file_id") or data.get("uuid")
            if not pdf_id:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 pdf_id/file_id/uuid 参数",
                    message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
                    code=400,
                )
            detail = None
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                detail = self.pdf_library_api.get_record_detail(pdf_id)
            if detail is None and hasattr(self, "pdf_manager") and self.pdf_manager:
                detail = self.pdf_manager.get_file_detail(pdf_id)
            if detail is None:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "NOT_FOUND",
                    f"未找到PDF: {pdf_id}",
                    message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
                    code=404,
                )
            return StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_INFO_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="PDF详情获取成功",
                data=detail,
            )
        except Exception as exc:
            logger.error("获取PDF详情失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "DETAIL_ERROR",
                f"获取PDF详情失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
                code=500,
            )

    def handle_batch_pdf_remove_request(self, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
        try:
            file_ids = []
            if isinstance(data, dict):
                file_ids = data.get("file_ids") or data.get("ids") or []
            if not isinstance(file_ids, list) or not file_ids:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 file_ids 列表",
                    message_type=MessageType.PDF_LIBRARY_REMOVE_FAILED,
                    code=400,
                )
            removed = []
            failed = {}
            for fid in file_ids:
                ok = False
                if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                    try:
                        ok = bool(self.pdf_library_api.delete_record(fid))
                    except Exception as exc:
                        ok = False
                        logger.warning("删除记录失败: %s", exc)
                if not ok and hasattr(self, "pdf_manager") and self.pdf_manager:
                    try:
                        ok = bool(self.pdf_manager.remove_file(fid))
                    except Exception as exc:
                        ok = False
                        logger.warning("删除文件失败: %s", exc)
                if ok:
                    removed.append(fid)
                else:
                    failed[str(fid)] = "删除失败"
            return PDFMessageBuilder.build_batch_pdf_remove_response(
                request_id or StandardMessageHandler.generate_request_id(),
                removed,
                failed_files=failed or None,
            )
        except Exception as exc:
            logger.error("批量删除失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "REMOVE_ERROR",
                f"批量删除失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_REMOVE_FAILED,
                code=500,
            )

    def handle_open_pdf_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            pdf_id = (data or {}).get("pdf_id") or (data or {}).get("file_id")
            payload = {"file_id": pdf_id} if pdf_id else {}
            # 最小实现：仅回执完成。实际窗口打开应由上层应用集成。
            return StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_VIEWER_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="查看器请求已接收",
                data=payload,
            )
        except Exception as exc:
            logger.error("打开查看器失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "VIEWER_ERROR",
                f"打开查看器失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_VIEWER_FAILED,
                code=500,
            )

    def _kv_store_load(self) -> Dict[str, Any]:
        store_dir = os.path.join(project_root, "data")
        os.makedirs(store_dir, exist_ok=True)
        store_path = os.path.join(store_dir, "storage-kv.json")
        store: Dict[str, Any] = {}
        if os.path.exists(store_path):
            with open(store_path, "r", encoding="utf-8") as f:
                try:
                    store = json.load(f) or {}
                except Exception:
                    store = {}
        return store

    def _kv_store_save(self, store: Dict[str, Any]) -> None:
        store_dir = os.path.join(project_root, "data")
        os.makedirs(store_dir, exist_ok=True)
        store_path = os.path.join(store_dir, "storage-kv.json")
        with open(store_path, "w", encoding="utf-8", newline='\n') as f:
            json.dump(store, f, ensure_ascii=False, indent=2)
    def handle_pdf_upload_request(self, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
        """处理 PDF 添加请求（兼容门面）。"""
        try:
            if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "SERVICE_UNAVAILABLE",
                    "PDFLibraryAPI 未初始化",
                    message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                    code=503,
                )
            filepath = (data or {}).get("filepath")
            if not filepath:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 filepath 参数",
                    message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                    code=400,
                )
            result = self.pdf_library_api.add_pdf_from_file(filepath)
            if result and result.get("success"):
                file_payload = {
                    "id": result.get("uuid"),
                    "filename": result.get("filename"),
                    "file_size": result.get("file_size"),
                }
                return StandardMessageHandler.build_response(
                    MessageType.PDF_LIBRARY_ADD_COMPLETED,
                    request_id or StandardMessageHandler.generate_request_id(),
                    status="success",
                    code=200,
                    message="添加PDF成功",
                    data={"file": file_payload, "original_type": original_type or MessageType.PDF_LIBRARY_ADD_REQUESTED.value},
                )
            else:
                err_msg = (result or {}).get("error") or "添加 PDF 失败"
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "PDF_ADD_ERROR",
                    err_msg,
                    message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                    code=400,
                )
        except Exception as exc:
            logger.error("添加PDF失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INTERNAL_ERROR",
                f"添加PDF失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                code=500,
            )

    def handle_pdf_search_request(self, request_id: Optional[str], data: Dict[str, Any], raw_message: Dict[str, Any]) -> Dict[str, Any]:
        """处理 PDF 搜索请求，适配统一契约。"""
        try:
            if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "SERVICE_UNAVAILABLE",
                    "PDFLibraryAPI 未初始化",
                    message_type=MessageType.PDF_LIBRARY_SEARCH_FAILED,
                    code=503,
                )
            query = "" if not isinstance(data, dict) else str(data.get("query", "") or "")
            try:
                limit = int(data.get("limit", 50)) if isinstance(data, dict) else 50
            except Exception:
                limit = 50
            try:
                offset = int(data.get("offset", 0)) if isinstance(data, dict) else 0
            except Exception:
                offset = 0
            payload = {
                "query": query,
                "pagination": {"limit": limit, "offset": offset, "need_total": True},
            }
            search_result = self.pdf_library_api.search_records(payload)
            items = []
            for rec in search_result.get("records", []):
                items.append({
                    "pdf_id": rec.get("id"),
                    "title": rec.get("title"),
                    "page_count": rec.get("page_count"),
                    "tags": rec.get("tags", []),
                })
            data_payload = {"items": items}
            if "total" in search_result:
                data_payload["total"] = search_result.get("total")
            return StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_SEARCH_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="搜索成功",
                data=data_payload,
            )
        except Exception as exc:
            logger.error("搜索失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SEARCH_ERROR",
                f"搜索失败: {exc}",
                message_type=MessageType.PDF_LIBRARY_SEARCH_FAILED,
                code=500,
            )
    def handle_capability_discover_request(self, request_id: Optional[str]) -> Dict[str, Any]:
        try:
            domains = [
                {
                    "name": "capability",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.CAPABILITY_DISCOVER_REQUESTED.value,
                        MessageType.CAPABILITY_DISCOVER_COMPLETED.value,
                        MessageType.CAPABILITY_DISCOVER_FAILED.value,
                        MessageType.CAPABILITY_DESCRIBE_REQUESTED.value,
                        MessageType.CAPABILITY_DESCRIBE_COMPLETED.value,
                        MessageType.CAPABILITY_DESCRIBE_FAILED.value,
                    ],
                },
                {
                    "name": "pdf-library",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.PDF_LIBRARY_LIST_REQUESTED.value,
                        MessageType.PDF_LIBRARY_LIST_COMPLETED.value,
                        MessageType.PDF_LIBRARY_LIST_FAILED.value,
                        MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value,
                        MessageType.PDF_LIBRARY_SEARCH_COMPLETED.value,
                        MessageType.PDF_LIBRARY_SEARCH_FAILED.value,
                        MessageType.PDF_LIBRARY_ADD_REQUESTED.value,
                        MessageType.PDF_LIBRARY_ADD_COMPLETED.value,
                        MessageType.PDF_LIBRARY_ADD_FAILED.value,
                        MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
                        MessageType.PDF_LIBRARY_REMOVE_COMPLETED.value,
                        MessageType.PDF_LIBRARY_REMOVE_FAILED.value,
                        MessageType.PDF_LIBRARY_INFO_REQUESTED.value,
                        MessageType.PDF_LIBRARY_INFO_COMPLETED.value,
                        MessageType.PDF_LIBRARY_INFO_FAILED.value,
                    ],
                },
                {
                    "name": "storage-kv",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.STORAGE_KV_GET_REQUESTED.value,
                        MessageType.STORAGE_KV_GET_COMPLETED.value,
                        MessageType.STORAGE_KV_GET_FAILED.value,
                        MessageType.STORAGE_KV_SET_REQUESTED.value,
                        MessageType.STORAGE_KV_SET_COMPLETED.value,
                        MessageType.STORAGE_KV_SET_FAILED.value,
                        MessageType.STORAGE_KV_DELETE_REQUESTED.value,
                        MessageType.STORAGE_KV_DELETE_COMPLETED.value,
                        MessageType.STORAGE_KV_DELETE_FAILED.value,
                    ],
                },
                {
                    "name": "storage-fs",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.STORAGE_FS_READ_REQUESTED.value,
                        MessageType.STORAGE_FS_READ_COMPLETED.value,
                        MessageType.STORAGE_FS_READ_FAILED.value,
                        MessageType.STORAGE_FS_WRITE_REQUESTED.value,
                        MessageType.STORAGE_FS_WRITE_COMPLETED.value,
                        MessageType.STORAGE_FS_WRITE_FAILED.value,
                    ],
                },
                {
                    "name": "bookmark",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.BOOKMARK_LIST_REQUESTED.value,
                        MessageType.BOOKMARK_LIST_COMPLETED.value,
                        MessageType.BOOKMARK_LIST_FAILED.value,
                        MessageType.BOOKMARK_SAVE_REQUESTED.value,
                        MessageType.BOOKMARK_SAVE_COMPLETED.value,
                        MessageType.BOOKMARK_SAVE_FAILED.value,
                    ],
                },
                {
                    "name": "pdf-page",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.PDF_PAGE_LOAD_REQUESTED.value,
                        MessageType.PDF_PAGE_LOAD_COMPLETED.value,
                        MessageType.PDF_PAGE_LOAD_FAILED.value,
                        MessageType.PDF_PAGE_PRELOAD_REQUESTED.value,
                        MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED.value,
                    ],
                },
                {
                    "name": "system",
                    "versions": ["1.0.0"],
                    "events": [
                        MessageType.HEARTBEAT_REQUESTED.value,
                        MessageType.HEARTBEAT_COMPLETED.value,
                        MessageType.SYSTEM_STATUS_UPDATED.value,
                        MessageType.SYSTEM_ERROR_OCCURRED.value,
                    ],
                },
            ]
            return StandardMessageHandler.build_response(
                MessageType.CAPABILITY_DISCOVER_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="capability discovered",
                data={"domains": domains},
            )
        except Exception as exc:
            logger.error("能力发现失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "CAPABILITY_DISCOVER_ERROR",
                f"能力发现失败: {exc}",
                message_type=MessageType.CAPABILITY_DISCOVER_FAILED,
                code=500,
            )

    def handle_capability_describe_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            domain = (data or {}).get("domain")
            if not domain:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 domain 参数",
                    message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
                    code=400,
                )

            # 契约样例位置（与 todo-and-doing 目录保持一致）
            schema_root = os.path.join(
                project_root,
                "todo-and-doing",
                "1 doing",
                "20251006182000-bus-contract-capability-registry",
                "schemas",
            )

            def schema_info(rel_path: str) -> Dict[str, Any]:
                full = os.path.join(schema_root, rel_path)
                try:
                    # 显式 UTF-8 读取并计算 sha256
                    import hashlib
                    with open(full, "r", encoding="utf-8") as f:
                        content = f.read()
                    sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
                except Exception:
                    sha = None
                return {"path": os.path.relpath(full, project_root).replace("\\", "/"), "schemaHash": sha}

            described = {"domain": domain, "version": "1.0.0", "events": []}

            if domain == "capability":
                described["events"] = [
                    {
                        "type": MessageType.CAPABILITY_DISCOVER_REQUESTED.value,
                        "schema": schema_info("capability/v1/messages/discover.request.schema.json"),
                    },
                    {
                        "type": MessageType.CAPABILITY_DISCOVER_COMPLETED.value,
                        "schema": schema_info("capability/v1/messages/discover.completed.schema.json"),
                    },
                ]
            elif domain == "pdf-library":
                described["events"] = [
                    {"type": MessageType.PDF_LIBRARY_LIST_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/list.request.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_LIST_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/list.completed.schema.json")},
                    {
                        "type": MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value,
                        "schema": schema_info("pdf-library/v1/messages/search.request.schema.json"),
                    },
                    {
                        "type": MessageType.PDF_LIBRARY_SEARCH_COMPLETED.value,
                        "schema": schema_info("pdf-library/v1/messages/search.completed.schema.json"),
                    },
                    {"type": MessageType.PDF_LIBRARY_ADD_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/add.request.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_ADD_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/add.completed.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/remove.request.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_REMOVE_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/remove.completed.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_INFO_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/info.request.schema.json")},
                    {"type": MessageType.PDF_LIBRARY_INFO_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/info.completed.schema.json")},
                ]
            elif domain == "storage-kv":
                described["events"] = [
                    {
                        "type": MessageType.STORAGE_KV_GET_REQUESTED.value,
                        "schema": schema_info("storage-kv/v1/messages/get.request.schema.json"),
                    },
                    {
                        "type": MessageType.STORAGE_KV_GET_COMPLETED.value,
                        "schema": schema_info("storage-kv/v1/messages/get.completed.schema.json"),
                    },
                    {"type": MessageType.STORAGE_KV_SET_REQUESTED.value, "schema": schema_info("storage-kv/v1/messages/set.request.schema.json")},
                    {"type": MessageType.STORAGE_KV_SET_COMPLETED.value, "schema": schema_info("storage-kv/v1/messages/set.completed.schema.json")},
                    {"type": MessageType.STORAGE_KV_DELETE_REQUESTED.value, "schema": schema_info("storage-kv/v1/messages/delete.request.schema.json")},
                    {"type": MessageType.STORAGE_KV_DELETE_COMPLETED.value, "schema": schema_info("storage-kv/v1/messages/delete.completed.schema.json")},
                ]
            elif domain == "storage-fs":
                described["events"] = [
                    {"type": MessageType.STORAGE_FS_READ_REQUESTED.value, "schema": schema_info("storage-fs/v1/messages/read.request.schema.json")},
                    {"type": MessageType.STORAGE_FS_READ_COMPLETED.value, "schema": schema_info("storage-fs/v1/messages/read.completed.schema.json")},
                    {"type": MessageType.STORAGE_FS_WRITE_REQUESTED.value, "schema": schema_info("storage-fs/v1/messages/write.request.schema.json")},
                    {"type": MessageType.STORAGE_FS_WRITE_COMPLETED.value, "schema": schema_info("storage-fs/v1/messages/write.completed.schema.json")},
                ]
            elif domain == "annotation":
                described["events"] = [
                    {"type": MessageType.ANNOTATION_LIST_REQUESTED.value, "schema": schema_info("annotation/v1/messages/list.request.schema.json")},
                    {"type": MessageType.ANNOTATION_LIST_COMPLETED.value, "schema": schema_info("annotation/v1/messages/list.completed.schema.json")},
                    {"type": MessageType.ANNOTATION_SAVE_REQUESTED.value, "schema": schema_info("annotation/v1/messages/save.request.schema.json")},
                    {"type": MessageType.ANNOTATION_SAVE_COMPLETED.value, "schema": schema_info("annotation/v1/messages/save.completed.schema.json")},
                    {"type": MessageType.ANNOTATION_DELETE_REQUESTED.value, "schema": schema_info("annotation/v1/messages/delete.request.schema.json")},
                    {"type": MessageType.ANNOTATION_DELETE_COMPLETED.value, "schema": schema_info("annotation/v1/messages/delete.completed.schema.json")},
                ]
            elif domain == "bookmark":
                described["events"] = [
                    {"type": MessageType.BOOKMARK_LIST_REQUESTED.value},
                    {"type": MessageType.BOOKMARK_LIST_COMPLETED.value},
                    {"type": MessageType.BOOKMARK_LIST_FAILED.value},
                    {"type": MessageType.BOOKMARK_SAVE_REQUESTED.value},
                    {"type": MessageType.BOOKMARK_SAVE_COMPLETED.value},
                    {"type": MessageType.BOOKMARK_SAVE_FAILED.value},
                ]
            elif domain == "pdf-page":
                described["events"] = [
                    {"type": MessageType.PDF_PAGE_LOAD_REQUESTED.value},
                    {"type": MessageType.PDF_PAGE_LOAD_COMPLETED.value},
                    {"type": MessageType.PDF_PAGE_LOAD_FAILED.value},
                    {"type": MessageType.PDF_PAGE_PRELOAD_REQUESTED.value},
                    {"type": MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED.value},
                ]
            elif domain == "system":
                described["events"] = [
                    {"type": MessageType.HEARTBEAT_REQUESTED.value},
                    {"type": MessageType.HEARTBEAT_COMPLETED.value},
                    {"type": MessageType.SYSTEM_STATUS_UPDATED.value},
                    {"type": MessageType.SYSTEM_ERROR_OCCURRED.value},
                ]
            else:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "DOMAIN_NOT_FOUND",
                    f"未知 domain: {domain}",
                    message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
                    code=404,
                )

            return StandardMessageHandler.build_response(
                MessageType.CAPABILITY_DESCRIBE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="capability describe",
                data=described,
            )
        except Exception as exc:
            logger.error("能力描述失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "CAPABILITY_DESCRIBE_ERROR",
                f"能力描述失败: {exc}",
                message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
                code=500,
            )

    def handle_storage_kv_get_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            ns = (data or {}).get("namespace")
            key = (data or {}).get("key")
            if not ns or not key:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 namespace 或 key 参数",
                    message_type=MessageType.STORAGE_KV_GET_FAILED,
                    code=400,
                )
            store = self._kv_store_load()
            value = (store.get(ns) or {}).get(key)
            return StandardMessageHandler.build_response(
                MessageType.STORAGE_KV_GET_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="kv get",
                data={"value": value},
            )
        except Exception as exc:
            logger.error("KV读取失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "STORAGE_KV_ERROR",
                f"KV读取失败: {exc}",
                message_type=MessageType.STORAGE_KV_GET_FAILED,
                code=500,
            )

    def handle_storage_kv_set_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            ns = (data or {}).get("namespace")
            key = (data or {}).get("key")
            value = (data or {}).get("value")
            if not ns or not key:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 namespace 或 key 参数",
                    message_type=MessageType.STORAGE_KV_SET_FAILED,
                    code=400,
                )
            store = self._kv_store_load()
            bucket = store.get(ns) or {}
            bucket[key] = value
            store[ns] = bucket
            self._kv_store_save(store)
            return StandardMessageHandler.build_response(
                MessageType.STORAGE_KV_SET_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="kv set",
                data={"ok": True},
            )
        except Exception as exc:
            logger.error("KV写入失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "STORAGE_KV_ERROR",
                f"KV写入失败: {exc}",
                message_type=MessageType.STORAGE_KV_SET_FAILED,
                code=500,
            )

    def handle_storage_kv_delete_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            ns = (data or {}).get("namespace")
            key = (data or {}).get("key")
            if not ns or not key:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 namespace 或 key 参数",
                    message_type=MessageType.STORAGE_KV_DELETE_FAILED,
                    code=400,
                )
            store = self._kv_store_load()
            if ns in store and isinstance(store[ns], dict) and key in store[ns]:
                del store[ns][key]
                if not store[ns]:
                    del store[ns]
                self._kv_store_save(store)
            return StandardMessageHandler.build_response(
                MessageType.STORAGE_KV_DELETE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="kv delete",
                data={"ok": True},
            )
        except Exception as exc:
            logger.error("KV删除失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "STORAGE_KV_ERROR",
                f"KV删除失败: {exc}",
                message_type=MessageType.STORAGE_KV_DELETE_FAILED,
                code=500,
            )

    def handle_storage_fs_read_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            import base64
            rel_path = (data or {}).get("path")
            if not rel_path:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 path 参数",
                    message_type=MessageType.STORAGE_FS_READ_FAILED,
                    code=400,
                )
            base_dir = os.path.join(project_root, "data", "fs")
            os.makedirs(base_dir, exist_ok=True)
            norm = os.path.normpath(rel_path).replace("\\", "/")
            if norm.startswith(".."):
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_PATH",
                    "禁止访问上级目录",
                    message_type=MessageType.STORAGE_FS_READ_FAILED,
                    code=400,
                )
            abs_path = os.path.join(base_dir, norm)
            if not os.path.exists(abs_path):
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "NOT_FOUND",
                    f"文件不存在: {norm}",
                    message_type=MessageType.STORAGE_FS_READ_FAILED,
                    code=404,
                )
            with open(abs_path, "rb") as f:
                content = f.read()
            b64 = base64.b64encode(content).decode("utf-8")
            return StandardMessageHandler.build_response(
                MessageType.STORAGE_FS_READ_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="fs read",
                data={"path": norm, "content": b64},
            )
        except Exception as exc:
            logger.error("FS读取失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "STORAGE_FS_ERROR",
                f"FS读取失败: {exc}",
                message_type=MessageType.STORAGE_FS_READ_FAILED,
                code=500,
            )

    def handle_storage_fs_write_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            import base64
            rel_path = (data or {}).get("path")
            content_b64 = (data or {}).get("content")
            overwrite = bool((data or {}).get("overwrite", True))
            if not rel_path or content_b64 is None:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 path 或 content 参数",
                    message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                    code=400,
                )
            base_dir = os.path.join(project_root, "data", "fs")
            os.makedirs(base_dir, exist_ok=True)
            norm = os.path.normpath(rel_path).replace("\\", "/")
            if norm.startswith(".."):
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_PATH",
                    "禁止写入上级目录",
                    message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                    code=400,
                )
            abs_path = os.path.join(base_dir, norm)
            if (not overwrite) and os.path.exists(abs_path):
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "ALREADY_EXISTS",
                    f"文件已存在: {norm}",
                    message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                    code=409,
                )
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            content = base64.b64decode(content_b64.encode("utf-8"))
            with open(abs_path, "wb") as f:
                f.write(content)
            return StandardMessageHandler.build_response(
                MessageType.STORAGE_FS_WRITE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="fs write",
                data={"path": norm, "bytes": len(content)},
            )
        except Exception as exc:
            logger.error("FS写入失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "STORAGE_FS_ERROR",
                f"FS写入失败: {exc}",
                message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                code=500,
            )
    def handle_bookmark_list_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.BOOKMARK_LIST_FAILED,
                code=503
            )
        pdf_uuid = (data or {}).get("pdf_uuid")
        if not pdf_uuid:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 pdf_uuid 参数",
                message_type=MessageType.BOOKMARK_LIST_FAILED,
                code=400
            )
        try:
            result = self.pdf_library_api.list_bookmarks(pdf_uuid)
            return StandardMessageHandler.build_response(
                MessageType.BOOKMARK_LIST_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="书签获取成功",
                data=result
            )
        except Exception as exc:
            logger.error("获取书签失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "BOOKMARK_LIST_ERROR",
                f"获取书签失败: {exc}",
                message_type=MessageType.BOOKMARK_LIST_FAILED,
                code=500
            )

    def handle_bookmark_save_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.BOOKMARK_SAVE_FAILED,
                code=503
            )
        payload = data or {}
        pdf_uuid = payload.get("pdf_uuid")
        bookmarks = payload.get("bookmarks")
        root_ids = payload.get("root_ids")
        if not pdf_uuid:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 pdf_uuid 参数",
                message_type=MessageType.BOOKMARK_SAVE_FAILED,
                code=400
            )
        if not isinstance(bookmarks, list):
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "bookmarks 必须为数组",
                message_type=MessageType.BOOKMARK_SAVE_FAILED,
                code=400
            )
        try:
            saved = self.pdf_library_api.save_bookmarks(pdf_uuid, bookmarks, root_ids=root_ids)
            return StandardMessageHandler.build_response(
                MessageType.BOOKMARK_SAVE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="书签保存成功",
                data={"saved": saved}
            )
        except Exception as exc:
            logger.error("保存书签失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "BOOKMARK_SAVE_ERROR",
                f"保存书签失败: {exc}",
                message_type=MessageType.BOOKMARK_SAVE_FAILED,
                code=500
            )

    def handle_bookmark_reset_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        payload = data or {}
        pdf_uuid = payload.get('pdf_uuid')
        if not pdf_uuid:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 pdf_uuid 参数",
                message_type=MessageType.BOOKMARK_LIST_FAILED,
                code=400
            )
        try:
            cleared = 0
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                cleared = self.pdf_library_api.clear_bookmarks(pdf_uuid)
            return StandardMessageHandler.build_response(
                MessageType.BOOKMARK_LIST_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="书签已清空",
                data={"cleared": int(cleared)}
            )
        except Exception as exc:
            logger.error("重置书签失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "BOOKMARK_RESET_ERROR",
                f"重置书签失败: {exc}",
                message_type=MessageType.BOOKMARK_LIST_FAILED,
                code=500
            )

    # ==================== Annotation handlers ====================
    def _iso_to_ms(self, value: Optional[str]) -> int:
        try:
            if value is None:
                return int(time.time() * 1000)
            # If already integer-like
            try:
                return int(value)
            except Exception:
                pass
            # Parse ISO 8601
            from datetime import datetime
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            return int(dt.timestamp() * 1000)
        except Exception:
            return int(time.time() * 1000)

    def _ms_to_iso(self, ms: Optional[int]) -> str:
        try:
            if ms is None:
                ms = int(time.time() * 1000)
            from datetime import datetime, timezone
            return datetime.fromtimestamp(int(ms)/1000.0, tz=timezone.utc).isoformat().replace('+00:00', 'Z')
        except Exception:
            return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

    def handle_annotation_list_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "SERVICE_UNAVAILABLE",
                    "PDFLibraryAPI 未初始化",
                    message_type=MessageType.ANNOTATION_LIST_FAILED,
                    code=503,
                )
            pdf_uuid = (data or {}).get('pdf_uuid')
            if not pdf_uuid:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 pdf_uuid 参数",
                    message_type=MessageType.ANNOTATION_LIST_FAILED,
                    code=400,
                )
            rows = self.pdf_library_api._annotation_plugin.query_by_pdf(pdf_uuid)
            annotations = []
            for row in rows:
                annotations.append({
                    'id': row.get('ann_id'),
                    'pdfId': row.get('pdf_uuid'),
                    'type': row.get('type'),
                    'pageNumber': row.get('page_number'),
                    'data': row.get('data') or {},
                    'comments': row.get('comments') or [],
                    'createdAt': self._ms_to_iso(row.get('created_at')),
                    'updatedAt': self._ms_to_iso(row.get('updated_at')),
                })
            return StandardMessageHandler.build_response(
                MessageType.ANNOTATION_LIST_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status='success',
                code=200,
                message='标注列表获取成功',
                data={'annotations': annotations, 'count': len(annotations)}
            )
        except Exception as exc:
            logger.error("获取标注失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "ANNOTATION_LIST_ERROR",
                f"标注获取失败: {exc}",
                message_type=MessageType.ANNOTATION_LIST_FAILED,
                code=500,
            )

    def handle_annotation_save_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "SERVICE_UNAVAILABLE",
                    "PDFLibraryAPI 未初始化",
                    message_type=MessageType.ANNOTATION_SAVE_FAILED,
                    code=503,
                )
            payload = data or {}
            pdf_uuid = payload.get('pdf_uuid')
            annotation = payload.get('annotation') or {}
            if not pdf_uuid:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 pdf_uuid 参数",
                    message_type=MessageType.ANNOTATION_SAVE_FAILED,
                    code=400,
                )
            if not isinstance(annotation, dict) or not annotation:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 annotation 对象",
                    message_type=MessageType.ANNOTATION_SAVE_FAILED,
                    code=400,
                )

            ann_id = annotation.get('id')
            page_number = annotation.get('pageNumber')
            ann_type = annotation.get('type')
            json_data = {
                'data': annotation.get('data') or {},
                'comments': annotation.get('comments') or [],
            }
            created_ms = self._iso_to_ms(annotation.get('createdAt'))
            updated_ms = self._iso_to_ms(annotation.get('updatedAt'))

            created = False
            updated = False

            if ann_id and self.pdf_library_api._annotation_plugin.query_by_id(ann_id):
                # update
                updated = self.pdf_library_api._annotation_plugin.update(ann_id, {
                    'pdf_uuid': pdf_uuid,
                    'page_number': page_number,
                    'type': ann_type,
                    'created_at': created_ms,
                    'updated_at': updated_ms,
                    'json_data': json_data,
                })
            else:
                # insert
                import random, string
                rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                row = {
                    'ann_id': ann_id or f"ann_{int(time.time()*1000)}_{rand}",
                    'pdf_uuid': pdf_uuid,
                    'page_number': page_number,
                    'type': ann_type,
                    'created_at': created_ms,
                    'updated_at': updated_ms,
                    'version': 1,
                    'json_data': json_data,
                }
                ann_id = self.pdf_library_api._annotation_plugin.insert(row)
                created = True

            return StandardMessageHandler.build_response(
                MessageType.ANNOTATION_SAVE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status='success',
                code=200,
                message='标注保存成功',
                data={'id': ann_id, 'created': bool(created), 'updated': bool(updated)}
            )
        except Exception as exc:
            logger.error("保存标注失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "ANNOTATION_SAVE_ERROR",
                f"保存标注失败: {exc}",
                message_type=MessageType.ANNOTATION_SAVE_FAILED,
                code=500,
            )

    def handle_annotation_delete_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if not hasattr(self, "pdf_library_api") or not self.pdf_library_api:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "SERVICE_UNAVAILABLE",
                    "PDFLibraryAPI 未初始化",
                    message_type=MessageType.ANNOTATION_DELETE_FAILED,
                    code=503,
                )
            ann_id = (data or {}).get('ann_id') or (data or {}).get('id')
            if not ann_id:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少 ann_id 参数",
                    message_type=MessageType.ANNOTATION_DELETE_FAILED,
                    code=400,
                )
            ok = self.pdf_library_api._annotation_plugin.delete(ann_id)
            return StandardMessageHandler.build_response(
                MessageType.ANNOTATION_DELETE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status='success',
                code=200,
                message='标注删除成功',
                data={'ok': bool(ok)}
            )
        except Exception as exc:
            logger.error("删除标注失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "ANNOTATION_DELETE_ERROR",
                f"删除标注失败: {exc}",
                message_type=MessageType.ANNOTATION_DELETE_FAILED,
                code=500,
            )
    def _get_pdf_home_config_path(self) -> str:
        try:
            data_dir = getattr(self.pdf_manager, 'data_dir', 'data') or 'data'
        except Exception:
            data_dir = 'data'
        os.makedirs(data_dir, exist_ok=True)
        return os.path.join(data_dir, 'pdf-home-config.json')

    def handle_pdf_home_get_config(self, request_id: Optional[str]) -> Dict[str, Any]:
        try:
            cfg_path = self._get_pdf_home_config_path()
            config_obj = {"recent_search": []}
            if os.path.exists(cfg_path):
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    try:
                        loaded = json.load(f)
                        if isinstance(loaded, dict):
                            config_obj.update(loaded)
                    except Exception as exc:
                        logger.warning("配置文件解析失败，使用默认对象: %s", exc, exc_info=True)
            else:
                with open(cfg_path, 'w', encoding='utf-8', newline='\n') as f:
                    json.dump(config_obj, f, ensure_ascii=False, indent=2)

            response = StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_CONFIG_READ_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status='success',
                code=200,
                message='读取配置成功',
                data={
                    'config': config_obj,
                    'original_type': MessageType.PDF_LIBRARY_CONFIG_READ_REQUESTED.value
                }
            )
            return response
        except Exception as e:
            logger.error("读取配置失败: %s", e, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                'INTERNAL_ERROR',
                f'读取配置失败: {e}',
                message_type=MessageType.PDF_LIBRARY_CONFIG_READ_FAILED,
                code=500
            )
    def handle_pdf_home_update_config(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            cfg_path = self._get_pdf_home_config_path()
            config_obj = {"recent_search": []}
            if os.path.exists(cfg_path):
                with open(cfg_path, 'r', encoding='utf-8') as f:
                    try:
                        loaded = json.load(f)
                        if isinstance(loaded, dict):
                            config_obj.update(loaded)
                    except Exception as exc:
                        logger.warning("配置文件解析失败，将覆盖为新配置: %s", exc, exc_info=True)

            recent = (data or {}).get('recent_search')
            if isinstance(recent, list):
                cleaned = []
                for it in recent:
                    if isinstance(it, dict) and isinstance(it.get('text'), str):
                        cleaned.append({'text': it.get('text', ''), 'ts': it.get('ts') or 0})
                config_obj['recent_search'] = cleaned

            with open(cfg_path, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(config_obj, f, ensure_ascii=False, indent=2)

            response = StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_CONFIG_WRITE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status='success',
                code=200,
                message='更新配置成功',
                data={
                    'config': config_obj,
                    'original_type': MessageType.PDF_LIBRARY_CONFIG_WRITE_REQUESTED.value
                }
            )
            return response
        except Exception as e:
            logger.error("更新配置失败: %s", e, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                'INTERNAL_ERROR',
                f'更新配置失败: {e}',
                message_type=MessageType.PDF_LIBRARY_CONFIG_WRITE_FAILED,
                code=500
            )
    def handle_pdf_update_request(self, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
        """处理PDF更新请求"""
        try:
            file_id = data.get("file_id") if isinstance(data, dict) else None
            updates = data.get("updates", {}) if isinstance(data, dict) else {}

            if not file_id:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少必需的file_id参数",
                    message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                    code=400
                )

            if not updates:
                return StandardMessageHandler.build_error_response(
                    request_id or "unknown",
                    "INVALID_REQUEST",
                    "缺少updates参数",
                    message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                    code=400
                )

            success = self.pdf_manager.update_file(file_id, updates)

            if success:
                self.on_pdf_list_changed()
                return StandardMessageHandler.build_response(
                    MessageType.PDF_LIBRARY_RECORD_UPDATE_COMPLETED,
                    request_id or StandardMessageHandler.generate_request_id(),
                    status="success",
                    code=200,
                    message="PDF文件更新成功",
                    data={"file_id": file_id, "updates": updates}
                )

            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "UPDATE_FAILED",
                "PDF文件更新失败",
                message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                code=500
            )

        except Exception as e:
            logger.error("更新PDF失败: %s", e, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "UPDATE_ERROR",
                f"更新PDF失败: {e}",
                message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                code=500
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

    # ----------------------------- helpers ---------------------------------
    def _resolve_pdf_uuid(self, value: Optional[str]) -> Optional[str]:
        """尝试将前端传入的 pdf_id 映射为数据库的 uuid。

        规则：
        - 若满足12位十六进制，直接返回
        - 否则尝试在 pdf_library_api.list_records 中按以下优先级匹配：
          1) filename == f"{value}.pdf"
          2) title == value
        - 否则原样返回（交由后续校验/错误处理）
        """
        try:
            if not value or not isinstance(value, str):
                return value
            v = value.strip()
            if len(v) == 12 and all(c in '0123456789abcdef' for c in v.lower()):
                return v
            if hasattr(self, 'pdf_library_api') and self.pdf_library_api:
                # 避免大批量：限制读取数量，假定前端数据规模在可控范围
                records = self.pdf_library_api.list_records(include_hidden=True, limit=1000, offset=0) or []
                target_filename = f"{v}.pdf"
                for r in records:
                    if r.get('filename') == target_filename:
                        return r.get('id')
                for r in records:
                    if r.get('title') == v:
                        return r.get('id')
        except Exception as exc:
            try:
                logger.warning(f"_resolve_pdf_uuid failed for value={value}: {exc}")
            except Exception:
                pass
        return value

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
            MessageType.SYSTEM_STATUS_UPDATED,
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
            MessageType.SYSTEM_STATUS_UPDATED,
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
            if hasattr(self, "pdf_library_api") and self.pdf_library_api:
                files = self.pdf_library_api.list_records()
            else:
                files = self.pdf_manager.get_files()
            message = PDFMessageBuilder.build_pdf_list_response(
                request_id=None,
                files=files
            )
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
