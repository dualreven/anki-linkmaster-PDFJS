from typing import Dict, Any, Optional
import time
import logging
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType

logger = logging.getLogger(__name__)


def register_viewer(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        viewer_id = data.get("viewer_id")
        pdf_uuid = data.get("pdf_uuid")
        url = data.get("url", "")
        title = data.get("title", "")

        logger.info(f"PDF Viewer 实例注册: viewer_id={viewer_id}, pdf_uuid={pdf_uuid}, url={url}")

        return StandardMessageHandler.build_response(
            MessageType.PDF_VIEWER_REGISTER_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="PDF Viewer 实例注册成功",
            data={
                "viewer_id": viewer_id,
                "pdf_uuid": pdf_uuid,
                "registered_at": int(time.time() * 1000),
            },
        )
    except Exception as exc:
        logger.error(f"PDF Viewer 实例注册失败: {exc}", exc_info=True)
        return StandardMessageHandler.build_error_response(
            request_id or StandardMessageHandler.generate_request_id(),
            "VIEWER_REGISTRATION_FAILED",
            str(exc),
            message_type=MessageType.PDF_VIEWER_REGISTER_FAILED,
            code=500,
        )


def navigate_viewer(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    严格导航处理：
    - 校验 `to.viewer_id|to.pdf_uuid` 至少一项
    - 校验 target.type in {'annotation','anchor','page','xy','outline'}
    - 缺失必须字段直接返回 failed（不降级、不兜底）
    - 成功则定向转发原始 `pdf-viewer:navigate:requested` 给目标 viewer，并回 completed 给请求方
    """
    try:
        # 兼容两类负载：新协议 data={ to, target, options }；旧负载 data={ viewer_id, pdf_uuid, navigate }
        to = data.get("to") or {}
        viewer_id = (to.get("viewer_id") if isinstance(to, dict) else None) or data.get("viewer_id")
        pdf_uuid = (to.get("pdf_uuid") if isinstance(to, dict) else None) or data.get("pdf_uuid")

        if not (viewer_id or pdf_uuid):
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "MISSING_TARGET",
                "缺少 to.viewer_id 或 to.pdf_uuid",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400,
            )

        target = data.get("target") or data.get("navigate") or {}
        if not isinstance(target, dict) or not target.get("type"):
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "MISSING_TARGET_TYPE",
                "缺少 target.type",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400,
            )

        mode = str(target.get("type")).strip().lower()
        allowed = {"annotation", "anchor", "page", "xy", "outline"}
        if mode not in allowed:
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "UNSUPPORTED_MODE",
                f"不支持的 target.type: {mode}",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400,
            )

        # 逐类严格校验
        if mode in {"annotation", "anchor"}:
            ann_id = target.get("annotation_id") or target.get("anchor_id")
            if not ann_id:
                return StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "MISSING_ANNOTATION_ID",
                    "annotation/anchor 模式下必须提供 annotation_id/anchor_id",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400,
                )
        elif mode in {"page", "xy"}:
            page_number = target.get("page_number")
            if not isinstance(page_number, int):
                return StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "INVALID_PAGE_NUMBER",
                    "page/xy 模式下 page_number 必须为整数",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400,
                )
        elif mode == "outline":
            outline_id = target.get("outline_item_id") or target.get("id")
            if not outline_id:
                return StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "MISSING_OUTLINE_ID",
                    "outline 模式下必须提供 outline_item_id 或 id",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400,
                )

        # 组装要转发到 viewer 的“requested”消息（保持协议一致）
        forward_msg = {
            "type": MessageType.PDF_VIEWER_NAVIGATE_REQUESTED.value,
            "request_id": request_id or StandardMessageHandler.generate_request_id(),
            "to": {"viewer_id": viewer_id, "pdf_uuid": pdf_uuid},
            "data": {
                "target": target,
                "options": data.get("options") or {}
            },
            "timestamp": int(time.time() * 1000)
        }

        # 严格转发：若找不到目标 viewer，则直接返回 failed
        sent = 0
        try:
            # 标准服务器提供 _forward_viewer_navigate（定向投递）
            if hasattr(ctx, "_forward_viewer_navigate"):
                sent = int(ctx._forward_viewer_navigate(forward_msg))  # type: ignore[attr-defined]
            else:
                # 最少也应广播，但根据“禁止兜底”原则，不做广播，直接报错
                raise RuntimeError("后端未提供定向转发能力(_forward_viewer_navigate)")
        except Exception as exc:
            logger.error("定向转发失败: %s", exc, exc_info=True)
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "FORWARD_FAILED",
                f"转发至目标 viewer 失败: {exc}",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=500,
            )

        if sent < 1:
            return StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "NO_TARGET_VIEWER",
                "未找到匹配的目标 viewer（viewer_id 或 pdf_uuid 不存在/未注册/不在线）",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=404,
            )

        # 成功回执
        return StandardMessageHandler.build_response(
            MessageType.PDF_VIEWER_NAVIGATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="导航请求已转发至目标 viewer",
            data={
                "viewer_id": viewer_id,
                "pdf_uuid": pdf_uuid,
                "forwarded_count": sent,
                "acknowledged_at": int(time.time() * 1000),
            },
        )
    except Exception as exc:
        logger.error(f"处理 PDF Viewer 导航请求失败: {exc}", exc_info=True)
        return StandardMessageHandler.build_error_response(
            request_id or StandardMessageHandler.generate_request_id(),
            "NAVIGATE_REQUEST_FAILED",
            str(exc),
            message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
            code=500,
        )
