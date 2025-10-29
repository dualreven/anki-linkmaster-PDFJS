from typing import Dict, Any, Optional
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, PDFMessageBuilder, MessageType


def _require_page_transfer(ctx):
    pt = getattr(ctx, "_page_transfer", None)
    if pt is None:
        raise RuntimeError("缺少必要依赖 page_transfer（禁止兜底）；请在构造 StandardWebSocketServer 时显式注入")
    return pt


def load_page(ctx, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        file_id = data.get("file_id")
        page_number = data.get("page_number")
        compression = data.get("compression", "zlib_base64")
        if not file_id or not page_number:
            return StandardMessageHandler.build_error_response(
                request_id, "INVALID_REQUEST", "缺少必需的file_id或page_number参数"
            )
        pt = _require_page_transfer(ctx)
        page_data = pt.get_page(file_id, page_number, compression)
        return PDFMessageBuilder.build_pdf_page_response(
            request_id, file_id, page_number, page_data, compression
        )
    except Exception as e:
        return PDFMessageBuilder.build_pdf_page_error_response(
            request_id,
            data.get("file_id", "unknown"),
            data.get("page_number", 0),
            "PAGE_EXTRACTION_ERROR",
            f"提取页面失败: {str(e)}",
            retryable=True,
        )


def preload_pages(ctx, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        file_id = data.get("file_id")
        start_page = data.get("start_page", 1)
        end_page = data.get("end_page", 1)
        priority = data.get("priority", "low")
        if not file_id:
            return StandardMessageHandler.build_error_response(
                request_id, "INVALID_REQUEST", "缺少必需的file_id参数"
            )
        pt = _require_page_transfer(ctx)
        preloaded_count = pt.preload_pages(file_id, start_page, end_page, priority)
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
                "end_page": end_page,
            },
        )
    except Exception as e:
        return StandardMessageHandler.build_error_response(
            request_id, "PRELOAD_ERROR", f"预加载页面失败: {str(e)}"
        )


def clear_cache(ctx, request_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        file_id = data.get("file_id")
        keep_pages = data.get("keep_pages")
        if not file_id:
            return StandardMessageHandler.build_error_response(
                request_id, "INVALID_REQUEST", "缺少必需的file_id参数"
            )
        pt = _require_page_transfer(ctx)
        cleared_count = pt.clear_cache(file_id, keep_pages)
        return StandardMessageHandler.build_response(
            "response",
            request_id,
            status="success",
            code=200,
            message=f"缓存清理完成，清理了 {cleared_count} 个页面",
            data={"file_id": file_id, "cleared_count": cleared_count, "keep_pages": keep_pages},
        )
    except Exception as e:
        return StandardMessageHandler.build_error_response(
            request_id, "CACHE_CLEAR_ERROR", f"清理缓存失败: {str(e)}"
        )

