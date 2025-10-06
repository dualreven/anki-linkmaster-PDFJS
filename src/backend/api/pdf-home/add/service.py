from __future__ import annotations

from typing import Any, Dict, Optional
import os
import time


class AddService:
    """Interface-like base for add/import service."""

    def register_file_info(self, file_info: Dict[str, Any], *, context: Optional[Any] = None) -> str:
        raise NotImplementedError

    def add_pdf_from_file(self, filepath: str, *, context: Optional[Any] = None) -> Dict[str, Any]:
        raise NotImplementedError


class DefaultAddService(AddService):
    def register_file_info(self, file_info: Dict[str, Any], *, context: Optional[Any] = None) -> str:
        if context is None:
            raise ValueError("context is required for DefaultAddService.register_file_info")
        payload = context._from_pdf_manager_info(file_info)  # type: ignore[attr-defined]
        try:
            return context._pdf_info_plugin.insert(payload)  # type: ignore[attr-defined]
        except Exception:
            context._pdf_info_plugin.update(payload["uuid"], payload)  # type: ignore[attr-defined]
            return payload["uuid"]

    def add_pdf_from_file(self, filepath: str, *, context: Optional[Any] = None) -> Dict[str, Any]:
        if context is None:
            raise ValueError("context is required for DefaultAddService.add_pdf_from_file")
        try:
            if not filepath:
                return {"success": False, "error": "文件路径不能为空"}

            absolute_path = os.path.abspath(filepath)
            if not os.path.exists(absolute_path):
                return {"success": False, "error": f"文件不存在: {absolute_path}"}

            # Lazy import utilities to avoid hard dependency when unused
            from ...pdf_manager.utils import FileValidator  # type: ignore

            if not FileValidator.is_pdf_file(absolute_path):
                return {"success": False, "error": "仅支持添加 PDF 文件"}

            file_size = os.path.getsize(absolute_path)
            filename = os.path.basename(absolute_path)

            # 优先通过 pdf_manager 添加
            if context._pdf_manager is not None:  # type: ignore[attr-defined]
                success, payload = context._pdf_manager.add_file(absolute_path)  # type: ignore[attr-defined]
                if not success:
                    error_message = ""
                    if isinstance(payload, dict):
                        error_message = payload.get("message") or payload.get("error") or ""
                    if not error_message:
                        error_message = "PDF文件添加失败"
                    return {"success": False, "error": error_message}

                file_info = payload if isinstance(payload, dict) else {}

                # 同步到数据库
                try:
                    record_uuid = self.register_file_info(file_info, context=context)
                except Exception as exc:  # noqa: F841 - log on context
                    context._logger.error("同步 PDF 信息到数据库失败: %s", exc, exc_info=True)  # type: ignore[attr-defined]
                    file_id = file_info.get("id")
                    if file_id:
                        try:
                            context._pdf_manager.remove_file(file_id)  # type: ignore[attr-defined]
                        except Exception as cleanup_exc:  # pragma: no cover
                            context._logger.warning("回滚 PDF 添加失败: %s", cleanup_exc)  # type: ignore[attr-defined]
                    return {"success": False, "error": "同步 PDF 信息到数据库失败"}

                return {
                    "success": True,
                    "uuid": record_uuid,
                    "filename": file_info.get("filename", filename),
                    "file_size": file_info.get("file_size", file_size),
                }

            # 无 manager，直接从文件构建记录
            from ...pdf_manager.pdf_metadata_extractor import PDFMetadataExtractor  # type: ignore

            metadata = PDFMetadataExtractor.extract_metadata(absolute_path)
            if "error" in metadata:
                return {"success": False, "error": metadata["error"]}

            import uuid as uuid_module

            record_uuid = uuid_module.uuid4().hex[:12]
            current_time_ms = int(time.time() * 1000)
            record_data = {
                "uuid": record_uuid,
                "title": metadata.get("title", filename),
                "author": metadata.get("author", ""),
                "page_count": metadata.get("page_count", 0),
                "file_size": file_size,
                "created_at": current_time_ms,
                "updated_at": current_time_ms,
                "visited_at": 0,
                "version": 1,
                "json_data": {
                    "filename": f"{record_uuid}.pdf",
                    "original_filename": filename,
                    "filepath": absolute_path,
                    "original_path": absolute_path,
                    "subject": metadata.get("subject", ""),
                    "keywords": metadata.get("keywords", ""),
                    "creator": metadata.get("creator", ""),
                    "producer": metadata.get("producer", ""),
                    "page_count": metadata.get("page_count", 0),
                    "tags": [],
                    "notes": "",
                    "rating": 0,
                    "is_visible": True,
                    "review_count": 0,
                    "total_reading_time": 0,
                    "due_date": 0,
                    "last_accessed_at": 0,
                },
            }

            context.create_record(record_data)  # type: ignore[attr-defined]
            return {"success": True, "uuid": record_uuid, "filename": f"{record_uuid}.pdf", "file_size": file_size}
        except Exception as exc:
            # use context logger if available
            try:
                context._logger.error("添加 PDF 文件失败: %s", exc, exc_info=True)  # type: ignore[attr-defined]
            except Exception:
                pass
            return {"success": False, "error": f"添加 PDF 文件失败: {str(exc)}"}

