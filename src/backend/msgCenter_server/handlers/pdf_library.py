from typing import Dict, Any, Optional
import os
import json
import time
from src.backend.msgCenter_server.standard_protocol import (
    StandardMessageHandler,
    PDFMessageBuilder,
    MessageType,
)
from src.backend.msgCenter_server.utils.config_path import get_pdf_home_config_path


def list_files(ctx, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
    try:
        limit = None
        offset = None
        if isinstance(data, dict):
            pg = data.get("pagination") or {}
            try:
                limit = int(pg.get("limit")) if pg.get("limit") is not None else None
            except Exception:
                limit = None
            try:
                offset = int(pg.get("offset")) if pg.get("offset") is not None else None
            except Exception:
                offset = None
        if hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api:
            files = ctx.pdf_library_api.list_records(limit=limit, offset=offset)
        else:
            files = ctx.pdf_manager.get_files() if hasattr(ctx, "pdf_manager") and ctx.pdf_manager else []
        return PDFMessageBuilder.build_pdf_list_response(
            request_id or StandardMessageHandler.generate_request_id(),
            files,
            pagination={"limit": limit, "offset": offset} if (limit is not None or offset is not None) else None,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "LIST_ERROR",
            f"获取PDF列表失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_LIST_FAILED,
            code=500,
        )


def detail(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        pdf_id = None
        if isinstance(data, dict):
            pdf_id = data.get("pdf_id") or data.get("file_id") or data.get("uuid")
        if not pdf_id:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 pdf_id/file_id/uuid 参数",
                message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
                code=400,
            )
        detail_obj = None
        if hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api:
            detail_obj = ctx.pdf_library_api.get_record_detail(pdf_id)
        if detail_obj is None and hasattr(ctx, "pdf_manager") and ctx.pdf_manager:
            detail_obj = ctx.pdf_manager.get_file_detail(pdf_id)
        if detail_obj is None:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "NOT_FOUND",
                f"未找到PDF: {pdf_id}",
                message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
                code=404,
            )
        return StandardMessageHandler.build_response(
            MessageType.PDF_LIBRARY_INFO_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="PDF详情获取成功",
            data=detail_obj,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "DETAIL_ERROR",
            f"获取PDF详情失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_INFO_FAILED,
            code=500,
        )


def remove_batch(ctx, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
    try:
        file_ids = []
        if isinstance(data, dict):
            file_ids = data.get("file_ids") or data.get("ids") or []
        if not isinstance(file_ids, list) or not file_ids:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 file_ids 列表",
                message_type=MessageType.PDF_LIBRARY_REMOVE_FAILED,
                code=400,
            )
        removed = []
        failed = {}
        for fid in file_ids:
            ok = False
            reasons = []
            had_error = False
            db_not_found = False
            fs_not_found = False

            # 1) 数据库记录删除
            db_ok = False
            if hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api:
                try:
                    db_ok = bool(ctx.pdf_library_api.delete_record(fid))
                    if not db_ok:
                        # 进一步判定是否不存在
                        try:
                            record = ctx.pdf_library_api.get_record(fid)  # type: ignore[attr-defined]
                            if record is None:
                                db_not_found = True
                            else:
                                reasons.append("数据库记录删除失败")
                        except Exception as iexc:
                            had_error = True
                            reasons.append(f"DB: {iexc}")
                except Exception as exc:
                    db_ok = False
                    had_error = True
                    reasons.append(f"DB: {exc}")

            # 2) 运行内存/文件管理器文件删除（最佳努力）
            fs_ok = False
            if hasattr(ctx, "pdf_manager") and ctx.pdf_manager:
                try:
                    fs_ok = bool(ctx.pdf_manager.remove_file(fid))
                    if not fs_ok:
                        try:
                            exists = False
                            try:
                                exists = bool(ctx.pdf_manager.file_list.exists(fid))  # type: ignore[attr-defined]
                            except Exception:
                                exists = False
                            if not exists:
                                fs_not_found = True
                            else:
                                reasons.append("文件删除失败")
                        except Exception:
                            had_error = True
                            reasons.append("文件删除失败")
                except Exception as exc:
                    fs_ok = False
                    had_error = True
                    reasons.append(f"FS: {exc}")

            # 3) 计算最终结果：任一链路成功 => 成功；若均未成功但完全不存在且无硬错误 => 幂等成功
            ok = bool(db_ok or fs_ok)
            if not ok and not had_error and (db_not_found or fs_not_found):
                ok = True

            if ok:
                removed.append(fid)
            else:
                reason_text = "; ".join([str(r) for r in reasons if r]) or "删除失败"
                failed[str(fid)] = reason_text
        return PDFMessageBuilder.build_batch_pdf_remove_response(
            request_id or StandardMessageHandler.generate_request_id(),
            removed,
            failed_files=failed or None,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "REMOVE_ERROR",
            f"批量删除失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_REMOVE_FAILED,
            code=500,
        )


def open_viewer_ack(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """仅回执已接收，实际启动由外层完成。"""
    try:
        pdf_id = (data or {}).get("pdf_id") or (data or {}).get("file_id")
        payload = {"file_id": pdf_id} if pdf_id else {}
        return StandardMessageHandler.build_response(
            MessageType.PDF_LIBRARY_VIEWER_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="accepted",
            code=202,
            message="查看器请求已接收，后端将异步处理",
            data=payload,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "VIEWER_ERROR",
            f"打开查看器失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_VIEWER_FAILED,
            code=500,
        )


def add_pdf(ctx, request_id: Optional[str], data: Dict[str, Any], *, original_type: Optional[str] = None) -> Dict[str, Any]:
    try:
        if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                code=503,
            )
        filepath = (data or {}).get("filepath")
        if not filepath:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 filepath 参数",
                message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                code=400,
            )
        result = ctx.pdf_library_api.add_pdf_from_file(filepath)
        if result and result.get("success"):
            file_payload = {
                "id": result.get("uuid"),
                "filename": result.get("filename"),
                "file_size": result.get("file_size"),
            }
            return StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_ADD_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="添加PDF成功",
                data={"file": file_payload, "original_type": original_type or MessageType.PDF_LIBRARY_ADD_REQUESTED.value},
            )
        else:
            err_msg = (result or {}).get("error") or "添加 PDF 失败"
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "PDF_ADD_ERROR",
                err_msg,
                message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
                code=400,
            )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INTERNAL_ERROR",
            f"添加PDF失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_ADD_FAILED,
            code=500,
        )


def search(ctx, request_id: Optional[str], data: Dict[str, Any], raw_message: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if not hasattr(ctx, "pdf_library_api") or not ctx.pdf_library_api:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "SERVICE_UNAVAILABLE",
                "PDFLibraryAPI 未初始化",
                message_type=MessageType.PDF_LIBRARY_SEARCH_FAILED,
                code=503,
            )

        # 解析入参
        query = "" if not isinstance(data, dict) else str(data.get("query", "") or "")
        try:
            limit = int(data.get("limit", 50)) if isinstance(data, dict) else 50
        except Exception:
            limit = 50
        try:
            offset = int(data.get("offset", 0)) if isinstance(data, dict) else 0
        except Exception:
            offset = 0

        tokens = [t.strip().lower() for t in query.split() if str(t).strip()]

        filters = (data or {}).get("filters") if isinstance(data, dict) else None
        sort_rules = (data or {}).get("sort") if isinstance(data, dict) else None
        search_fields = (data or {}).get("search_fields") if isinstance(data, dict) else None

        payload = {
            "query": query,
            "tokens": tokens,
            "filters": filters,
            "sort": sort_rules,
            "search_fields": search_fields,
            "pagination": {"limit": limit, "offset": offset, "need_total": True},
        }

        search_result = ctx.pdf_library_api.search_records(payload)
        records = search_result.get("records", [])
        total = search_result.get("total", len(records))

        # 兼容：若空查询且数据库暂无同步记录，则回退到运行内存的 pdf_manager 列表
        if (not tokens) and (not records) and hasattr(ctx, "pdf_manager") and ctx.pdf_manager:
            try:
                pm_files = ctx.pdf_manager.get_files() or []
                records = pm_files
                total = len(records)
            except Exception:
                pass

        data_payload = {"files": records, "total_count": total, "search_text": query}
        return StandardMessageHandler.build_response(
            MessageType.PDF_LIBRARY_SEARCH_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="搜索成功",
            data=data_payload,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "SEARCH_ERROR",
            f"搜索失败: {exc}",
            message_type=MessageType.PDF_LIBRARY_SEARCH_FAILED,
            code=500,
        )


def config_read(ctx, request_id: Optional[str]) -> Dict[str, Any]:
    try:
        cfg_path = get_pdf_home_config_path(getattr(ctx, "pdf_manager", None))
        config_obj = {"recent_search": [], "saved_filters": []}
        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                try:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        config_obj.update(loaded)
                except Exception:
                    # 保持默认对象
                    pass
        else:
            with open(cfg_path, "w", encoding="utf-8", newline="\n") as f:
                json.dump(config_obj, f, ensure_ascii=False, indent=2)
        return StandardMessageHandler.build_response(
            MessageType.PDF_LIBRARY_CONFIG_READ_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="读取配置成功",
            data={"config": config_obj, "original_type": MessageType.PDF_LIBRARY_CONFIG_READ_REQUESTED.value},
        )
    except Exception as e:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INTERNAL_ERROR",
            f"读取配置失败: {e}",
            message_type=MessageType.PDF_LIBRARY_CONFIG_READ_FAILED,
            code=500,
        )


def config_write(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        cfg_path = get_pdf_home_config_path(getattr(ctx, "pdf_manager", None))
        config_obj = {"recent_search": [], "saved_filters": []}
        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                try:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        config_obj.update(loaded)
                except Exception:
                    # 将覆盖为新配置
                    pass

        recent = (data or {}).get("recent_search")
        if isinstance(recent, list):
            cleaned = []
            for it in recent:
                if isinstance(it, dict) and isinstance(it.get("text"), str):
                    cleaned.append({"text": it.get("text", ""), "ts": it.get("ts") or 0})
            config_obj["recent_search"] = cleaned

        saved_filters = (data or {}).get("saved_filters")
        if isinstance(saved_filters, list):
            cleaned_sf = []
            for it in saved_filters:
                if not isinstance(it, dict):
                    continue
                name = it.get("name") if isinstance(it.get("name"), str) else ""
                search_text = it.get("searchText") if isinstance(it.get("searchText"), str) else ""
                filters = it.get("filters") if isinstance(it.get("filters"), (dict, list)) or it.get("filters") is None else None
                sort = it.get("sort") if isinstance(it.get("sort"), list) else []
                ts = it.get("ts") or 0
                _id = it.get("id") if isinstance(it.get("id"), str) else None
                cleaned_sf.append({
                    "id": _id or f"sf_{int(time.time()*1000)}",
                    "name": name,
                    "searchText": search_text,
                    "filters": filters,
                    "sort": sort,
                    "ts": ts,
                })
            config_obj["saved_filters"] = cleaned_sf

        with open(cfg_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(config_obj, f, ensure_ascii=False, indent=2)

        return StandardMessageHandler.build_response(
            MessageType.PDF_LIBRARY_CONFIG_WRITE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="更新配置成功",
            data={"config": config_obj, "original_type": MessageType.PDF_LIBRARY_CONFIG_WRITE_REQUESTED.value},
        )
    except Exception as e:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INTERNAL_ERROR",
            f"更新配置失败: {e}",
            message_type=MessageType.PDF_LIBRARY_CONFIG_WRITE_FAILED,
            code=500,
        )


def record_update(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    """优先更新数据库，失败时回退文件管理器；成功后广播列表变更。"""
    try:
        payload = data if isinstance(data, dict) else {}
        file_id = (
            payload.get("file_id")
            or payload.get("pdf_id")
            or payload.get("uuid")
            or payload.get("id")
        )
        updates = payload.get("updates", {})

        if not file_id:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少必需的 file_id/uuid 参数",
                message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                code=400,
            )

        if not isinstance(updates, dict) or not updates:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 updates 参数",
                message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
                code=400,
            )

        success = False
        error_msg: Optional[str] = None

        if hasattr(ctx, "pdf_library_api") and ctx.pdf_library_api:
            try:
                success = bool(ctx.pdf_library_api.update_record(str(file_id), updates))  # type: ignore[attr-defined]
                if not success:
                    error_msg = "数据库更新失败"
            except Exception as exc:
                success = False
                error_msg = f"数据库更新失败: {exc}"

        if not success and hasattr(ctx, "pdf_manager") and ctx.pdf_manager:
            try:
                success = bool(ctx.pdf_manager.update_file(str(file_id), updates))
            except Exception as exc:
                success = False
                error_msg = f"文件管理器更新失败: {exc}"

        if success:
            ctx.on_pdf_list_changed()
            return StandardMessageHandler.build_response(
                MessageType.PDF_LIBRARY_RECORD_UPDATE_COMPLETED,
                request_id or StandardMessageHandler.generate_request_id(),
                status="success",
                code=200,
                message="PDF记录更新成功",
                data={"id": str(file_id), "updates": updates},
            )

        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "UPDATE_FAILED",
            error_msg or "PDF记录更新失败",
            message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
            code=500,
        )
    except Exception as e:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "UPDATE_ERROR",
            f"更新PDF失败: {e}",
            message_type=MessageType.PDF_LIBRARY_RECORD_UPDATE_FAILED,
            code=500,
        )
