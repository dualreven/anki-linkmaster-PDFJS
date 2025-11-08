"""
标准WebSocket服务器 - 基于JSON通信标准
"""
import logging
import json
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
from src.backend.msgCenter_server.core.schema_validation import validate_message_by_schema
from src.backend.msgCenter_server.core.msg_router import build_router
from src.backend.msgCenter_server.core.server_core import WebSocketServerCore
from src.backend.msgCenter_server.core.server_api import ServerAPIMixin
from src.backend.pdf_manager.standard_manager import StandardPDFManager as PDFManager
from src.backend.database.config import compute_data_dir, compute_db_path  # 参数式路径解析（弃用兜底，仅用于兼容明确传参时的校验）
# 移除传输优化模块的依赖
# from src.backend.pdf_manager.page_transfer_manager import page_transfer_manager

logger = logging.getLogger(__name__)

LEGACY_TYPE_DENYLIST = {
    MessageType.LEGACY_PDF_LIBRARY_LIST.value,
    MessageType.LEGACY_PDF_HOME_GET_PDF_LIST.value,
    "get_pdf_list",
    MessageType.LEGACY_PDF_LIBRARY_ADD.value,
    MessageType.LEGACY_PDF_HOME_ADD_PDF_FILES.value,
    "add_pdf",
    MessageType.LEGACY_PDF_LIBRARY_REMOVE.value,
    MessageType.LEGACY_PDF_HOME_REMOVE_PDF_FILES.value,
    "remove_pdf",
    "batch_remove_pdf",
    MessageType.LEGACY_PDF_LIBRARY_OPEN.value,
    MessageType.LEGACY_PDF_HOME_OPEN_PDF_FILE.value,
    "open_pdf",
    MessageType.LEGACY_PDF_LIBRARY_INFO.value,
    MessageType.LEGACY_PDF_HOME_GET_PDF_INFO.value,
    "pdf_detail_request",
    MessageType.LEGACY_PDF_HOME_UPDATE_PDF.value,
    MessageType.LEGACY_PDF_LIBRARY_SEARCH.value,
    "pdf-home:search:pdf-files",
    MessageType.LEGACY_PDF_LIBRARY_GET_CONFIG.value,
    "pdf-home:get:config",
    MessageType.LEGACY_PDF_LIBRARY_UPDATE_CONFIG.value,
    "pdf-home:update:config",
    MessageType.LEGACY_BOOKMARK_LIST.value,
    MessageType.LEGACY_BOOKMARK_SAVE.value,
    MessageType.LEGACY_PDF_PAGE_REQUEST.value,
    MessageType.LEGACY_PDF_PAGE_PRELOAD.value,
    MessageType.LEGACY_PDF_PAGE_CACHE_CLEAR.value,
    MessageType.LEGACY_HEARTBEAT.value,
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

# 处理器拆分（Phase-1）：存储服务（KV/FS）
from src.backend.msgCenter_server.handlers.pdf_library import search as _pdf_search
from src.backend.msgCenter_server.handlers.infra.notifications import (
    send_welcome as _notify_welcome,
    broadcast_pdf_list as _notify_broadcast_list,
    notify_file_added as _notify_file_added,
    notify_file_removed as _notify_file_removed,
)

class StandardWebSocketServer(QObject, ServerAPIMixin):
    """标准WebSocket服务器 - 支持JSON通信标准"""
    
    # 定义信号
    client_connected = pyqtSignal(QWebSocket)
    client_disconnected = pyqtSignal(QWebSocket)
    message_received = pyqtSignal(QWebSocket, dict)
    
    def __init__(self, host="127.0.0.1", port=8765, app=None, *,
                 pdf_library_api: Optional[PDFLibraryAPI] = None,
                 service_registry: Optional[ServiceRegistry] = None,
                 db_path: Optional[str] = None,
                 runtime_mode: Optional[str] = None,
                 ankiaddon_root_path: Optional[str] = None,
                 data_dir: Optional[str] = None,
                 static_dir: Optional[str] = None,
                 pdfs_dir: Optional[str] = None,
                 page_transfer=None):
        super().__init__()
        self.host = host
        self.port = port
        self.app = app  # 存储应用实例引用
        # Qt WebSocket 核心（连接管理/启停/文本转发）
        self._core = WebSocketServerCore(host=self.host, port=self.port, parent=self)
        self.running = False
        
        # 严格参数策略：必须显式传入 data_dir 与 db_path，禁止任何兜底/自动推断
        if not data_dir:
            raise RuntimeError("缺少必要参数 data_dir（禁止兜底）；请在 BackendLauncher/EmbedMsgCenterServer 构造时显式传入")
        if not db_path:
            raise RuntimeError("缺少必要参数 db_path（禁止兜底）；请在 BackendLauncher/EmbedMsgCenterServer 构造时显式传入")
        selected_data_dir = Path(data_dir).resolve()

        data_dir_abs = str(selected_data_dir)
        self.pdf_manager = PDFManager(data_dir=data_dir_abs)
        try:
            logger.info("pdf_manager.data_dir=%s", getattr(self.pdf_manager, 'data_dir', None))
        except Exception:
            pass

        # JSON Schema 根目录（用于运行时严格校验）
        try:
            self._schema_root = os.path.join(
                project_root,
                "todo-and-doing",
                "1 doing",
                "20251006182000-bus-contract-capability-registry",
                "schemas",
            )
        except Exception:
            self._schema_root = None

        # API 门面/服务注册表（可注入）
        self.pdf_library_api = pdf_library_api
        # DB 路径：仅接受显式传入
        self._db_path = db_path
        # PDF 页面传输依赖（显式注入；禁止兜底）
        self._page_transfer = page_transfer
        try:
            logger.info("diagnose(WS): resolved db_path=%s data_dir=%s static_dir_param=%s pdfs_dir_param=%s",
                        str(self._db_path), data_dir_abs, str(static_dir), str(pdfs_dir))
        except Exception:
            pass
        if self.pdf_library_api is None:
            try:
                reg = service_registry if service_registry is not None else ServiceRegistry()
                self.pdf_library_api = PDFLibraryAPI(db_path=self._db_path, service_registry=reg, pdf_manager=self.pdf_manager)
            except Exception as exc:
                logger.warning("创建 PDFLibraryAPI 失败: %s", exc)
        
        # === Viewer 实例注册表（用于定向转发 navigation 请求）===
        # socket -> {'viewer_id': str|None, 'pdf_uuid': str|None}
        self._client_viewer_info: dict = {}
        # viewer_id -> socket
        self._viewer_by_id: dict = {}
        # pdf_uuid -> set[socket]
        self._viewers_by_pdf: dict = {}

        # 连接 core 信号并转发/处理（改为方法，便于清理注册表）
        self._core.client_connected.connect(self._on_client_connected)
        self._core.client_disconnected.connect(self._on_client_disconnected)
        self._core.text_message_received.connect(self._on_text_message)

        # 连接PDF管理器信号
        self.pdf_manager.file_added.connect(self.on_pdf_file_added)
        self.pdf_manager.file_removed.connect(self.on_pdf_file_removed)

        # 路由表（逐步扩展域处理器）
        self._router = build_router(self)

    def _normalize_message_type(self, message_type: Optional[str]) -> str:
        """不再做 legacy 映射，原样返回"""
        if not message_type:
            return ""
        return message_type

    def _is_legacy_type(self, message_type: Optional[str]) -> bool:
        try:
            return bool(message_type) and (message_type in LEGACY_TYPE_DENYLIST)
        except Exception:
            return False

    def start(self):
        """启动服务器"""
        if self.running:
            logger.warning("WebSocket服务器已在运行")
            return False
        
        if self._core.start():
            self.running = True
            logger.info(f"标准WebSocket服务器启动成功: ws://{self.host}:{self.port}")
            return True
        logger.error("标准WebSocket服务器启动失败")
        return False
            
    def stop(self):
        """停止服务器"""
        if not self.running:
            return
        
        self._core.stop()
        if hasattr(self, "pdf_library_api") and self.pdf_library_api:
            self.pdf_library_api.shutdown()
        self.running = False
        logger.info("标准WebSocket服务器已停止")

    # 旧版 _process_incoming 已被替换为带“注册/转发”的实现（见下）

    @pyqtSlot(QWebSocket, str)
    def _on_text_message(self, client_socket: QWebSocket, message: str):
        """core 转发的文本消息入口"""
        self._process_incoming(client_socket, message)

    @pyqtSlot(str)
    def on_message_received(self, message):
        """兼容旧信号：从 self.sender() 解析 socket"""
        client_socket = self.sender()
        self._process_incoming(client_socket, message)
            
    def handle_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """处理具体消息"""
        original_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})
        normalized_type = self._normalize_message_type(original_type)

        # 统一：在路由前进行 JSON Schema 严格校验（仅对 *:requested 做入站校验）
        try:
            if isinstance(original_type, str) and original_type.endswith(":requested"):
                ok, err, schema_path = validate_message_by_schema(message, getattr(self, "_schema_root", None))
                if not ok:
                    logger.warning("Schema validation failed for %s: %s (schema=%s)", original_type, err, schema_path)
                    failed_type = original_type.replace(":requested", ":failed")
                    # 构造提示文案（避免在 f-string 中嵌套花括号导致语法错误）
                    _msg = f"入站消息未通过Schema校验: {err}"
                    if "metadata" in str(err):
                        _msg += "；请在消息中自行添加必填字段，如 metadata: { version: \"1.0.0\" }"
                    return StandardMessageHandler.build_error_response(
                        request_id or "unknown",
                        "SCHEMA_VALIDATION_FAILED",
                        _msg,
                        message_type=failed_type if failed_type != original_type else MessageType.LEGACY_ERROR,
                        error_details={"schema": schema_path, "type": original_type},
                        code=400,
                    )
        except Exception as _schema_exc:
            logger.error("Schema validation internal error: %s", _schema_exc, exc_info=True)
            failed_type = (original_type or "error").replace(":requested", ":failed")
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SCHEMA_VALIDATION_INTERNAL_ERROR",
                "Schema校验发生内部错误",
                message_type=failed_type if failed_type != (original_type or "") else MessageType.LEGACY_ERROR,
                error_details={"error": str(_schema_exc)},
                code=500,
            )

        # 降低 console_log 的日志量
        if original_type == "console_log":
            logger.debug("处理消息类型: %s（归一化: %s）, 请求ID: %s", original_type, normalized_type, request_id)
        else:
            logger.info("处理消息类型: %s（归一化: %s）, 请求ID: %s", original_type, normalized_type, request_id)

        # 优先通过路由表分派（已覆盖 storage/pdf-library/annotation/anchor/viewer/capability/bookmark/debug）
        handler = self._router.get(normalized_type)
        if handler is not None:
            # 特例：search 需要原始消息（用于严格过滤与兼容行为）
            if normalized_type == "pdf-library:search:requested":
                return self.handle_pdf_search_request(request_id, data, message)
            return handler(request_id, data)  # 绑定方法可直接按 (request_id, data) 调用
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "unknown_message_type",
            f"未知的消息类型: {original_type}",
            message_type=MessageType.LEGACY_ERROR,
            code=400
        )

    # Schema 校验逻辑已抽离至 src/backend/msgCenter_server/core/schema_validation.py




    def handle_pdf_search_request(self, request_id: Optional[str], data: Dict[str, Any], raw_message: Dict[str, Any]) -> Dict[str, Any]:
        return _pdf_search(self, request_id, data, raw_message)

    # ---------- 内部：连接与转发辅助 ----------
    def _on_client_connected(self, socket: QWebSocket):
        # 严格：若发送欢迎失败，应抛出异常以便外层捕获记录
        self.client_connected.emit(socket)
        _notify_welcome(self, socket)

    def _on_client_disconnected(self, socket: QWebSocket):
        # 清理注册表（严格：不吞异常）
        info = self._client_viewer_info.pop(socket, None)
        if info and isinstance(info, dict):
            vid = info.get("viewer_id") or None
            puid = info.get("pdf_uuid") or None
            if vid and self._viewer_by_id.get(vid) is socket:
                self._viewer_by_id.pop(vid, None)
            if puid and puid in self._viewers_by_pdf:
                s = self._viewers_by_pdf.get(puid) or set()
                if socket in s:
                    s.discard(socket)
                if not s:
                    self._viewers_by_pdf.pop(puid, None)
        self.client_disconnected.emit(socket)

    def _register_viewer_client(self, socket: QWebSocket, viewer_id: str | None, pdf_uuid: str | None):
        """注册/更新 viewer 客户端映射"""
        self._client_viewer_info[socket] = {"viewer_id": viewer_id, "pdf_uuid": pdf_uuid}
        if isinstance(viewer_id, str) and viewer_id.strip():
            self._viewer_by_id[viewer_id] = socket
        if isinstance(pdf_uuid, str) and pdf_uuid.strip():
            bucket = self._viewers_by_pdf.get(pdf_uuid)
            if bucket is None:
                bucket = set()
                self._viewers_by_pdf[pdf_uuid] = bucket
            bucket.add(socket)

    def _forward_viewer_navigate(self, message: Dict[str, Any]):
        """
        将 'pdf-viewer:navigate:requested' 定向发送到对应 viewer 实例：
        - 优先 viewer_id；否则按 pdf_uuid 多播；二者皆无则忽略。
        """
        to = (message or {}).get("to") or {}
        viewer_id = to.get("viewer_id") or None
        pdf_uuid = to.get("pdf_uuid") or None

        if not (viewer_id or pdf_uuid):
            raise ValueError("缺少 to.viewer_id 或 to.pdf_uuid")

        if viewer_id:
            target_socket = self._viewer_by_id.get(viewer_id)
            if target_socket is not None:
                ok = self.send_message(target_socket, message)
                return 1 if ok else 0
            return 0

        # 否则按 pdf_uuid 多播
        sockets = list(self._viewers_by_pdf.get(pdf_uuid) or [])
        sent = 0
        for s in sockets:
            if self.send_message(s, message):
                sent += 1
        return sent

    # 在入口处捕捉“注册/导航”以维护注册表与定向转发
    def _process_incoming(self, client_socket: QWebSocket, message: str):
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

        # 在路由处理前，捕捉“viewer 注册”并维护映射
        if parsed_message.get("type") == MessageType.PDF_VIEWER_REGISTER_REQUESTED.value or parsed_message.get("type") == "pdf-viewer:register:requested":
            data = parsed_message.get("data") or {}
            vid = data.get("viewer_id") or None
            puid = data.get("pdf_uuid") or None
            self._register_viewer_client(client_socket, vid, puid)

        # 处理消息（注册在这里维护；转发由 handler 决定成败并返回 completed/failed 给请求方）
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





    # ==================== Annotation handlers ====================







    # -------------------- Misc handlers (delegates) --------------------
    
    # PDF管理器事件处理
    def on_pdf_file_added(self, file_info: Dict[str, Any]):
        """处理PDF文件添加事件"""
        logger.info(f"PDF文件添加事件: {file_info}")
        _notify_file_added(self, file_info)



    def on_pdf_file_removed(self, file_id: str):
        """处理PDF文件删除事件"""
        logger.info(f"PDF文件删除事件: {file_id}")
        _notify_file_removed(self, file_id)
    
    def on_pdf_list_changed(self):
        """处理PDF列表变更事件"""
        logger.info("PDF列表变更事件")
        _notify_broadcast_list(self)
    







