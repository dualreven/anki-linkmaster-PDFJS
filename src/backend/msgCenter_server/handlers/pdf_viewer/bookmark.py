from typing import Dict, Any, Optional
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType


def list_bookmarks(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.BOOKMARK_LIST_FAILED,
            code=503,
        )
    pdf_uuid = (data or {}).get("pdf_uuid")
    if not pdf_uuid:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少 pdf_uuid 参数",
            message_type=MessageType.BOOKMARK_LIST_FAILED,
            code=400,
        )
    try:
        result = ctx.pdf_library_api.list_bookmarks(pdf_uuid)
        return StandardMessageHandler.build_response(
            MessageType.BOOKMARK_LIST_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="书签获取成功",
            data=result,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "BOOKMARK_LIST_ERROR",
            f"获取书签失败: {exc}",
            message_type=MessageType.BOOKMARK_LIST_FAILED,
            code=500,
        )


def save_bookmarks(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.BOOKMARK_SAVE_FAILED,
            code=503,
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
            code=400,
        )
    if not isinstance(bookmarks, list):
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "bookmarks 必须为数组",
            message_type=MessageType.BOOKMARK_SAVE_FAILED,
            code=400,
        )
    try:
        saved = ctx.pdf_library_api.save_bookmarks(pdf_uuid, bookmarks, root_ids=root_ids)
        return StandardMessageHandler.build_response(
            MessageType.BOOKMARK_SAVE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="书签保存成功",
            data={"saved": saved},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "BOOKMARK_SAVE_ERROR",
            f"保存书签失败: {exc}",
            message_type=MessageType.BOOKMARK_SAVE_FAILED,
            code=500,
        )


def reset_bookmarks(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    payload = data or {}
    pdf_uuid = payload.get("pdf_uuid")
    if not pdf_uuid:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INVALID_REQUEST",
            "缺少 pdf_uuid 参数",
            message_type=MessageType.BOOKMARK_LIST_FAILED,
            code=400,
        )
    try:
        cleared = 0
        if hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api:
            cleared = ctx.pdf_library_api.clear_bookmarks(pdf_uuid)
        return StandardMessageHandler.build_response(
            MessageType.BOOKMARK_LIST_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="书签已清空",
            data={"cleared": int(cleared)},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "BOOKMARK_RESET_ERROR",
            f"重置书签失败: {exc}",
            message_type=MessageType.BOOKMARK_LIST_FAILED,
            code=500,
        )

