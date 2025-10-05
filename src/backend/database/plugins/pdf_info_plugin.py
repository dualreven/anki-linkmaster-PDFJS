"""PDF 信息表插件实现"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFInfoTablePlugin(TablePlugin):
    """管理 pdf_info 表的插件实现。"""

    _UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
    _FILENAME_PATTERN = re.compile(r"^[a-f0-9]{12}\.pdf$")
    _ORDERABLE_COLUMNS = {"created_at", "updated_at", "title", "author"}

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return "pdf_info"

    @property
    def version(self) -> str:
        return "1.0.0"

    # ==================== 建表 ====================

    def create_table(self) -> None:
        script = """
        CREATE TABLE IF NOT EXISTS pdf_info (
            uuid TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            author TEXT DEFAULT '',
            page_count INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            visited_at INTEGER DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data))
        );

        CREATE INDEX IF NOT EXISTS idx_pdf_title ON pdf_info(title);
        CREATE INDEX IF NOT EXISTS idx_pdf_author ON pdf_info(author);
        CREATE INDEX IF NOT EXISTS idx_pdf_created ON pdf_info(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pdf_visited ON pdf_info(visited_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pdf_rating
            ON pdf_info(json_extract(json_data, '$.rating'));
        CREATE INDEX IF NOT EXISTS idx_pdf_visible
            ON pdf_info(json_extract(json_data, '$.is_visible'));
        """

        self._executor.execute_script(script)
        self._emit_event("create", "completed")

        if self._logger:
            self._logger.info("pdf_info table ensured")

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError("data is required")

        normalized: Dict[str, Any] = {}

        uuid = data.get("uuid")
        normalized["uuid"] = self._validate_uuid(uuid)

        normalized["title"] = self._validate_string(
            data.get("title"),
            "title",
            allow_empty=False
        )
        normalized["author"] = self._validate_string(
            data.get("author", ""),
            "author",
            allow_empty=True
        )

        normalized["page_count"] = self._validate_non_negative_int(
            data.get("page_count", 0),
            "page_count"
        )
        normalized["file_size"] = self._validate_non_negative_int(
            data.get("file_size", 0),
            "file_size"
        )
        normalized["created_at"] = self._validate_timestamp(
            data.get("created_at")
        )
        normalized["updated_at"] = self._validate_timestamp(
            data.get("updated_at")
        )
        normalized["visited_at"] = self._validate_non_negative_int(
            data.get("visited_at", 0),
            "visited_at"
        )

        version = data.get("version", 1)
        version_int = self._validate_non_negative_int(version, "version")
        if version_int < 1:
            raise DatabaseValidationError("version must be >= 1")
        normalized["version"] = version_int

        normalized["json_data"] = self._validate_json_data(
            data.get("json_data")
        )

        return normalized

    def _validate_uuid(self, value: Any) -> str:
        if not value:
            raise DatabaseValidationError("uuid is required")
        if not isinstance(value, str):
            raise DatabaseValidationError("uuid must be a string")
        if not self._UUID_PATTERN.fullmatch(value):
            raise DatabaseValidationError("uuid must be 12 hex characters")
        return value

    def _validate_string(
        self,
        value: Any,
        field: str,
        *,
        allow_empty: bool
    ) -> str:
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise DatabaseValidationError(f"{field} must be a string")
        if not allow_empty and not value.strip():
            raise DatabaseValidationError(f"{field} cannot be empty")
        return value

    def _validate_non_negative_int(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f"{field} must be a non-negative integer")
        if num < 0:
            raise DatabaseValidationError(f"{field} must be a non-negative integer")
        return num

    def _validate_timestamp(self, value: Any) -> int:
        if value is None:
            raise DatabaseValidationError("timestamp fields are required")
        return self._validate_non_negative_int(value, "timestamp")

    def _validate_rating(self, value: Any) -> int:
        rating = self._validate_non_negative_int(value, "rating")
        if rating > 5:
            raise DatabaseValidationError("rating must be between 0 and 5")
        return rating

    def _validate_tags(self, tags: Any) -> List[str]:
        if tags is None:
            return []
        if not isinstance(tags, list):
            raise DatabaseValidationError(
                "tags must be a list of non-empty strings"
            )
        result = []
        for item in tags:
            if not isinstance(item, str) or not item.strip():
                raise DatabaseValidationError(
                    "tags must be a list of non-empty strings"
                )
            result.append(item)
        return result

    def _validate_json_data(self, json_data: Any) -> Dict[str, Any]:
        if json_data is None:
            raise DatabaseValidationError("json_data is required")
        if isinstance(json_data, str):
            try:
                json_data = json.loads(json_data)
            except json.JSONDecodeError as exc:
                raise DatabaseValidationError(
                    "json_data must be valid JSON"
                ) from exc
        if not isinstance(json_data, dict):
            raise DatabaseValidationError("json_data must be a dict")

        validated: Dict[str, Any] = {}

        filename = json_data.get("filename")
        if not filename:
            raise DatabaseValidationError("filename is required")
        if not isinstance(filename, str):
            raise DatabaseValidationError("filename must be a string")
        if not self._FILENAME_PATTERN.fullmatch(filename):
            raise DatabaseValidationError(
                "filename must match pattern <12-hex>.pdf"
            )
        validated["filename"] = filename

        filepath = json_data.get("filepath")
        if not filepath:
            raise DatabaseValidationError("filepath is required")
        if not isinstance(filepath, str) or not filepath.strip():
            raise DatabaseValidationError("filepath must be a non-empty string")
        validated["filepath"] = filepath

        validated["subject"] = self._validate_string(
            json_data.get("subject", ""),
            "subject",
            allow_empty=True
        )
        validated["keywords"] = self._validate_string(
            json_data.get("keywords", ""),
            "keywords",
            allow_empty=True
        )

        thumbnail_path = json_data.get("thumbnail_path")
        if thumbnail_path is not None and not isinstance(thumbnail_path, str):
            raise DatabaseValidationError("thumbnail_path must be string or null")
        validated["thumbnail_path"] = thumbnail_path

        validated["tags"] = self._validate_tags(json_data.get("tags", []))
        validated["notes"] = self._validate_string(
            json_data.get("notes", ""),
            "notes",
            allow_empty=True
        )
        validated["last_accessed_at"] = self._validate_non_negative_int(
            json_data.get("last_accessed_at", 0),
            "last_accessed_at"
        )
        validated["review_count"] = self._validate_non_negative_int(
            json_data.get("review_count", 0),
            "review_count"
        )
        validated["rating"] = self._validate_rating(
            json_data.get("rating", 0)
        )

        is_visible = json_data.get("is_visible", True)
        if not isinstance(is_visible, bool):
            raise DatabaseValidationError("is_visible must be a boolean")
        validated["is_visible"] = is_visible

        validated["total_reading_time"] = self._validate_non_negative_int(
            json_data.get("total_reading_time", 0),
            "total_reading_time"
        )
        validated["due_date"] = self._validate_non_negative_int(
            json_data.get("due_date", 0),
            "due_date"
        )

        return validated

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)

        sql = """
        INSERT INTO pdf_info (
            uuid, title, author, page_count, file_size,
            created_at, updated_at, visited_at, version, json_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            validated["uuid"],
            validated["title"],
            validated["author"],
            validated["page_count"],
            validated["file_size"],
            validated["created_at"],
            validated["updated_at"],
            validated["visited_at"],
            validated["version"],
            json.dumps(validated["json_data"], ensure_ascii=False),
        )

        self._executor.execute_update(sql, params)
        self._emit_event("create", "completed", {"uuid": validated["uuid"]})
        if self._logger:
            self._logger.info(f"Inserted PDFInfo: {validated['uuid']}")
        return validated["uuid"]

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        merged: Dict[str, Any] = {
            "uuid": existing["uuid"],
            "title": existing.get("title", ""),
            "author": existing.get("author", ""),
            "page_count": existing.get("page_count", 0),
            "file_size": existing.get("file_size", 0),
            "created_at": existing.get("created_at"),
            "updated_at": int(time.time() * 1000),
            "visited_at": existing.get("visited_at", 0),
            "version": existing.get("version", 1),
            "json_data": existing.get("json_data", {}).copy(),
        }

        for field in [
            "title",
            "author",
            "page_count",
            "file_size",
            "visited_at",
            "created_at",
            "updated_at",
            "version",
        ]:
            if field in data and field != "uuid":
                merged[field] = data[field]

        if "json_data" in data and isinstance(data["json_data"], dict):
            merged["json_data"].update(data["json_data"])

        validated = self.validate_data(merged)

        sql = """
        UPDATE pdf_info
        SET
            title = ?,
            author = ?,
            page_count = ?,
            file_size = ?,
            created_at = ?,
            updated_at = ?,
            visited_at = ?,
            version = ?,
            json_data = ?
        WHERE uuid = ?
        """
        params = (
            validated["title"],
            validated["author"],
            validated["page_count"],
            validated["file_size"],
            validated["created_at"],
            validated["updated_at"],
            validated["visited_at"],
            validated["version"],
            json.dumps(validated["json_data"], ensure_ascii=False),
            primary_key,
        )

        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event("update", "completed", {"uuid": primary_key})
            if self._logger:
                self._logger.info(f"Updated PDFInfo: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = "DELETE FROM pdf_info WHERE uuid = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event("delete", "completed", {"uuid": primary_key})
            if self._logger:
                self._logger.info(f"Deleted PDFInfo: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_info WHERE uuid = ?"
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_info ORDER BY updated_at DESC"
        params: List[Any] = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        if offset is not None:
            sql += " OFFSET ?"
            params.append(int(offset))

        rows = self._executor.execute_query(sql, tuple(params) if params else None)
        return [self._parse_row(row) for row in rows]

    def _parse_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        try:
            json_data = json.loads(row.get("json_data", "{}"))
        except json.JSONDecodeError:
            json_data = {}

        parsed = {
            "uuid": row["uuid"],
            "title": row["title"],
            "author": row["author"],
            "page_count": row["page_count"],
            "file_size": row["file_size"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "visited_at": row["visited_at"],
            "version": row["version"],
            "json_data": json_data,
        }
        parsed.update(json_data)
        return parsed

    # ==================== 扩展方法 ====================

    def query_by_filename(self, filename: str) -> Optional[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.filename') = ?
        """
        rows = self._executor.execute_query(sql, (filename,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def search(
        self,
        keyword: str,
        fields: Optional[List[str]] = None,
        limit: Optional[int] = 50
    ) -> List[Dict[str, Any]]:
        if not keyword:
            return []
        if fields is None:
            fields = ["title", "author", "filename", "notes"]

        conditions: List[str] = []
        params: List[Any] = []
        like_value = f"%{keyword}%"

        if "title" in fields:
            conditions.append("title LIKE ?")
            params.append(like_value)
        if "author" in fields:
            conditions.append("author LIKE ?")
            params.append(like_value)
        if "filename" in fields:
            conditions.append("json_extract(json_data, '$.filename') LIKE ?")
            params.append(like_value)
        if "notes" in fields:
            conditions.append("json_extract(json_data, '$.notes') LIKE ?")
            params.append(like_value)

        if not conditions:
            return []

        sql = f"""
        SELECT * FROM pdf_info
        WHERE ({' OR '.join(conditions)})
        ORDER BY updated_at DESC
        LIMIT ?
        """
        params.append(limit if limit is not None else 50)

        rows = self._executor.execute_query(sql, tuple(params))
        return [self._parse_row(row) for row in rows]

    def filter_by_tags(
        self,
        tags: List[str],
        match_mode: str = "any"
    ) -> List[Dict[str, Any]]:
        if not tags:
            return []

        if match_mode == "all":
            results: List[Dict[str, Any]] = []
            for row in self.query_all():
                row_tags = row.get("tags", [])
                if all(tag in row_tags for tag in tags):
                    results.append(row)
            return results

        conditions = []
        params: List[Any] = []
        for tag in tags:
            conditions.append("json_data LIKE ?")
            params.append(f'%"{tag}"%')

        sql = f"""
        SELECT * FROM pdf_info
        WHERE ({' OR '.join(conditions)})
        ORDER BY updated_at DESC
        """
        rows = self._executor.execute_query(sql, tuple(params))
        return [self._parse_row(row) for row in rows]

    def filter_by_rating(self, min_rating: int = 0, max_rating: int = 5) -> List[Dict[str, Any]]:
        min_rating = max(0, min_rating)
        max_rating = min(5, max_rating)
        if min_rating > max_rating:
            min_rating, max_rating = max_rating, min_rating

        sql = """
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.rating') BETWEEN ? AND ?
        ORDER BY json_extract(json_data, '$.rating') DESC
        """
        rows = self._executor.execute_query(sql, (min_rating, max_rating))
        return [self._parse_row(row) for row in rows]

    def get_visible_pdfs(self) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.is_visible') = 1
            OR json_extract(json_data, '$.is_visible') = true
        ORDER BY updated_at DESC
        """
        rows = self._executor.execute_query(sql)
        return [self._parse_row(row) for row in rows]

    def update_reading_stats(self, uuid: str, reading_time_delta: int) -> bool:
        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        current_time = int(time.time() * 1000)
        total_reading_time = pdf.get("total_reading_time", 0) + reading_time_delta
        review_count = pdf.get("review_count", 0) + 1

        sql = """
        UPDATE pdf_info
        SET
            visited_at = ?,
            json_data = json_set(
                json_data,
                '$.last_accessed_at', ?,
                '$.total_reading_time', ?,
                '$.review_count', ?
            ),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        """
        params = (
            current_time,
            current_time,
            total_reading_time,
            review_count,
            current_time,
            uuid,
        )

        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event("update", "completed", {"uuid": uuid})
            if self._logger:
                self._logger.info(f"Updated reading stats for {uuid}")
        return rows > 0

    def add_tag(self, uuid: str, tag: str) -> bool:
        if not tag or not isinstance(tag, str):
            raise DatabaseValidationError("tag must be a non-empty string")

        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        tags = pdf.get("tags", [])
        if tag in tags:
            return False
        tags.append(tag)

        sql = """
        UPDATE pdf_info
        SET
            json_data = json_set(json_data, '$.tags', json(?)),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        """
        current_time = int(time.time() * 1000)
        params = (
            json.dumps(tags, ensure_ascii=False),
            current_time,
            uuid,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event("update", "completed", {"uuid": uuid})
            if self._logger:
                self._logger.info(f"Added tag '{tag}' to {uuid}")
        return rows > 0

    def remove_tag(self, uuid: str, tag: str) -> bool:
        pdf = self.query_by_id(uuid)
        if not pdf:
            return False

        tags = pdf.get("tags", [])
        if tag not in tags:
            return False
        tags = [item for item in tags if item != tag]

        sql = """
        UPDATE pdf_info
        SET
            json_data = json_set(json_data, '$.tags', json(?)),
            updated_at = ?,
            version = version + 1
        WHERE uuid = ?
        """
        current_time = int(time.time() * 1000)
        params = (
            json.dumps(tags, ensure_ascii=False),
            current_time,
            uuid,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event("update", "completed", {"uuid": uuid})
            if self._logger:
                self._logger.info(f"Removed tag '{tag}' from {uuid}")
        return rows > 0

    def _emit_event(
        self,
        action: str,
        status: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """使用连字符发布事件，兼容事件总线命名规则。"""
        event_table = self.table_name.replace('_', '-')
        event_name = f"table:{event_table}:{action}:{status}"
        try:
            self._event_bus.emit(event_name, data)
        except Exception as exc:
            if self._logger:
                self._logger.error(
                    f"Failed to emit event '{event_name}': {exc}"
                )
    def get_statistics(self) -> Dict[str, Any]:
        sql = """
        SELECT
            COUNT(*) as total_count,
            SUM(file_size) as total_size,
            AVG(page_count) as avg_pages,
            MAX(created_at) as latest_created,
            COUNT(CASE WHEN json_extract(json_data, '$.is_visible') = 1
                OR json_extract(json_data, '$.is_visible') = true THEN 1 END) as visible_count
        FROM pdf_info
        """
        result = self._executor.execute_query(sql)[0]
        return {
            "total_count": result["total_count"],
            "total_size": result["total_size"] or 0,
            "avg_pages": round(result["avg_pages"], 2) if result["avg_pages"] else 0,
            "latest_created": result["latest_created"] or 0,
            "visible_count": result["visible_count"],
        }






