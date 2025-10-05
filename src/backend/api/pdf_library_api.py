"""PDF library API bridging database plugins and frontend requests."""

from __future__ import annotations

import logging
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional

import time

from ..database.config import get_db_path, get_connection_options
from ..database.connection import DatabaseConnectionManager
from ..database.executor import SQLExecutor
from ..database.exceptions import (
    DatabaseConstraintError,
    DatabaseError,
    DatabaseValidationError,
)
from ..database.plugin.event_bus import EventBus
from ..database.plugin.plugin_registry import TablePluginRegistry
from ..database.plugins.pdf_info_plugin import PDFInfoTablePlugin
from ..database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin
from ..database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin
from ..database.plugins.search_condition_plugin import SearchConditionTablePlugin
from ..pdf_manager.standard_manager import StandardPDFManager
from ..pdf_manager.utils import PDFMetadataExtractor, FileValidator
import os
import uuid as uuid_module


class PDFLibraryAPI:
    """Facade exposing database-backed PDF operations for frontend usage."""

    def __init__(
        self,
        db_path: Optional[str] = None,
        *,
        logger: Optional[logging.Logger] = None,
        event_bus: Optional[EventBus] = None,
        pdf_manager: Optional[StandardPDFManager] = None,
    ) -> None:
        self._logger = logger or logging.getLogger("pdf.library.api")
        self._db_path = db_path or str(get_db_path())
        options = get_connection_options()

        self._connection_manager = DatabaseConnectionManager(self._db_path, **options)
        self._executor = SQLExecutor(self._connection_manager.get_connection())
        self._event_bus = event_bus or EventBus()

        self._registry = TablePluginRegistry.get_instance(self._executor, self._event_bus, self._logger)

        self._pdf_info_plugin = PDFInfoTablePlugin(self._executor, self._event_bus, self._logger)
        self._annotation_plugin = PDFAnnotationTablePlugin(self._executor, self._event_bus, self._logger)
        self._bookmark_plugin = PDFBookmarkTablePlugin(self._executor, self._event_bus, self._logger)
        self._search_condition_plugin = SearchConditionTablePlugin(self._executor, self._event_bus, self._logger)

        self._register_plugins()

        self._pdf_manager = pdf_manager
        if self._pdf_manager is None:
            try:
                self._pdf_manager = StandardPDFManager()
            except Exception as exc:  # pragma: no cover - fallback path
                self._logger.warning("StandardPDFManager init failed: %s", exc)
                self._pdf_manager = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        """Close active connections and reset plugin registry state."""
        try:
            self._connection_manager.close_all()
        except DatabaseError as exc:  # pragma: no cover - defensive
            self._logger.error("Failed to close database connections: %s", exc)

    # CRUD ----------------------------------------------------------------

    def create_record(self, data: Dict[str, Any]) -> str:
        payload = self._normalize_input(data)
        return self._pdf_info_plugin.insert(payload)

    def add_pdf_from_file(self, filepath: str) -> Dict[str, Any]:
        """
        从文件路径添加 PDF 到数据库

        Args:
            filepath: PDF 文件的绝对路径

        Returns:
            Dict[str, Any]: 包含新创建记录的信息
            {
                "success": bool,
                "uuid": str,  # 新记录的UUID
                "filename": str,
                "file_size": int,
                "error": str  # 如果失败
            }
        """
        try:
            if not filepath:
                return {
                    "success": False,
                    "error": "文件路径不能为空"
                }

            absolute_path = os.path.abspath(filepath)
            if not os.path.exists(absolute_path):
                return {
                    "success": False,
                    "error": f"文件不存在: {absolute_path}"
                }

            if not FileValidator.is_pdf_file(absolute_path):
                return {
                    "success": False,
                    "error": "仅支持添加 PDF 文件"
                }

            file_size = os.path.getsize(absolute_path)
            filename = os.path.basename(absolute_path)

            if self._pdf_manager is not None:
                success, payload = self._pdf_manager.add_file(absolute_path)
                if not success:
                    error_message = ""
                    if isinstance(payload, dict):
                        error_message = payload.get("message") or payload.get("error") or ""
                    if not error_message:
                        error_message = "PDF文件添加失败"
                    return {
                        "success": False,
                        "error": error_message
                    }

                file_info = payload if isinstance(payload, dict) else {}

                try:
                    record_uuid = self.register_file_info(file_info)
                except Exception as exc:
                    self._logger.error("同步 PDF 信息到数据库失败: %s", exc, exc_info=True)
                    file_id = file_info.get("id")
                    if file_id:
                        try:
                            self._pdf_manager.remove_file(file_id)
                        except Exception as cleanup_exc:  # pragma: no cover - best effort cleanup
                            self._logger.warning("回滚 PDF 添加失败: %s", cleanup_exc)
                    return {
                        "success": False,
                        "error": "同步 PDF 信息到数据库失败"
                    }

                return {
                    "success": True,
                    "uuid": record_uuid,
                    "filename": file_info.get("filename", filename),
                    "file_size": file_info.get("file_size", file_size)
                }

            metadata = PDFMetadataExtractor.extract_metadata(absolute_path)
            if "error" in metadata:
                return {
                    "success": False,
                    "error": metadata["error"]
                }

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
                    "last_accessed_at": 0
                }
            }

            self.create_record(record_data)

            return {
                "success": True,
                "uuid": record_uuid,
                "filename": filename,
                "file_size": file_size
            }

        except Exception as e:
            self._logger.error("添加 PDF 文件失败: %s", e, exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }
    def update_record(self, uuid: str, updates: Dict[str, Any]) -> bool:
        normalized = self._normalize_update(uuid, updates)
        return self._pdf_info_plugin.update(uuid, normalized)

    def delete_record(self, uuid: str) -> bool:
        if self._pdf_manager is not None:
            try:
                # Best-effort removal; ignore failures to keep DB consistent
                self._pdf_manager.remove_file(uuid)
            except Exception as exc:  # pragma: no cover - filesystem errors
                self._logger.warning("remove_file failed for %s: %s", uuid, exc)
        return self._pdf_info_plugin.delete(uuid)

    def get_record(self, uuid: str) -> Optional[Dict[str, Any]]:
        row = self._pdf_info_plugin.query_by_id(uuid)
        if not row:
            return None
        return self._map_to_frontend(row)

    def get_record_detail(self, uuid: str) -> Optional[Dict[str, Any]]:
        record = self.get_record(uuid)
        if record is None:
            return None

        try:
            record["annotation_count"] = self._annotation_plugin.count_by_pdf(uuid)
        except DatabaseError:
            record["annotation_count"] = 0

        try:
            record["bookmark_count"] = self._bookmark_plugin.count_by_pdf(uuid)
        except DatabaseError:
            record["bookmark_count"] = 0

        return record

    def list_records(
        self,
        *,
        include_hidden: bool = True,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        rows = self._pdf_info_plugin.query_all(limit=limit, offset=offset)
        mapped: List[Dict[str, Any]] = []
        for row in rows:
            record = self._map_to_frontend(row)
            if include_hidden or record.get("is_visible", True):
                mapped.append(record)
        return mapped

    def search_records(
        self,
        search_text: str,
        *,
        search_fields: Optional[List[str]] = None,
        include_hidden: bool = True,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        搜索 PDF 记录（支持多关键词搜索）

        Args:
            search_text: 搜索文本（将按空格分词）
            search_fields: 要搜索的字段列表，默认 ['title', 'author', 'filename', 'tags', 'notes']
            include_hidden: 是否包含隐藏记录
            limit: 结果数量限制
            offset: 结果偏移量

        Returns:
            搜索结果字典 {
                "records": [...],  # 记录列表（前端格式）
                "count": 10,       # 结果数量
                "search_text": "关键词1 关键词2"
            }

        Examples:
            >>> api.search_records("Python 编程", limit=50)
            >>> api.search_records("深度学习", search_fields=['title', 'tags'])
        """
        # 按空格分词
        keywords = [kw.strip() for kw in search_text.split() if kw.strip()]

        # 调用插件搜索
        rows = self._pdf_info_plugin.search_records(
            keywords=keywords,
            search_fields=search_fields,
            limit=limit,
            offset=offset
        )

        # 转换格式并过滤隐藏记录
        mapped: List[Dict[str, Any]] = []
        for row in rows:
            record = self._map_to_frontend(row)
            if include_hidden or record.get("is_visible", True):
                mapped.append(record)

        return {
            "records": mapped,
            "count": len(mapped),
            "search_text": search_text
        }

    # Sync helpers --------------------------------------------------------

    def register_file_info(self, file_info: Dict[str, Any]) -> str:
        payload = self._from_pdf_manager_info(file_info)
        try:
            return self._pdf_info_plugin.insert(payload)
        except DatabaseConstraintError:
            self._pdf_info_plugin.update(payload["uuid"], payload)
            return payload["uuid"]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _register_plugins(self) -> None:
        for plugin in (
            self._pdf_info_plugin,
            self._annotation_plugin,
            self._bookmark_plugin,
            self._search_condition_plugin,
        ):
            try:
                self._registry.register(plugin)
            except ValueError:
                # 已注册时跳过
                pass
        self._registry.enable_all()

    @staticmethod
    def _ensure_ms(value: Optional[int]) -> int:
        if value is None:
            return 0
        if value == 0:
            return 0
        if value > 10 ** 12:
            return int(value)
        if value < 0:
            return 0
        return int(value * 1000)

    @staticmethod
    def _ensure_seconds(value: Optional[int]) -> int:
        if value is None:
            return 0
        if value >= 10 ** 12:
            return int(value // 1000)
        return int(value)

    @staticmethod
    def _parse_datetime_to_ms(value: Optional[str]) -> int:
        if not value:
            return 0
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            return int(parsed.timestamp() * 1000)
        except ValueError:
            return 0

    @staticmethod
    def _normalize_tags(tags: Any) -> List[str]:
        if tags is None:
            return []
        if isinstance(tags, list):
            return [str(tag) for tag in tags]
        if isinstance(tags, str):
            return [item.strip() for item in tags.split(",") if item.strip()]
        return [str(tag) for tag in list(tags)]

    def _normalize_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "uuid" in data and "json_data" in data:
            payload = deepcopy(data)
        else:
            payload = self._from_frontend_record(data)

        payload.setdefault("created_at", int(time.time() * 1000))
        payload.setdefault("updated_at", payload["created_at"])
        payload.setdefault("visited_at", payload["json_data"].get("last_accessed_at", 0))
        payload.setdefault("version", 1)
        payload["json_data"]["tags"] = self._normalize_tags(payload["json_data"].get("tags", []))
        payload["json_data"].setdefault("filename", payload.get("title", ""))
        payload["json_data"].setdefault("filepath", payload["json_data"].get("filepath", ""))
        payload["json_data"].setdefault("is_visible", True)
        payload["json_data"].setdefault("review_count", 0)
        payload["json_data"].setdefault("total_reading_time", 0)
        payload["json_data"].setdefault("rating", 0)
        payload["json_data"].setdefault("due_date", 0)
        payload["json_data"]["last_accessed_at"] = self._ensure_ms(
            payload["json_data"].get("last_accessed_at", payload.get("visited_at", 0))
        )
        payload["created_at"] = self._ensure_ms(payload.get("created_at"))
        payload["updated_at"] = self._ensure_ms(payload.get("updated_at"))
        payload["visited_at"] = self._ensure_ms(payload.get("visited_at", 0))
        payload["json_data"]["due_date"] = self._ensure_ms(payload["json_data"].get("due_date", 0))
        return payload

    def _normalize_update(self, uuid: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if not updates:
            return {}

        if "json_data" in updates:
            payload = deepcopy(updates)
        else:
            payload: Dict[str, Any] = {}
            json_updates: Dict[str, Any] = {}

            for key, value in updates.items():
                if key in {"title", "author", "page_count", "file_size", "version"}:
                    payload[key] = value
                elif key == "created_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "updated_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "visited_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "last_accessed_at":
                    ms_value = self._ensure_ms(value)
                    payload["visited_at"] = ms_value
                    json_updates["last_accessed_at"] = ms_value
                elif key == "filename":
                    json_updates["filename"] = value
                elif key == "file_path":
                    json_updates["filepath"] = value
                elif key == "tags":
                    json_updates["tags"] = self._normalize_tags(value)
                elif key == "rating":
                    json_updates["rating"] = value
                elif key == "is_visible":
                    json_updates["is_visible"] = bool(value)
                elif key == "total_reading_time":
                    json_updates["total_reading_time"] = int(value)
                elif key == "due_date":
                    json_updates["due_date"] = self._ensure_ms(value)
                elif key == "review_count":
                    json_updates["review_count"] = int(value)
                elif key == "notes":
                    json_updates["notes"] = value
                elif key == "subject":
                    json_updates["subject"] = value
                elif key == "keywords":
                    json_updates["keywords"] = value

            if json_updates:
                payload["json_data"] = json_updates

        if "json_data" in payload:
            json_data = payload["json_data"]
            if "tags" in json_data:
                json_data["tags"] = self._normalize_tags(json_data["tags"])
            if "last_accessed_at" in json_data:
                json_data["last_accessed_at"] = self._ensure_ms(json_data["last_accessed_at"])
            if "due_date" in json_data:
                json_data["due_date"] = self._ensure_ms(json_data["due_date"])

        for key in ("created_at", "updated_at", "visited_at"):
            if key in payload:
                payload[key] = self._ensure_ms(payload[key])
        return payload
    def _from_frontend_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        now_ms = int(time.time() * 1000)
        uuid = record.get("uuid") or record.get("id")
        if not uuid:
            raise DatabaseValidationError("uuid is required")

        created_at = record.get("created_at")
        updated_at = record.get("updated_at", created_at)
        last_accessed = record.get("last_accessed_at", 0)

        json_data = {
            "filename": record.get("filename", ""),
            "filepath": record.get("file_path", ""),
            "tags": self._normalize_tags(record.get("tags")),
            "rating": record.get("rating", 0),
            "is_visible": record.get("is_visible", True),
            "total_reading_time": record.get("total_reading_time", 0),
            "last_accessed_at": self._ensure_ms(last_accessed),
            "review_count": record.get("review_count", 0),
            "due_date": self._ensure_ms(record.get("due_date", 0)),
            "notes": record.get("notes", ""),
        }
        for extra_key in ("subject", "keywords", "thumbnail_path"):
            value = record.get(extra_key)
            if value is not None:
                json_data[extra_key] = value

        payload = {
            "uuid": uuid,
            "title": record.get("title") or record.get("filename", ""),
            "author": record.get("author", ""),
            "page_count": record.get("page_count", 0),
            "file_size": record.get("file_size", 0),
            "created_at": self._ensure_ms(created_at) if created_at is not None else now_ms,
            "updated_at": self._ensure_ms(updated_at) if updated_at is not None else now_ms,
            "visited_at": self._ensure_ms(last_accessed),
            "version": record.get("version", 1),
            "json_data": json_data,
        }
        return payload

    def _from_pdf_manager_info(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        uuid = file_info.get("id")
        if not uuid:
            raise DatabaseValidationError("file info missing id")

        metadata = file_info.get("metadata") or {}
        created_at = self._parse_datetime_to_ms(file_info.get("created_time"))
        updated_at = self._parse_datetime_to_ms(file_info.get("modified_time")) or created_at
        last_accessed = file_info.get("last_accessed_at", metadata.get("last_accessed_at", 0))

        storage_path = file_info.get("filepath") or metadata.get("filepath", "")
        original_path = (
            file_info.get("original_path")
            or metadata.get("original_path")
            or storage_path
        )

        json_data = {
            "filename": file_info.get("filename", ""),
            "filepath": storage_path,
            "original_path": original_path,
            "tags": self._normalize_tags(file_info.get("tags") or metadata.get("tags")),
            "rating": file_info.get("rating", metadata.get("rating", 0)),
            "is_visible": file_info.get("is_visible", metadata.get("is_visible", True)),
            "total_reading_time": file_info.get("total_reading_time", metadata.get("total_reading_time", 0)),
            "last_accessed_at": self._ensure_ms(last_accessed),
            "review_count": file_info.get("review_count", metadata.get("review_count", 0)),
            "due_date": self._ensure_ms(file_info.get("due_date", metadata.get("due_date", 0))),
            "notes": file_info.get("notes", metadata.get("notes", "")),
            "thumbnail_path": file_info.get("thumbnail_path") or metadata.get("thumbnail_path"),
            "subject": metadata.get("subject", file_info.get("subject", "")),
            "keywords": metadata.get("keywords", file_info.get("keywords", "")),
        }

        payload = {
            "uuid": uuid,
            "title": file_info.get("title") or metadata.get("title") or file_info.get("filename", ""),
            "author": file_info.get("author", metadata.get("author", "")),
            "page_count": file_info.get("page_count", metadata.get("page_count", 0)),
            "file_size": file_info.get("file_size", metadata.get("file_size", 0)),
            "created_at": created_at or int(time.time() * 1000),
            "updated_at": updated_at or int(time.time() * 1000),
            "visited_at": self._ensure_ms(last_accessed),
            "version": 1,
            "json_data": json_data,
        }
        return payload
    def _map_to_frontend(self, row: Dict[str, Any]) -> Dict[str, Any]:
        json_data = deepcopy(row.get("json_data", {}))
        created_at = row.get("created_at", 0)
        last_accessed = json_data.get("last_accessed_at", row.get("visited_at", 0))
        due_date = json_data.get("due_date", 0)

        record = {
            "id": row["uuid"],
            "title": row.get("title", ""),
            "author": row.get("author", ""),
            "filename": json_data.get("filename", ""),
            "file_path": json_data.get("filepath", ""),
            "file_size": row.get("file_size", 0),
            "page_count": row.get("page_count", 0),
            "created_at": self._ensure_seconds(created_at),
            "updated_at": self._ensure_seconds(row.get("updated_at", created_at)),
            "last_accessed_at": self._ensure_seconds(last_accessed),
            "review_count": json_data.get("review_count", 0),
            "rating": json_data.get("rating", 0),
            "tags": self._normalize_tags(json_data.get("tags")),
            "is_visible": bool(json_data.get("is_visible", True)),
            "total_reading_time": json_data.get("total_reading_time", 0),
            "due_date": self._ensure_seconds(due_date),
            "notes": json_data.get("notes", ""),
            "subject": json_data.get("subject", ""),
            "keywords": json_data.get("keywords", ""),
        }
        return record

