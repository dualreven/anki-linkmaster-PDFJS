"""
标准WebSocket服务器 - 基于JSON通信标准
"""
import logging
import json
import os
import time
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
from src.backend.msgCenter_server.core.route_registry import RouteRegistry
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

    # 强制打开 Outline 处理器 DEBUG，便于诊断 WS→DB 关键路径
    try:
        logging.getLogger('src.backend.msgCenter_server.handlers.pdf_viewer.outline').setLevel(logging.DEBUG)
    except Exception:
        pass

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
    # NOTE: 信号的第一个参数使用 object 而非 QWebSocket，以便在无 Qt 环境/单元测试中使用 MockSocket。
    # 生产环境仍然传入真实 QWebSocket。
    client_connected = pyqtSignal(object)
    client_disconnected = pyqtSignal(object)
    message_received = pyqtSignal(object, dict)
    
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
        # ⚠️ 已废弃：viewer_id -> socket (使用 RouteRegistry 替代)
        self._viewer_by_id: dict = {}
        # ⚠️ 已废弃：pdf_uuid -> set[socket] (使用 RouteRegistry 替代)
        self._viewers_by_pdf: dict = {}
        # 通用客户端身份表：socket -> {'client_name': str, 'client_id': str|None, 'module': str|None, 'raw': dict}
        self._client_identity: dict = {}

        # ✅ 新路由系统：通用客户端路由注册表
        self._route_registry = RouteRegistry()

        # 连接 core 信号并转发/处理（改为方法，便于清理注册表）
        self._core.client_connected.connect(self._on_client_connected)
        self._core.client_disconnected.connect(self._on_client_disconnected)
        self._core.text_message_received.connect(self._on_text_message)

        # 连接PDF管理器信号
        self.pdf_manager.file_added.connect(self.on_pdf_file_added)
        self.pdf_manager.file_removed.connect(self.on_pdf_file_removed)

        # 路由表（逐步扩展域处理器）
        self._router = build_router(self)

    def _describe_client(self, socket: QWebSocket) -> str:
        """
        返回客户端标识 `<client-name>:<client-id>`，用于日志可观测性

        优先级（从高到低）：
        1. 通用身份注册表（_client_identity）
        2. RouteRegistry 路由信息（新路由系统）
        3. 旧 viewer 映射表（向后兼容）
        4. 裸 socket 地址信息
        """
        client_name = ""
        client_id = ""

        # 1) 优先通用客户端身份
        try:
            ident = self._client_identity.get(socket)
        except Exception:
            ident = None
        if isinstance(ident, dict):
            client_name = str(ident.get("client_name") or "").strip()
            cid = ident.get("client_id")
            client_id = str(cid).strip() if cid is not None else ""

        # 2) ✅ 尝试 RouteRegistry（新路由系统）
        if not client_name:
            try:
                route_info = self._route_registry.get_client_info(socket)
                if isinstance(route_info, dict):
                    client_id = str(route_info.get("client_id") or "").strip()
                    client_type = str(route_info.get("client_type") or "").strip()
                    if client_id:
                        # 使用 client_id 作为完整标识
                        client_name = client_id
                        client_id = client_type or "registered"
            except Exception:
                pass  # RouteRegistry 查询失败，继续尝试其他方式

        # 3) ⚠️ 向后兼容：退回 viewer 视角
        if not client_name:
            try:
                info = self._client_viewer_info.get(socket)
            except Exception:
                info = None
            if isinstance(info, dict):
                pdf_uuid = str(info.get("pdf_uuid") or "").strip()
                viewer_id = str(info.get("viewer_id") or "").strip()
                if pdf_uuid:
                    client_name = f"pdf-viewer-{pdf_uuid}"
                    client_id = viewer_id or pdf_uuid
                elif viewer_id:
                    client_name = "pdf-viewer"
                    client_id = viewer_id

        # 4) 最后退回"裸 socket" 信息
        if not client_name:
            try:
                addr = socket.peerAddress().toString()
            except Exception:
                addr = ""
            try:
                port = socket.peerPort()
            except Exception:
                port = ""
            client_name = "client"
            if addr or port:
                if addr and port:
                    client_id = f"{addr}:{port}"
                else:
                    client_id = str(port) if port else addr
            else:
                client_id = "unknown"

        return f"{client_name}:{client_id}"

    def _register_client_identity(
        self,
        socket: QWebSocket,
        *,
        client_name: str,
        client_id: Optional[str] = None,
        module: Optional[str] = None,
        raw: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        注册/更新通用客户端身份信息。
        - client_name: 必须为非空字符串；
        - client_id/module/raw: 作为附加诊断信息存储。
        """
        name = (client_name or "").strip()
        if not name:
            raise ValueError("client_name 不能为空")
        cid = (client_id or "").strip() or None
        mod = (module or "").strip() or None
        payload: Dict[str, Any] = {"client_name": name}
        if cid is not None:
            payload["client_id"] = cid
        if mod is not None:
            payload["module"] = mod
        if isinstance(raw, dict):
            payload["raw"] = raw
        self._client_identity[socket] = payload
        try:
            logger.info(
                "[ClientIdentity] 注册/更新: %s (module=%s)",
                self._describe_client(socket),
                mod,
            )
        except Exception:
            pass

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
            
    def handle_message(self, message: Dict[str, Any], client_socket: Optional[QWebSocket] = None) -> Optional[Dict[str, Any]]:
        """
        处理消息的核心方法

        新流程：
        1. Schema 校验（保留）
        2. 校验 to 字段
        3. 根据 route_action 决策：
           - backend: 调用 Handler 验证 → 执行业务逻辑
           - forward: 调用 Handler 验证 → 转发到目标客户端
           - register: 在 _process_incoming 中已处理，此处不应到达
        """
        from .core.message_validator import validate_to_field

        original_type = message.get("type")
        request_id = message.get("request_id")
        data = message.get("data", {})
        normalized_type = self._normalize_message_type(original_type)

        # ========== 步骤1：Schema 校验（保留原有逻辑）==========
        try:
            if isinstance(original_type, str) and original_type.endswith(":requested"):
                ok, err, schema_path = validate_message_by_schema(message, getattr(self, "_schema_root", None))
                if not ok:
                    logger.warning("Schema validation failed for %s: %s (schema=%s)", original_type, err, schema_path)
                    failed_type = original_type.replace(":requested", ":failed")
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

        # ========== 步骤2：校验 to 字段 ==========
        validation = validate_to_field(message)

        if not validation["valid"]:
            logger.error(
                f"[Validation] to 字段校验失败: type={original_type}, error={validation['error']}"
            )
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "INVALID_TO_FIELD",
                validation["error"],
                message_type=original_type.replace(":requested", ":failed") if original_type else "unknown:failed",
                code=400
            )

        route_action = validation["route_action"]
        logger.debug(f"[Route] type={original_type}, action={route_action}")

        # 降低 console_log 的日志量
        if original_type == "console_log":
            logger.debug("处理消息类型: %s（归一化: %s）, 请求ID: %s", original_type, normalized_type, request_id)
        else:
            logger.info("处理消息类型: %s（归一化: %s）, 请求ID: %s, 路由动作: %s", original_type, normalized_type, request_id, route_action)

        # ========== 步骤3：路由决策 ==========

        # 注册消息：应该在 _process_incoming 中已处理，不应到达此处
        if route_action == "register":
            logger.warning(f"[Route] 注册消息不应到达 handle_message: type={original_type}")
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "INVALID_ROUTE",
                f"注册消息应在 _process_incoming 中处理: {original_type}",
                message_type=original_type.replace(":requested", ":failed"),
                code=500
            )

        # 后端消息：调用 Handler 验证 + 执行业务逻辑
        elif route_action == "backend":
            handler = self._router.get(normalized_type)
            if not handler:
                logger.warning(f"[Route] 未找到 Handler: type={normalized_type}")
                return StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "UNKNOWN_MESSAGE_TYPE",
                    f"未知消息类型: {original_type}",
                    message_type=original_type.replace(":requested", ":failed"),
                    code=400
                )

            # 特例：search 需要原始消息（用于严格过滤与兼容行为）
            if normalized_type == "pdf-library:search:requested":
                return self.handle_pdf_search_request(request_id, data, message)

            # 调用 Handler（如果是验证类 Handler，返回 {"valid": True/False}）
            result = handler(request_id, data)

            # 检查是否是验证类 Handler
            if isinstance(result, dict) and "valid" in result:
                if result["valid"]:
                    # 验证通过，返回成功（纯验证 Handler 直接返回）
                    return result.get("response") or StandardMessageHandler.build_response(
                        original_type.replace(":requested", ":completed"),
                        request_id or StandardMessageHandler.generate_request_id(),
                        status="success",
                        code=200,
                        message="操作成功"
                    )
                else:
                    # 验证失败，返回错误
                    return result.get("error")
            else:
                # 业务类 Handler（如 pdf_library），直接返回结果
                return result

        # 窗口转发消息：调用 Handler 验证 + 转发
        elif route_action == "forward":
            # 如果有对应的 Handler，先验证参数
            handler = self._router.get(normalized_type)
            if handler:
                result = handler(request_id, data)

                # 检查验证结果
                if isinstance(result, dict) and "valid" in result:
                    if not result["valid"]:
                        # 验证失败，返回错误
                        logger.warning(
                            f"[Validation] Handler 验证失败: type={original_type}, error={result.get('error')}"
                        )
                        return result.get("error")

            # 验证通过，查找目标客户端
            routing_targets = validation["routing_targets"]
            all_target_sockets = []

            for routing_info in routing_targets:
                targets = self._route_registry.find_targets(
                    client_id=routing_info["client_id"],
                    routing_key=routing_info["routing_key"],
                    target_type=routing_info["target_type"]
                )
                all_target_sockets.extend(targets)

                logger.debug(
                    f"[Route] 查找目标: client_id={routing_info['client_id']}, "
                    f"routing_key={routing_info['routing_key']}, "
                    f"target_type={routing_info['target_type']}, "
                    f"找到 {len(targets)} 个"
                )

            # 去重（同一个 socket 可能被多个路由匹配）
            all_target_sockets = list(set(all_target_sockets))

            if not all_target_sockets:
                # 特例：pdf-viewer:navigate:requested 若未找到目标 viewer，则自动请求启动并缓存待转发
                # 说明：允许 client_socket=None（例如内部调用 handle_message / 兼容旧信号链路）
                if original_type == "pdf-viewer:navigate:requested":
                    return self._auto_launch_viewer_and_queue_forward(
                        client_socket=client_socket,
                        original_message=message,
                        routing_targets=routing_targets,
                        request_id=request_id,
                    )

                # 特例：card-planner:ingest:requested 若未找到目标 planner，则进入 pending-forward 并返回 202
                if original_type == "card-planner:ingest:requested":
                    self._ensure_pending_forward_tables()

                    target_client_id = None
                    for t in routing_targets or []:
                        cid = (t or {}).get("client_id")
                        if isinstance(cid, str) and cid.strip():
                            target_client_id = cid.strip()
                            break

                    if not target_client_id:
                        return StandardMessageHandler.build_error_response(
                            request_id or StandardMessageHandler.generate_request_id(),
                            "INVALID_TARGET",
                            "无法从路由目标中解析 client_id（无法进入 pending-forward）",
                            message_type="card-planner:ingest:failed",
                            error_details={"routing_targets": routing_targets},
                            code=400,
                        )

                    effective_rid = request_id or StandardMessageHandler.generate_request_id()
                    forward_msg = dict(message)
                    forward_msg["request_id"] = effective_rid

                    self._queue_pending_forward(client_id=target_client_id, message=forward_msg, ttl_ms=15000)

                    return StandardMessageHandler.build_response(
                        "card-planner:ingest:completed",
                        effective_rid,
                        status="accepted",
                        code=202,
                        message="未找到目标客户端，已进入 pending-forward 队列，待客户端注册后自动转发",
                        data={"client_id": target_client_id},
                    )

                logger.warning(
                    f"[Route] 未找到目标客户端: routing_targets={routing_targets}"
                )
                return StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "NO_TARGET_FOUND",
                    f"未找到任何匹配的目标客户端（共尝试 {len(routing_targets)} 个路由）",
                    message_type=original_type.replace(":requested", ":failed"),
                    code=404
                )

            # 转发到所有目标
            self._forward_to_targets(all_target_sockets, message)

            logger.info(
                f"[Forward] 消息已转发: type={original_type}, targets={len(all_target_sockets)}"
            )

            return StandardMessageHandler.build_response(
                original_type.replace(":requested", ":completed"),
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message=f"消息已转发到 {len(all_target_sockets)} 个目标客户端"
            )

        # 未知路由动作
        else:
            logger.error(f"[Route] 未知路由动作: action={route_action}")
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "INTERNAL_ERROR",
                f"内部错误：未知路由动作 {route_action}",
                message_type=original_type.replace(":requested", ":failed"),
                code=500
            )

    # Schema 校验逻辑已抽离至 src/backend/msgCenter_server/core/schema_validation.py




    def handle_pdf_search_request(self, request_id: Optional[str], data: Dict[str, Any], raw_message: Dict[str, Any]) -> Dict[str, Any]:
        return _pdf_search(self, request_id, data, raw_message)

    def _forward_to_targets(self, targets: list, message: dict):
        """
        转发消息到目标客户端列表

        Args:
            targets: QWebSocket 列表
            message: 要转发的消息字典
        """
        import json

        message_json = json.dumps(message, ensure_ascii=False)

        for target_socket in targets:
            try:
                target_socket.sendTextMessage(message_json)
                logger.debug(f"[Forward] 已发送到 socket {id(target_socket)}")
            except Exception as e:
                logger.error(f"[Forward] 转发失败: socket={id(target_socket)}, error={e}")

    def _ensure_pending_forward_tables(self) -> None:
        if not hasattr(self, "_pending_forward_by_client_id"):
            self._pending_forward_by_client_id: Dict[str, List[Dict[str, Any]]] = {}
        if not hasattr(self, "_auto_open_viewer_inflight"):
            self._auto_open_viewer_inflight: Dict[str, int] = {}

    def _queue_pending_forward(self, *, client_id: str, message: Dict[str, Any], ttl_ms: int) -> None:
        self._ensure_pending_forward_tables()
        now_ms = int(time.time() * 1000)
        expires_at_ms = now_ms + int(ttl_ms)
        entry = {
            "expires_at_ms": expires_at_ms,
            "request_id": message.get("request_id"),
            "message": message,
        }
        bucket = self._pending_forward_by_client_id.setdefault(client_id, [])

        # 去重：同 request_id 不重复入队
        rid = entry.get("request_id")
        if rid:
            for e in bucket:
                if e.get("request_id") == rid:
                    return

        bucket.append(entry)

    def _flush_pending_forward_for_client(self, *, client_id: str, socket: QWebSocket) -> int:
        self._ensure_pending_forward_tables()
        bucket = self._pending_forward_by_client_id.get(client_id) or []
        if not bucket:
            return 0

        now_ms = int(time.time() * 1000)
        remaining: List[Dict[str, Any]] = []
        sent = 0

        for entry in bucket:
            try:
                if int(entry.get("expires_at_ms") or 0) < now_ms:
                    continue
                msg = entry.get("message")
                if not isinstance(msg, dict):
                    continue
                socket.sendTextMessage(json.dumps(msg, ensure_ascii=False))
                sent += 1
            except Exception as exc:
                # 发送失败：保留，等待下一次 flush（但仍受 ttl 控制）
                remaining.append(entry)
                logger.error("[PendingForward] flush 发送失败: client_id=%s err=%s", client_id, exc, exc_info=True)

        if remaining:
            self._pending_forward_by_client_id[client_id] = remaining
        else:
            self._pending_forward_by_client_id.pop(client_id, None)

        if sent:
            logger.info("[PendingForward] flush 完成: client_id=%s sent=%d", client_id, sent)
        return sent

    def _auto_launch_viewer_and_queue_forward(
        self,
        *,
        client_socket: Optional[QWebSocket],
        original_message: Dict[str, Any],
        routing_targets: List[Dict[str, Any]],
        request_id: Optional[str],
    ) -> Dict[str, Any]:
        """
        处理场景：pdf-viewer:navigate:requested 路由不到任何 viewer。

        行为：
        1) 发射一条 app-window:open:requested（由 BackendLauncher 监听 message_received 触发打开/激活 viewer；socket 允许为 None）
        2) 将原导航消息缓存到 pending 队列，等待 viewer 注册后自动转发
        3) 返回 202 回执给请求方（避免 NO_TARGET_FOUND 直接失败）
        """
        self._ensure_pending_forward_tables()

        # 解析 pdf_id 与目标 client_id（Fail-Fast）
        target_client_id = None
        target_pdf_id = None
        for t in routing_targets or []:
            cid = (t or {}).get("client_id")
            rk = (t or {}).get("routing_key")
            if isinstance(cid, str) and cid.startswith("pdf-viewer-"):
                target_client_id = cid
                target_pdf_id = cid[len("pdf-viewer-") :].strip() or None
                break
            if isinstance(rk, str) and rk.startswith("pdf:"):
                target_pdf_id = rk[len("pdf:") :].strip() or None

        if not target_client_id and target_pdf_id:
            target_client_id = f"pdf-viewer-{target_pdf_id}"

        if not target_client_id or not target_pdf_id:
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "INVALID_TARGET",
                "无法从路由目标中解析 pdf_id（无法自动启动 viewer）",
                message_type="pdf-viewer:navigate:failed",
                error_details={"routing_targets": routing_targets},
                code=400,
            )

        # 组装要缓存/转发的导航消息（为 auto-launch 场景强制加 gate.once，避免 viewer 未 ready 就执行）
        effective_rid = request_id or StandardMessageHandler.generate_request_id()
        forward_msg = dict(original_message)
        forward_msg["request_id"] = effective_rid
        gate = forward_msg.get("gate")
        if not isinstance(gate, dict) or not gate.get("once"):
            forward_msg["gate"] = {"once": "pdf-viewer:render:ready", "timeout_ms": 8000}

        self._queue_pending_forward(client_id=target_client_id, message=forward_msg, ttl_ms=15000)

        # 去重触发 viewer open（同 pdf_id 15s 内只触发一次）
        now_ms = int(time.time() * 1000)
        inflight_until = int(self._auto_open_viewer_inflight.get(target_pdf_id) or 0)
        if inflight_until < now_ms:
            self._auto_open_viewer_inflight[target_pdf_id] = now_ms + 15000
            open_msg = {
                "type": "app-window:open:requested",
                "to": "backend",
                "timestamp": now_ms,
                "request_id": StandardMessageHandler.generate_request_id(),
                "data": {
                    "client_id": target_client_id,
                    "window_type": "pdf-viewer",
                    "params": {"pdf_id": target_pdf_id},
                },
            }
            try:
                logger.info(
                    "[AutoLaunch] viewer 不存在，触发 app-window:open:requested: client_id=%s pdf_id=%s",
                    target_client_id,
                    target_pdf_id,
                )
                self.message_received.emit(client_socket, open_msg)
            except Exception as exc:
                logger.error("[AutoLaunch] 发射 app-window:open:requested 失败: %s", exc, exc_info=True)
                return StandardMessageHandler.build_error_response(
                    effective_rid,
                    "AUTO_LAUNCH_FAILED",
                    f"自动启动 viewer 失败: {exc}",
                    message_type="pdf-viewer:navigate:failed",
                    error_details={"pdf_id": target_pdf_id, "client_id": target_client_id},
                    code=500,
                )

        return StandardMessageHandler.build_response(
            "pdf-viewer:navigate:completed",
            effective_rid,
            status="success",
            code=202,
            message="未找到目标 viewer，已请求启动并缓存导航请求，待 viewer 注册后自动转发",
            data={"pdf_id": target_pdf_id, "client_id": target_client_id},
        )

    # ---------- 内部：连接与转发辅助 ----------
    def _on_client_connected(self, socket: QWebSocket):
        # 严格：若发送欢迎失败，应抛出异常以便外层捕获记录
        try:
            logger.info("客户端连接: %s", self._describe_client(socket))
        except Exception:
            pass
        self.client_connected.emit(socket)
        _notify_welcome(self, socket)

    def _on_client_disconnected(self, socket: QWebSocket):
        # 清理注册表（严格：不吞异常）
        try:
            label = self._describe_client(socket)
        except Exception:
            label = None

        # 记录断开前的状态
        if label:
            try:
                logger.info("[Cleanup] 客户端断开连接: %s", label)
            except Exception:
                pass

        # 先移除通用客户端身份
        try:
            removed_identity = self._client_identity.pop(socket, None)
            if removed_identity:
                try:
                    logger.debug("[Cleanup] 移除客户端身份: %s", removed_identity)
                except Exception:
                    pass
        except Exception:
            pass

        # ✅ 清理 RouteRegistry（新路由系统）
        # 先检查 socket 是否已注册，避免误导性警告
        route_info = self._route_registry.get_client_info(socket)
        if route_info is not None:
            # socket 已注册到 RouteRegistry，执行注销
            try:
                if self._route_registry.unregister(socket):
                    logger.info("[Cleanup] RouteRegistry 注销成功")
                else:
                    # 理论上不应该到这里，因为已经检查过 get_client_info
                    logger.warning("[Cleanup] RouteRegistry 注销失败（未知原因）")
            except Exception as exc:
                logger.error("[Cleanup] RouteRegistry 注销失败: %s", exc, exc_info=True)
        else:
            # socket 未注册到 RouteRegistry，跳过注销（这是正常情况）
            logger.debug("[Cleanup] 客户端未注册到 RouteRegistry，跳过注销")

        # ⚠️ 向后兼容：清理旧的 viewer 映射表（临时保留）
        info = self._client_viewer_info.pop(socket, None)
        if info and isinstance(info, dict):
            vid = info.get("viewer_id") or None
            puid = info.get("pdf_uuid") or None
            try:
                logger.info("[Cleanup] 清理 viewer 映射: viewer_id=%s, pdf_uuid=%s", vid, puid)
            except Exception:
                pass

            if vid and self._viewer_by_id.get(vid) is socket:
                self._viewer_by_id.pop(vid, None)
                try:
                    logger.info("[Cleanup] 移除 _viewer_by_id[%s]", vid)
                except Exception:
                    pass

                if puid and puid in self._viewers_by_pdf:
                    s = self._viewers_by_pdf.get(puid) or set()
                    if socket in s:
                        s.discard(socket)
                        try:
                            logger.debug("[Cleanup] 从 _viewers_by_pdf[%s] 移除 socket", puid)
                        except Exception:
                            pass
                    if not s:
                        self._viewers_by_pdf.pop(puid, None)
                        try:
                            logger.info("[Cleanup] _viewers_by_pdf[%s] 已空，移除映射", puid)
                        except Exception:
                            pass

        # 清理完成后输出当前映射表状态（诊断用）
        try:
            logger.debug(
                "[Cleanup] 清理完成后映射表状态:\n"
                "  _viewer_by_id keys: %s\n"
                "  _viewers_by_pdf keys: %s",
                list(self._viewer_by_id.keys()) if hasattr(self, "_viewer_by_id") else [],
                list(self._viewers_by_pdf.keys()) if hasattr(self, "_viewers_by_pdf") else []
            )
        except Exception:
            pass

        self.client_disconnected.emit(socket)

    def _register_viewer_client(self, socket: QWebSocket, viewer_id: str | None, pdf_uuid: str | None):
        """
        注册 pdf-viewer 客户端到路由系统（使用新的 RouteRegistry）

        Args:
            socket: WebSocket 连接对象
            viewer_id: viewer 实例 ID（可选，仅用于向后兼容）
            pdf_uuid: PDF 文档唯一标识（必填）

        Raises:
            ValueError: pdf_uuid 为空时抛出
            RuntimeError: client_id 已存在时抛出（Batch 3 将处理窗口激活）
        """
        # ⚠️ Fail-Fast 严格验证：pdf_uuid 必须存在
        if not isinstance(pdf_uuid, str) or not pdf_uuid.strip():
            raise ValueError(
                f"pdf-viewer 注册必须提供 pdf_uuid，当前值: {pdf_uuid!r}"
            )

        # 构造标准化 client_id（禁止兜底）
        client_id = f"pdf-viewer-{pdf_uuid}"
        client_type = "pdf-viewer"
        routing_keys = [f"pdf:{pdf_uuid}"]

        # ✅ 使用 RouteRegistry 注册（新路由系统）
        try:
            self._route_registry.register(
                socket=socket,
                client_id=client_id,
                client_type=client_type,
                routing_keys=routing_keys
            )
            logger.info(
                "[RouteRegistry] PDF Viewer 注册成功: %s (pdf_uuid=%s)",
                client_id, pdf_uuid
            )
            # 🔍 诊断日志：打印注册详情
            logger.info(
                "[Diagnostic] 注册详情: client_id=%s, client_type=%s, routing_keys=%s",
                client_id, client_type, routing_keys
            )
            # 🔍 诊断日志：打印 RouteRegistry 当前状态
            try:
                if hasattr(self._route_registry, "_by_client_id"):
                    logger.info(
                        "[Diagnostic] RouteRegistry 当前注册的 client_id列表: %s",
                        list(self._route_registry._by_client_id.keys())
                    )
                if hasattr(self._route_registry, "_by_resource"):
                    logger.info(
                        "[Diagnostic] RouteRegistry 当前注册的 resource列表: %s",
                        list(self._route_registry._by_resource.keys())
                    )
            except Exception as e:
                logger.debug("[Diagnostic] 无法访问 RouteRegistry 内部状态: %s", e)
        except RuntimeError as exc:
            # 重复注册错误：client_id 已存在
            # ⚠️ Batch 3 将在此处添加窗口激活逻辑
            logger.warning(
                "[RouteRegistry] 重复注册 client_id=%s，目前策略：抛出异常 (Batch 3 将改为窗口激活)",
                client_id
            )
            raise  # 当前阶段直接抛出异常
        except ValueError as exc:
            logger.error("[RouteRegistry] 注册失败（参数错误）: %s", exc)
            raise

        # ⚠️ 向后兼容：保留旧映射表（临时，Batch 3 完成后可移除）
        self._client_viewer_info[socket] = {"viewer_id": viewer_id, "pdf_uuid": pdf_uuid}
        if isinstance(viewer_id, str) and viewer_id.strip():
            self._viewer_by_id[viewer_id] = socket
        if isinstance(pdf_uuid, str) and pdf_uuid.strip():
            bucket = self._viewers_by_pdf.get(pdf_uuid)
            if bucket is None:
                bucket = set()
                self._viewers_by_pdf[pdf_uuid] = bucket
            bucket.add(socket)

        # 🔍 诊断日志：确认旧映射表也已更新
        logger.info(
            "[Diagnostic] 旧映射表已同步更新: _viewer_by_id keys=%s, _viewers_by_pdf keys=%s",
            list(self._viewer_by_id.keys()), list(self._viewers_by_pdf.keys())
        )

        # 同步注册通用客户端身份（用于日志展示）
        try:
            self._register_client_identity(
                socket,
                client_name=client_id,  # 使用标准化的 client_id
                client_id=client_id,
                module="pdf-viewer",
                raw={"viewer_id": viewer_id, "pdf_uuid": pdf_uuid},
            )
        except Exception as exc:
            # 身份注册仅用于诊断，不影响核心转发表
            logger.debug("客户端身份注册失败（不影响路由）: %s", exc)

    def _forward_message_by_route(self, message: Dict[str, Any]) -> int:
        """
        通用消息路由转发（使用 RouteRegistry）

        根据消息中的 to 字段查找目标客户端并转发消息：
        - 精确路由：to.client_id 存在时，发送到单个目标
        - 资源路由：to.routing_key 存在时，组播到所有订阅者
        - 类型过滤：to.target_type + to.routing_key 组合时，发送到过滤后的目标

        Args:
            message: 要转发的消息，必须包含 to 字段

        Returns:
            成功发送的消息数量

        Raises:
            ValueError: to 字段缺失或所有路由字段都为空
        """
        to = (message or {}).get("to") or {}
        client_id = to.get("client_id") or None
        target_type = to.get("target_type") or None
        routing_key = to.get("routing_key") or None

        # ⚠️ Fail-Fast 验证：至少提供一个路由字段
        if not client_id and not routing_key:
            raise ValueError(
                "消息缺少路由字段：to.client_id 或 to.routing_key 至少需要一个。"
                f"当前 to: {to}"
            )

        logger.info(
            "[RouteForward] 开始路由转发: client_id=%s, target_type=%s, routing_key=%s",
            client_id, target_type, routing_key
        )

        # 使用 RouteRegistry 查找目标 sockets
        try:
            targets = self._route_registry.find_targets(
                client_id=client_id,
                target_type=target_type,
                routing_key=routing_key
            )
        except ValueError as exc:
            logger.error("[RouteForward] 路由查找失败: %s", exc)
            return 0

        if not targets:
            logger.warning(
                "[RouteForward] 未找到匹配的目标客户端 (client_id=%s, target_type=%s, routing_key=%s)",
                client_id, target_type, routing_key
            )
            return 0

        logger.info(
            "[RouteForward] 找到 %d 个目标客户端，开始发送消息",
            len(targets)
        )

        # 发送消息到所有目标
        sent = 0
        for socket in targets:
            try:
                client_desc = self._describe_client(socket)
                if self.send_message(socket, message):
                    sent += 1
                    logger.debug("[RouteForward] 发送成功: %s", client_desc)
                else:
                    logger.warning("[RouteForward] 发送失败: %s", client_desc)
            except Exception as exc:
                logger.error("[RouteForward] 发送异常: %s", exc, exc_info=True)

        logger.info(
            "[RouteForward] 转发完成: 成功发送 %d/%d 条消息",
            sent, len(targets)
        )
        return sent

    def _forward_viewer_navigate(self, message: Dict[str, Any]):
        """
        ⚠️ 已废弃：将 'pdf-viewer:navigate:requested' 定向发送到对应 viewer 实例

        此方法保留用于向后兼容，内部调用 _forward_message_by_route()。
        新代码应直接使用 _forward_message_by_route()。

        旧协议字段自动转换为新协议：
        - to.viewer_id → to.client_id (if viewer_id matches "pdf-viewer-*")
        - to.pdf_uuid → to.routing_key ("pdf:{pdf_uuid}")
        """
        to = (message or {}).get("to") or {}
        viewer_id = to.get("viewer_id") or None
        pdf_uuid = to.get("pdf_uuid") or None

        # 兼容性转换：viewer_id/pdf_uuid → client_id/routing_key
        if viewer_id or pdf_uuid:
            logger.warning(
                "[Deprecated] _forward_viewer_navigate() 收到旧协议字段 "
                "(viewer_id=%s, pdf_uuid=%s)，建议迁移到新协议 (client_id, routing_key)",
                viewer_id, pdf_uuid
            )

            # 转换为新协议
            new_to = {}
            if viewer_id:
                # 假设 viewer_id 格式为 "pdf-viewer-<uuid>" 或直接使用
                if viewer_id.startswith("pdf-viewer-"):
                    new_to["client_id"] = viewer_id
                else:
                    # 兼容旧格式：viewer_id 可能只是 uuid 部分
                    new_to["client_id"] = f"pdf-viewer-{viewer_id}"

            if pdf_uuid:
                new_to["routing_key"] = f"pdf:{pdf_uuid}"
                new_to["target_type"] = "pdf-viewer"

            # 替换 to 字段
            message = dict(message)  # 浅拷贝，避免修改原消息
            message["to"] = new_to

        # 调用新的通用路由转发方法
        return self._forward_message_by_route(message)

    # 在入口处捕捉“注册/导航”以维护注册表与定向转发
    def _process_incoming(self, client_socket: QWebSocket, message: str):
        try:
            logger.info("收到来自 %s 的消息: %s...", self._describe_client(client_socket), message[:200])
        except Exception:
            logger.info("收到消息: %s...", message[:200])
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

        msg_type = parsed_message.get("type")
        request_id = parsed_message.get("request_id") or "unknown"

        # ===== 向后兼容：pdf-viewer:register:requested 自动转换 =====
        if msg_type == MessageType.PDF_VIEWER_REGISTER_REQUESTED.value or msg_type == "pdf-viewer:register:requested":
            logger.warning(
                f"[Registration] 检测到旧协议 pdf-viewer:register:requested，"
                f"自动转换为 client:register:requested。建议更新前端代码使用新协议。"
            )

            # 提取旧协议字段
            old_data = parsed_message.get("data") or {}
            viewer_id = old_data.get("viewer_id")
            pdf_uuid = old_data.get("pdf_uuid")
            pdf_id = old_data.get("pdf_id") or pdf_uuid  # pdf_id 优先，回退到 pdf_uuid

            # 构造新协议数据
            new_client_id = viewer_id if viewer_id else (f"pdf-viewer-{pdf_id}" if pdf_id else "pdf-viewer-unknown")
            new_client_type = []

            # 添加窗口类型标签
            if pdf_id:
                new_client_type.append(f"window:pdf-viewer:{pdf_id}")
            else:
                new_client_type.append("window:pdf-viewer")

            # 添加默认标签（可编辑）
            new_client_type.append("editable")

            # 构造新协议消息（覆盖原消息）
            parsed_message["type"] = "client:register:requested"
            parsed_message["data"] = {
                "client_id": new_client_id,
                "client_type": new_client_type,
                "capabilities": ["navigation", "annotation", "bookmark", "outline"],
                "metadata": {
                    "legacy_protocol": "pdf-viewer:register:requested",
                    "viewer_id": viewer_id,
                    "pdf_uuid": pdf_uuid,
                    "pdf_id": pdf_id,
                    "url": old_data.get("url", ""),
                }
            }

            # 更新 msg_type 以便后续处理
            msg_type = "client:register:requested"

            logger.info(
                f"[Registration] 已将 pdf-viewer:register:requested 转换为新协议: "
                f"client_id={new_client_id}, client_type={new_client_type}"
            )

        # 通用客户端注册：client:register:requested
        if msg_type == "client:register:requested":
            data = parsed_message.get("data") or {}

            # 检测协议版本（新协议必须包含 client_type 数组）
            client_type_raw = data.get("client_type")
            is_new_protocol = isinstance(client_type_raw, list) and len(client_type_raw) > 0

            # ===== 新协议处理逻辑 =====
            if is_new_protocol:
                client_id = data.get("client_id")
                client_type = client_type_raw  # 已经是数组
                capabilities = data.get("capabilities", [])
                metadata = data.get("metadata", {})

                # 验证必填字段
                if not client_id or not isinstance(client_id, str) or not client_id.strip():
                    logger.warning("[ClientIdentity] 新协议注册请求缺少 client_id: %s", data)
                    error_response = StandardMessageHandler.build_error_response(
                        request_id,
                        "VALIDATION_FAILED",
                        "client_id 必须是非空字符串",
                        message_type="client:register:failed",
                        error_details={"field": "client_id", "data": data},
                        code=400,
                    )
                    self.send_message(client_socket, error_response)
                    return

                # 从 client_type 提取资源路由键（如果包含窗口类型标签）
                routing_keys = []
                for tag in client_type:
                    # 识别格式如 "window:pdf-viewer:sample" 的标签
                    if tag.startswith("window:pdf-viewer:"):
                        pdf_id = tag.split(":")[-1]
                        routing_keys.append(f"pdf:{pdf_id}")

                # 从 metadata 提取额外的路由键（如果有）
                if "pdf_id" in metadata:
                    routing_keys.append(f"pdf:{metadata['pdf_id']}")

                # 去重
                routing_keys = list(set(routing_keys))

                logger.info(
                    f"[Registration] 检测到新协议注册: client_id={client_id}, "
                    f"client_type={client_type}, routing_keys={routing_keys}"
                )

                # 1️⃣ 注册到 _client_identity（日志和诊断用）
                try:
                    # 兼容旧的 _client_identity 结构（使用第一个类型标签作为 module）
                    legacy_module = client_type[0] if client_type else "generic"
                    self._register_client_identity(
                        client_socket,
                        client_name=client_id,
                        client_id=client_id,
                        module=legacy_module,
                        raw=data,
                    )
                except Exception as exc:
                    logger.error("[ClientIdentity] 注册失败: %s", exc, exc_info=True)
                    error_response = StandardMessageHandler.build_error_response(
                        request_id,
                        "SERVER_ERROR",
                        f"客户端身份注册失败: {exc}",
                        message_type="client:register:failed",
                        error_details={"data": data},
                        code=500,
                    )
                    self.send_message(client_socket, error_response)
                    return

                # 2️⃣ 注册到 RouteRegistry（新协议：client_type 数组）
                try:
                    self._route_registry.register(
                        socket=client_socket,
                        client_id=client_id,
                        client_type=client_type,  # 传入数组
                        routing_keys=routing_keys
                    )
                    logger.info(
                        f"[RouteRegistry] 新协议客户端注册成功: client_id={client_id}, "
                        f"client_type={client_type}, routing_keys={routing_keys}"
                    )
                    # 若存在待转发消息（例如 auto-launch navigate），在注册成功后立即 flush
                    try:
                        self._flush_pending_forward_for_client(client_id=client_id, socket=client_socket)
                    except Exception as _flush_exc:
                        logger.error("[PendingForward] 注册后 flush 失败: client_id=%s err=%s", client_id, _flush_exc, exc_info=True)
                except RuntimeError as exc:
                    # 重复注册：返回 CLIENT_ID_EXISTS 错误
                    if "已存在" in str(exc) or "already" in str(exc).lower():
                        logger.warning(f"[RouteRegistry] 客户端 {client_id} 已存在")
                        error_response = StandardMessageHandler.build_error_response(
                            request_id,
                            "CLIENT_ID_EXISTS",
                            f"client_id '{client_id}' 已存在",
                            message_type="client:register:failed",
                            error_details={
                                "field": "client_id",
                                "value": client_id,
                                "reason": f"客户端 {client_id} 已在之前注册"
                            },
                            code=409,
                        )
                        self.send_message(client_socket, error_response)
                        return
                    else:
                        raise  # 其他 RuntimeError 继续向外抛出
                except Exception as exc:
                    logger.error(f"[RouteRegistry] 注册失败: {exc}", exc_info=True)
                    error_response = StandardMessageHandler.build_error_response(
                        request_id,
                        "SERVER_ERROR",
                        f"路由注册失败: {exc}",
                        message_type="client:register:failed",
                        code=500,
                    )
                    self.send_message(client_socket, error_response)
                    return

                # 注册成功，返回新协议响应
                ok_resp = StandardMessageHandler.build_response(
                    "client:register:completed",
                    request_id,
                    status="success",
                    code=200,
                    message="客户端注册成功",
                    data={
                        "client_id": client_id,
                        "client_type": client_type,
                        "routing_keys": routing_keys,
                        "server_info": {
                            "protocol_version": "1.0.0",
                            "supported_capabilities": ["navigation", "annotation", "bookmark", "outline"],
                        },
                        "registered_at": int(__import__('time').time() * 1000),
                    },
                )
                self.send_message(client_socket, ok_resp)
                self.message_received.emit(client_socket, parsed_message)
                return ok_resp

            # ===== 旧协议向后兼容处理逻辑 =====
            else:
                logger.warning(
                    f"[Registration] 检测到旧协议注册（client_type 不是数组），"
                    f"建议更新客户端代码使用新协议。data={data}"
                )

                client_name = str(data.get("client_name") or "").strip()
                client_id = data.get("client_id")
                module = data.get("module")

                if not client_name:
                    logger.warning("[ClientIdentity] 旧协议注册请求缺少 client_name: %s", data)
                    error_response = StandardMessageHandler.build_error_response(
                        request_id,
                        "CLIENT_NAME_REQUIRED",
                        "client:register:requested 缺少必填字段 client_name",
                        message_type="client:register:failed",
                        error_details={"data": data},
                        code=400,
                    )
                    self.send_message(client_socket, error_response)
                    return

                # 1️⃣ 注册到 _client_identity
                try:
                    self._register_client_identity(
                        client_socket,
                        client_name=client_name,
                        client_id=str(client_id).strip() if client_id is not None else None,
                        module=str(module).strip() if isinstance(module, str) else None,
                        raw=data,
                    )
                except Exception as exc:
                    logger.error("[ClientIdentity] 注册失败: %s", exc, exc_info=True)
                    error_response = StandardMessageHandler.build_error_response(
                        request_id,
                        "CLIENT_REGISTER_INTERNAL_ERROR",
                        f"客户端身份注册失败: {exc}",
                        message_type="client:register:failed",
                        error_details={"data": data},
                        code=500,
                    )
                    self.send_message(client_socket, error_response)
                    return

                # 2️⃣ 注册到 RouteRegistry（自动转换为新协议格式）
                route_client_id = (str(client_id).strip() if client_id is not None else None) or client_name
                # 将旧的 module 字符串转换为 client_type 数组
                route_client_type = [str(module).strip()] if isinstance(module, str) and module else ["generic"]

                try:
                    self._route_registry.register(
                        socket=client_socket,
                        client_id=route_client_id,
                        client_type=route_client_type,  # 自动转换为数组
                        routing_keys=[]
                    )
                    logger.info(
                        f"[RouteRegistry] 旧协议客户端注册成功（已自动转换）: client_id={route_client_id}, "
                        f"client_type={route_client_type}"
                    )
                    try:
                        self._flush_pending_forward_for_client(client_id=route_client_id, socket=client_socket)
                    except Exception as _flush_exc:
                        logger.error("[PendingForward] 注册后 flush 失败: client_id=%s err=%s", route_client_id, _flush_exc, exc_info=True)
                except RuntimeError as exc:
                    if "已存在" in str(exc) or "already" in str(exc).lower():
                        logger.warning(
                            f"[RouteRegistry] 客户端 {route_client_id} 重复注册，可能是重连或多实例。"
                            f"当前策略：允许连接，但无法注册到路由表（仅接收广播消息）"
                        )
                    else:
                        logger.error(f"[RouteRegistry] 通用客户端注册失败: {exc}", exc_info=True)
                except Exception as exc:
                    logger.warning(
                        f"[RouteRegistry] 通用客户端注册失败（不影响基本功能）: {exc}",
                        exc_info=True
                    )

                # 注册成功，返回旧协议响应
                ok_resp = StandardMessageHandler.build_response(
                    "client:register:completed",
                    request_id,
                    status="success",
                    code=200,
                    message="客户端身份注册成功",
                    data={
                        "client_name": client_name,
                        "client_id": str(client_id).strip() if client_id is not None else None,
                        "module": str(module).strip() if isinstance(module, str) else None,
                    },
                )
                self.send_message(client_socket, ok_resp)
                self.message_received.emit(client_socket, parsed_message)
                return ok_resp

        # 客户端取消注册：client:unregister:requested
        if msg_type == "client:unregister:requested":
            data = parsed_message.get("data") or {}
            client_id = data.get("client_id")
            reason = data.get("reason", "unknown")

            logger.info(
                f"[Unregister] 收到取消注册请求: client_id={client_id}, reason={reason}"
            )

            # 从 RouteRegistry 注销客户端
            unregister_success = False
            try:
                route_info = self._route_registry.get_client_info(client_socket)
                if route_info is not None:
                    unregister_success = self._route_registry.unregister(client_socket)
                    if unregister_success:
                        logger.info(
                            f"[Unregister] RouteRegistry 注销成功: client_id={route_info.get('client_id')}"
                        )
                    else:
                        logger.warning(
                            "[Unregister] RouteRegistry 注销失败（未找到注册信息，按 socket）"
                        )
                else:
                    # 若当前 socket 未注册到 RouteRegistry，则尝试按 client_id 补偿性注销
                    if client_id:
                        logger.info(
                            "[Unregister] 当前 socket 未注册到 RouteRegistry，尝试按 client_id 注销: %s",
                            client_id,
                        )
                        unregister_success = self._route_registry.unregister_by_client_id(
                            str(client_id)
                        )
                        if unregister_success:
                            logger.info(
                                "[Unregister] RouteRegistry 按 client_id 注销成功: client_id=%s",
                                client_id,
                            )
                        else:
                            logger.info(
                                "[Unregister] RouteRegistry 中未找到 client_id=%s 的条目，视为幂等成功",
                                client_id,
                            )
                            unregister_success = True
                    else:
                        logger.info(
                            "[Unregister] 客户端未注册到 RouteRegistry 且缺少 client_id，无需注销"
                        )
                        unregister_success = True  # 幂等性：未注册也算成功
            except Exception as exc:
                logger.error(f"[Unregister] 注销失败: {exc}", exc_info=True)
                error_response = StandardMessageHandler.build_error_response(
                    request_id,
                    "UNREGISTER_ERROR",
                    f"注销客户端失败: {exc}",
                    message_type="client:unregister:failed",
                    error_details={"client_id": client_id, "reason": reason},
                    code=500,
                )
                self.send_message(client_socket, error_response)
                return

            # 从 _client_identity 移除
            if client_socket in self._client_identity:
                del self._client_identity[client_socket]
                logger.info("[Unregister] 已从 _client_identity 移除")

            # 返回成功响应
            ok_resp = StandardMessageHandler.build_response(
                "client:unregister:success",
                request_id,
                status="success",
                code=200,
                message="客户端取消注册成功",
                data={
                    "client_id": client_id,
                    "unregistered_at": int(__import__("time").time() * 1000),
                    "reason": reason,
                },
            )
            self.send_message(client_socket, ok_resp)
            self.message_received.emit(client_socket, parsed_message)
            return ok_resp

        # 未注册客户端禁止发送除注册/取消注册以外的业务消息
        if msg_type not in (
            "client:register:requested",
            "client:unregister:requested",  # 允许未注册客户端取消注册（幂等性）
            MessageType.PDF_VIEWER_REGISTER_REQUESTED.value,
            "pdf-viewer:register:requested",
        ):
            if client_socket not in self._client_identity:
                _msg = f"当前 WebSocket 客户端尚未完成身份注册，拒绝处理消息: type={msg_type}"
                try:
                    logger.warning("[ClientIdentity] %s", _msg)
                except Exception:
                    pass
                error_response = StandardMessageHandler.build_error_response(
                    request_id,
                    "CLIENT_NOT_REGISTERED",
                    "当前 WebSocket 客户端尚未通过 client:register:requested 或 pdf-viewer:register:requested 完成注册",
                    message_type="client:register:failed",
                    error_details={"type": msg_type},
                    code=401,
                )
                self.send_message(client_socket, error_response)
                self.message_received.emit(client_socket, parsed_message)
                return error_response

        # 处理消息（注册在这里维护；转发由 handler 决定成败并返回 completed/failed 给请求方）
        try:
            response = self.handle_message(parsed_message, client_socket=client_socket)

            # ✅ 新增：检查验证结果，决定是否发射信号
            should_emit_signal = True  # 默认发射

            if response:
                # 检查响应类型，判断是否为错误
                response_type = response.get("type", "")
                response_status = response.get("status", "")
                error_code = response.get("code", 0)

                # 判断是否为错误响应
                is_error = (
                    response_type.endswith(":failed") or
                    response_status == "error" or
                    error_code >= 400
                )

                if is_error:
                    should_emit_signal = False
                    logger.warning(
                        f"[Security] 消息验证失败，拒绝发射 message_received 信号: "
                        f"type={parsed_message.get('type')}, "
                        f"error_type={response.get('error', {}).get('type', 'UNKNOWN')}, "
                        f"error_msg={response.get('message', 'Unknown error')}"
                    )

                self.send_message(client_socket, response)

            # ✅ 核心修复：只有验证成功时才发射信号
            if should_emit_signal:
                self.message_received.emit(client_socket, parsed_message)
                logger.debug(
                    f"[Signal] 验证通过，发射 message_received 信号: "
                    f"type={parsed_message.get('type')}"
                )
            else:
                logger.debug(
                    f"[Signal] 验证失败，拒绝发射 message_received 信号: "
                    f"type={parsed_message.get('type')}"
                )

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
    





