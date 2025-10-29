from typing import Dict, Any, Optional
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType


def _ensure_api(ctx, request_id: Optional[str], failed_type: MessageType):
    if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=failed_type,
            code=503,
        )
    return None


def get_anchor(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_GET_FAILED)
    if missing:
        return missing
    anchor_id = (data or {}).get("anchor_id")
    if not anchor_id:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 anchor_id",
            message_type=MessageType.ANCHOR_GET_FAILED, code=400
        )
    row = ctx.pdf_library_api.anchor_get(anchor_id)
    if not row:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "NOT_FOUND", f"未找到锚点: {anchor_id}",
            message_type=MessageType.ANCHOR_GET_FAILED, code=404
        )
    return StandardMessageHandler.build_response(
        MessageType.ANCHOR_GET_COMPLETED,
        request_id or StandardMessageHandler.generate_request_id(),
        status="success", code=200, message="锚点获取成功", data={"anchor": row}
    )


def list_anchors(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_LIST_FAILED)
    if missing:
        return missing
    pdf_uuid = (data or {}).get("pdf_uuid")
    if not pdf_uuid:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 pdf_uuid 参数",
            message_type=MessageType.ANCHOR_LIST_FAILED, code=400
        )
    rows = ctx.pdf_library_api.anchor_list(pdf_uuid)
    return StandardMessageHandler.build_response(
        MessageType.ANCHOR_LIST_COMPLETED,
        request_id or StandardMessageHandler.generate_request_id(),
        status="success", code=200, message="锚点列表获取成功",
        data={"anchors": rows, "count": len(rows), "pdf_uuid": pdf_uuid}
    )


def create_anchor(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_CREATE_FAILED)
    if missing:
        return missing
    payload = data or {}
    pdf_uuid = payload.get("pdf_uuid")
    anchor = payload.get("anchor") or {}
    if not pdf_uuid:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 pdf_uuid 参数",
            message_type=MessageType.ANCHOR_CREATE_FAILED, code=400
        )
    anchor["pdf_uuid"] = pdf_uuid
    try:
        anchor_id = ctx.pdf_library_api.anchor_create(anchor)
        return StandardMessageHandler.build_response(
            MessageType.ANCHOR_CREATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success", code=200, message="锚点创建成功",
            data={"uuid": anchor_id, "pdf_uuid": pdf_uuid}
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "ANCHOR_CREATE_ERROR", f"锚点创建失败: {exc}",
            message_type=MessageType.ANCHOR_CREATE_FAILED, code=500
        )


def update_anchor(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_UPDATE_FAILED)
    if missing:
        return missing
    anchor_id = (data or {}).get("anchor_id")
    update = (data or {}).get("update") or {}
    if not anchor_id:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 anchor_id",
            message_type=MessageType.ANCHOR_UPDATE_FAILED, code=400
        )
    try:
        ok = ctx.pdf_library_api.anchor_update(anchor_id, update)
        if not ok:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown", "ANCHOR_UPDATE_ERROR", "锚点未更新",
                message_type=MessageType.ANCHOR_UPDATE_FAILED, code=500
            )
        return StandardMessageHandler.build_response(
            MessageType.ANCHOR_UPDATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success", code=200, message="锚点更新成功",
            data={"uuid": anchor_id}
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "ANCHOR_UPDATE_ERROR", f"锚点更新失败: {exc}",
            message_type=MessageType.ANCHOR_UPDATE_FAILED, code=500
        )


def delete_anchor(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_DELETE_FAILED)
    if missing:
        return missing
    anchor_id = (data or {}).get("anchor_id")
    if not anchor_id:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 anchor_id",
            message_type=MessageType.ANCHOR_DELETE_FAILED, code=400
        )
    try:
        ok = ctx.pdf_library_api.anchor_delete(anchor_id)
        if not ok:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown", "ANCHOR_DELETE_ERROR", "锚点未删除",
                message_type=MessageType.ANCHOR_DELETE_FAILED, code=500
            )
        return StandardMessageHandler.build_response(
            MessageType.ANCHOR_DELETE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success", code=200, message="锚点删除成功",
            data={"uuid": anchor_id}
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "ANCHOR_DELETE_ERROR", f"锚点删除失败: {exc}",
            message_type=MessageType.ANCHOR_DELETE_FAILED, code=500
        )


def activate_anchor(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    missing = _ensure_api(ctx, request_id, MessageType.ANCHOR_ACTIVATE_FAILED)
    if missing:
        return missing
    anchor_id = (data or {}).get("anchor_id")
    active = bool((data or {}).get("active"))
    if not anchor_id:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "INVALID_REQUEST", "缺少 anchor_id",
            message_type=MessageType.ANCHOR_ACTIVATE_FAILED, code=400
        )
    try:
        ok = ctx.pdf_library_api.anchor_activate(anchor_id, active)
        if not ok:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown", "ANCHOR_ACTIVATE_ERROR", "锚点未更新",
                message_type=MessageType.ANCHOR_ACTIVATE_FAILED, code=500
            )
        return StandardMessageHandler.build_response(
            MessageType.ANCHOR_ACTIVATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success", code=200, message="锚点激活状态已更新",
            data={"anchor_id": anchor_id, "active": active}
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown", "ANCHOR_ACTIVATE_ERROR", f"锚点激活更新失败: {exc}",
            message_type=MessageType.ANCHOR_ACTIVATE_FAILED, code=500
        )

