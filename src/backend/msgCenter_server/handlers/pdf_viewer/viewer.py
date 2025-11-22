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


def navigate_viewer_validator(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    导航请求参数验证器

    ⚠️ 职责：只验证参数，不做转发（转发由路由层负责）

    Args:
        ctx: 上下文对象（本函数不使用）
        request_id: 请求ID
        data: 消息 data 字段

    Returns:
        {"valid": True} - 验证通过
        {"valid": False, "error": {...}} - 验证失败
    """
    # ========== 验证 target 字段 ==========
    target = data.get("target") or data.get("navigate") or {}

    if not target:
        return {
            "valid": False,
            "error": StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "MISSING_TARGET",
                "缺少 target 字段",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400
            )
        }

    # ========== 验证 target.type ==========
    mode = str(target.get("type") or "").strip().lower()
    ALLOWED_TYPES = {"annotation", "anchor", "page", "xy", "outline"}

    if not mode:
        return {
            "valid": False,
            "error": StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "MISSING_TARGET_TYPE",
                "缺少 target.type 字段",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400
            )
        }

    if mode not in ALLOWED_TYPES:
        return {
            "valid": False,
            "error": StandardMessageHandler.build_error_response(
                request_id or StandardMessageHandler.generate_request_id(),
                "UNSUPPORTED_MODE",
                f"不支持的 target.type: '{mode}'，允许值: {ALLOWED_TYPES}",
                message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                code=400
            )
        }

    # ========== 根据 type 验证必填字段 ==========

    if mode == "annotation":
        if not target.get("annotation_id"):
            return {
                "valid": False,
                "error": StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "MISSING_ANNOTATION_ID",
                    "annotation 模式需要 target.annotation_id",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400
                )
            }

    elif mode == "anchor":
        if not target.get("anchor_id"):
            return {
                "valid": False,
                "error": StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "MISSING_ANCHOR_ID",
                    "anchor 模式需要 target.anchor_id",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400
                )
            }

    elif mode in ("page", "xy"):
        page_number = target.get("page_number")
        if not isinstance(page_number, int) or page_number < 1:
            return {
                "valid": False,
                "error": StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "INVALID_PAGE_NUMBER",
                    f"{mode} 模式需要有效的 target.page_number（整数 >= 1），当前值: {page_number}",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400
                )
            }

        # xy 模式额外需要 position
        if mode == "xy":
            position = target.get("position")
            if not isinstance(position, dict):
                return {
                    "valid": False,
                    "error": StandardMessageHandler.build_error_response(
                        request_id or StandardMessageHandler.generate_request_id(),
                        "INVALID_POSITION",
                        "xy 模式需要 target.position（字典类型）",
                        message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                        code=400
                    )
                }

            if "y_percent" not in position:
                return {
                    "valid": False,
                    "error": StandardMessageHandler.build_error_response(
                        request_id or StandardMessageHandler.generate_request_id(),
                        "MISSING_Y_PERCENT",
                        "xy 模式需要 target.position.y_percent",
                        message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                        code=400
                    )
                }

    elif mode == "outline":
        if not target.get("outline_item_id"):
            return {
                "valid": False,
                "error": StandardMessageHandler.build_error_response(
                    request_id or StandardMessageHandler.generate_request_id(),
                    "MISSING_OUTLINE_ITEM_ID",
                    "outline 模式需要 target.outline_item_id",
                    message_type=MessageType.PDF_VIEWER_NAVIGATE_FAILED,
                    code=400
                )
            }

    # ========== 验证通过 ==========
    logger.debug(f"[Validator] 导航参数验证通过: mode={mode}")
    return {"valid": True}
