from typing import Any, Dict, Optional

from src.backend.msgCenter_server.core.message_types import MessageType
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler


def annotation_bulk_get(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    request_id = request_id or StandardMessageHandler.generate_request_id()

    plugin = getattr(getattr(ctx, "pdf_library_api", None), "_annotation_plugin", None)
    if not plugin:
        return StandardMessageHandler.build_error_response(
            request_id,
            "SERVICE_UNAVAILABLE",
            "PDFLibraryAPI 未初始化",
            message_type=MessageType.ANNOTATION_BULK_GET_FAILED,
            code=503,
        )

    payload = data or {}
    ann_ids = payload.get("ann_ids")
    if not isinstance(ann_ids, list) or not ann_ids:
        return StandardMessageHandler.build_error_response(
            request_id,
            "INVALID_REQUEST",
            "ann_ids 必须为至少一个非空字符串",
            message_type=MessageType.ANNOTATION_BULK_GET_FAILED,
            code=400,
        )

    for ann_id in ann_ids:
        if not isinstance(ann_id, str) or not ann_id.strip():
            return StandardMessageHandler.build_error_response(
                request_id,
                "INVALID_REQUEST",
                "ann_ids 中的每个 id 必须为非空字符串",
                message_type=MessageType.ANNOTATION_BULK_GET_FAILED,
                code=400,
            )

    annotations = []
    for ann_id in ann_ids:
        row = plugin.query_by_id(ann_id)
        if not row:
            return StandardMessageHandler.build_error_response(
                request_id,
                "ANNOTATION_NOT_FOUND",
                f"标注 {ann_id} 不存在",
                message_type=MessageType.ANNOTATION_BULK_GET_FAILED,
                code=400,
            )
        annotations.append({
            "id": row.get("ann_id", ann_id),
            "title": row.get("title"),
            "type": row.get("type"),
            "pageNumber": row.get("page_number"),
            "pdfId": row.get("pdf_uuid"),
        })

    return StandardMessageHandler.build_response(
        MessageType.ANNOTATION_BULK_GET_COMPLETED,
        request_id,
        status="success",
        code=200,
        message="标注元信息批量获取成功",
        data={"annotations": annotations},
    )
