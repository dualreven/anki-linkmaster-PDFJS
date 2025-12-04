from typing import Dict, Any, Optional
import time
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType
from src.backend.msgCenter_server.utils.time import iso_to_ms, ms_to_iso


def list_annotations(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.ANNOTATION_LIST_FAILED,
                code=503,
            )
        pdf_uuid = (data or {}).get("pdf_uuid")
        if not pdf_uuid:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 pdf_uuid 参数",
                message_type=MessageType.ANNOTATION_LIST_FAILED,
                code=400,
            )
        rows = ctx.pdf_library_api._annotation_plugin.query_by_pdf(pdf_uuid)
        annotations = []
        for row in rows:
            annotations.append({
                "id": row.get("ann_id"),
                "pdfId": row.get("pdf_uuid"),
                "type": row.get("type"),
                "pageNumber": row.get("page_number"),
                "data": row.get("data") or {},
                "comments": row.get("comments") or [],
                "createdAt": ms_to_iso(row.get("created_at")),
                "updatedAt": ms_to_iso(row.get("updated_at")),
                "title": row.get("title"),
            })
        return StandardMessageHandler.build_response(
            MessageType.ANNOTATION_LIST_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="标注列表获取成功",
            data={"annotations": annotations, "count": len(annotations)},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "ANNOTATION_LIST_ERROR",
            f"标注获取失败: {exc}",
            message_type=MessageType.ANNOTATION_LIST_FAILED,
            code=500,
        )


def save_annotation(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.ANNOTATION_SAVE_FAILED,
                code=503,
            )
        payload = data or {}
        pdf_uuid = payload.get("pdf_uuid")
        annotation = payload.get("annotation") or {}
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

        ann_id = annotation.get("id")
        page_number = annotation.get("pageNumber")
        ann_type = annotation.get("type")
        title = annotation.get("title")
        json_data = {
            "data": annotation.get("data") or {},
            "comments": annotation.get("comments") or [],
        }
        created_ms = iso_to_ms(annotation.get("createdAt"))
        updated_ms = iso_to_ms(annotation.get("updatedAt"))

        created = False
        updated = False

        if ann_id and ctx.pdf_library_api._annotation_plugin.query_by_id(ann_id):
            updated = ctx.pdf_library_api._annotation_plugin.update(ann_id, {
                "pdf_uuid": pdf_uuid,
                "page_number": page_number,
                "type": ann_type,
                "created_at": created_ms,
                "updated_at": updated_ms,
                "json_data": json_data,
                "title": title,
            })
        else:
            import random, string
            rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
            row = {
                "ann_id": ann_id or f"ann_{int(time.time()*1000)}_{rand}",
                "pdf_uuid": pdf_uuid,
                "page_number": page_number,
                "type": ann_type,
                "created_at": created_ms,
                "updated_at": updated_ms,
                "version": 1,
                "json_data": json_data,
                "title": title,
            }
            ann_id = ctx.pdf_library_api._annotation_plugin.insert(row)
            created = True

        return StandardMessageHandler.build_response(
            MessageType.ANNOTATION_SAVE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="标注保存成功",
            data={"id": ann_id, "created": bool(created), "updated": bool(updated)},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "ANNOTATION_SAVE_ERROR",
            f"保存标注失败: {exc}",
            message_type=MessageType.ANNOTATION_SAVE_FAILED,
            code=500,
        )


def delete_annotation(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.ANNOTATION_DELETE_FAILED,
                code=503,
            )
        ann_id = (data or {}).get("ann_id") or (data or {}).get("id")
        if not ann_id:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 ann_id 参数",
                message_type=MessageType.ANNOTATION_DELETE_FAILED,
                code=400,
            )
        ok = ctx.pdf_library_api._annotation_plugin.delete(ann_id)
        return StandardMessageHandler.build_response(
            MessageType.ANNOTATION_DELETE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="标注删除成功",
            data={"ok": bool(ok)},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "ANNOTATION_DELETE_ERROR",
            f"删除标注失败: {exc}",
            message_type=MessageType.ANNOTATION_DELETE_FAILED,
            code=500,
        )
