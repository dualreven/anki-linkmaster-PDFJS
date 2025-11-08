from __future__ import annotations

from typing import Any, Dict, Optional

from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType


def _require_api(ctx: Any):
    return hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api


def list_outline(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    outline:list:requested
    data: { pdf_uuid: string }
    """
    if not _require_api(ctx):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.OUTLINE_LIST_FAILED,
            code=503,
        )
    pdf_uuid = (data or {}).get("pdf_uuid")
    if not pdf_uuid:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少 pdf_uuid 参数",
            message_type=MessageType.OUTLINE_LIST_FAILED,
            code=400,
        )
    try:
        result = ctx.pdf_library_api.list_outline_items(pdf_uuid)  # type: ignore[attr-defined]
        # 统一返回字段名为 outline_items，便于前端桥接
        return StandardMessageHandler.build_response(
            MessageType.OUTLINE_LIST_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="大纲获取成功",
            data={"outline_items": result.get("outline_items", [])},
        )
    except Exception as exc:  # noqa: BLE001
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "OUTLINE_LIST_ERROR",
            f"获取大纲失败: {exc}",
            message_type=MessageType.OUTLINE_LIST_FAILED,
            code=500,
        )


def create_outline(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    outline:create:requested
    data: { pdf_uuid: string, name: string, page_at: int, position?: int|null, parent_id?: string|null, order?: int }
    """
    if not _require_api(ctx):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.OUTLINE_CREATE_FAILED,
            code=503,
        )
    payload = data or {}
    pdf_uuid = payload.get("pdf_uuid")
    name = payload.get("name")
    page_at = payload.get("page_at")
    if not pdf_uuid or not isinstance(name, str) or not name.strip() or not isinstance(page_at, int):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少或不合法的参数（pdf_uuid/name/page_at）",
            message_type=MessageType.OUTLINE_CREATE_FAILED,
            code=400,
        )
    try:
        outline_id = ctx.pdf_library_api.create_outline_item(  # type: ignore[attr-defined]
            pdf_uuid=pdf_uuid,
            name=name.strip(),
            page_at=int(page_at),
            position=payload.get("position", None),
            parent_id=payload.get("parent_id"),
            order=payload.get("order"),
        )
        return StandardMessageHandler.build_response(
            MessageType.OUTLINE_CREATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="大纲创建成功",
            data={"outline_id": outline_id},
        )
    except Exception as exc:  # noqa: BLE001
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "OUTLINE_CREATE_ERROR",
            f"创建大纲失败: {exc}",
            message_type=MessageType.OUTLINE_CREATE_FAILED,
            code=500,
        )


def update_outline(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    outline:update:requested
    data: { outline_id: string, update: { name?: string, page_at?: int, position?: int|null, parent_id?: string|null, order?: int } }
    """
    if not _require_api(ctx):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.OUTLINE_UPDATE_FAILED,
            code=503,
        )
    payload = data or {}
    outline_id = payload.get("outline_id")
    update = payload.get("update")
    if not isinstance(outline_id, str) or not outline_id.strip() or not isinstance(update, dict):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少或不合法的参数（outline_id/update）",
            message_type=MessageType.OUTLINE_UPDATE_FAILED,
            code=400,
        )
    try:
        ok = ctx.pdf_library_api.update_outline_item(outline_id, update)  # type: ignore[attr-defined]
        if not ok:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "OUTLINE_NOT_FOUND",
                "指定的大纲不存在",
                message_type=MessageType.OUTLINE_UPDATE_FAILED,
                code=404,
            )
        return StandardMessageHandler.build_response(
            MessageType.OUTLINE_UPDATE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="大纲更新成功",
            data={"outline_id": outline_id},
        )
    except Exception as exc:  # noqa: BLE001
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "OUTLINE_UPDATE_ERROR",
            f"更新大纲失败: {exc}",
            message_type=MessageType.OUTLINE_UPDATE_FAILED,
            code=500,
        )


def delete_outline(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    outline:delete:requested
    data: { outline_id: string, cascade?: bool }
    """
    if not _require_api(ctx):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.OUTLINE_DELETE_FAILED,
            code=503,
        )
    payload = data or {}
    outline_id = payload.get("outline_id")
    if not isinstance(outline_id, str) or not outline_id.strip():
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少或不合法的参数（outline_id）",
            message_type=MessageType.OUTLINE_DELETE_FAILED,
            code=400,
        )
    try:
        ok = ctx.pdf_library_api.delete_outline_item(outline_id, cascade=bool(payload.get("cascade", True)))  # type: ignore[attr-defined]
        if not ok:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "OUTLINE_NOT_FOUND",
                "指定的大纲不存在",
                message_type=MessageType.OUTLINE_DELETE_FAILED,
                code=404,
            )
        return StandardMessageHandler.build_response(
            MessageType.OUTLINE_DELETE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="大纲删除成功",
            data={"outline_id": outline_id},
        )
    except Exception as exc:  # noqa: BLE001
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "OUTLINE_DELETE_ERROR",
            f"删除大纲失败: {exc}",
            message_type=MessageType.OUTLINE_DELETE_FAILED,
            code=500,
        )


def reorder_outline(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    outline:reorder:requested
    data: { outline_id: string, new_parent_id?: string|null, new_index?: int }
    """
    if not _require_api(ctx):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.OUTLINE_REORDER_FAILED,
            code=503,
        )
    payload = data or {}
    outline_id = payload.get("outline_id")
    if not isinstance(outline_id, str) or not outline_id.strip():
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少或不合法的参数（outline_id）",
            message_type=MessageType.OUTLINE_REORDER_FAILED,
            code=400,
        )
    try:
        ctx.pdf_library_api.reorder_outline_item(  # type: ignore[attr-defined]
            outline_id=outline_id,
            new_parent_id=payload.get("new_parent_id", None),
            new_index=int(payload.get("new_index", 0) or 0),
        )
        return StandardMessageHandler.build_response(
            MessageType.OUTLINE_REORDER_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="大纲排序已更新",
            data={"outline_id": outline_id},
        )
    except Exception as exc:  # noqa: BLE001
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "OUTLINE_REORDER_ERROR",
            f"调整顺序失败: {exc}",
            message_type=MessageType.OUTLINE_REORDER_FAILED,
            code=500,
        )

