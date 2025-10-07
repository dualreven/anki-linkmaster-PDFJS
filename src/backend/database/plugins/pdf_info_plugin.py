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

    def search_records(
        self,
        keywords: List[str],
        search_fields: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        多关键词搜索（支持按空格分词的搜索）

        Args:
            keywords: 关键词列表（已按空格分词）
            search_fields: 要搜索的字段列表，默认 ['title', 'author', 'filename', 'tags', 'notes']
            limit: 结果数量限制
            offset: 结果偏移量

        Returns:
            匹配的记录列表

        Examples:
            >>> # 搜索 "Python 编程"
            >>> plugin.search_records(['Python', '编程'])
            >>> # 返回 title/author/filename/tags/notes 中同时包含 "Python" 和 "编程" 的记录
        """
        # 如果没有关键词，返回所有记录
        if not keywords:
            return self.query_all(limit=limit, offset=offset)

        # 过滤空关键词
        keywords = [kw for kw in keywords if kw and kw.strip()]
        if not keywords:
            return self.query_all(limit=limit, offset=offset)

        # 默认搜索字段（包含主题与关键词，满足 v001 需求）
        if search_fields is None:
            search_fields = ['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords']

        # 构建 WHERE 子句
        # 对每个关键词，在所有字段中搜索（OR），然后用 AND 连接
        keyword_conditions: List[str] = []
        params: List[Any] = []

        for keyword in keywords:
            # 转义 SQL LIKE 特殊字符（%, _）
            escaped_keyword = keyword.replace('%', '\\%').replace('_', '\\_')
            like_value = f"%{escaped_keyword}%"

            field_conditions: List[str] = []

            # 基础字段搜索
            if 'title' in search_fields:
                field_conditions.append("title LIKE ? ESCAPE '\\'")
                params.append(like_value)

            if 'author' in search_fields:
                field_conditions.append("author LIKE ? ESCAPE '\\'")
                params.append(like_value)

            # JSON 字段搜索
            if 'filename' in search_fields:
                field_conditions.append("json_extract(json_data, '$.filename') LIKE ? ESCAPE '\\'")
                params.append(like_value)

            if 'tags' in search_fields:
                # tags 是数组，使用 JSON 字符串匹配
                field_conditions.append("json_data LIKE ?")
                params.append(f'%"{escaped_keyword}"%')

            if 'notes' in search_fields:
                field_conditions.append("json_extract(json_data, '$.notes') LIKE ? ESCAPE '\\'")
                params.append(like_value)

            if 'subject' in search_fields:
                field_conditions.append("json_extract(json_data, '$.subject') LIKE ? ESCAPE '\\'")
                params.append(like_value)

            if 'keywords' in search_fields:
                field_conditions.append("json_extract(json_data, '$.keywords') LIKE ? ESCAPE '\\'")
                params.append(like_value)

            # 将该关键词的所有字段条件用 OR 连接
            if field_conditions:
                keyword_conditions.append(f"({' OR '.join(field_conditions)})")

        if not keyword_conditions:
            return []

        # 所有关键词条件用 AND 连接（每个关键词都要匹配）
        where_clause = ' AND '.join(keyword_conditions)

        sql = f"""
        SELECT * FROM pdf_info
        WHERE {where_clause}
        ORDER BY updated_at DESC
        """

        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))

        if offset is not None:
            sql += " OFFSET ?"
            params.append(int(offset))

        rows = self._executor.execute_query(sql, tuple(params))
        result = [self._parse_row(row) for row in rows]

        if self._logger:
            self._logger.info(
                f"Search completed: {len(keywords)} keywords, {len(result)} results"
            )

        return result

    def search_with_filters(
        self,
        keywords: List[str],
        filters: Optional[Dict[str, Any]] = None,
        search_fields: Optional[List[str]] = None,
        sort_rules: Optional[List[Dict[str, Any]]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        使用 SQLite 在数据库内部完成“先搜索后筛选”的记录检索。

        - 搜索：对每个关键词在多个字段进行 LIKE 匹配（字段内 OR，关键词间 AND）。
        - 筛选：将简单字段条件与复合逻辑（AND/OR/NOT）转换为 SQL 片段并与搜索条件 AND 组合。

        注意：为兼容 JSON 存储，部分字段通过 json_extract(...) 提取；
        当前版本不在 SQL 中应用排序（sort_rules 预留，仅为后续扩展），排序与分页仍在上层完成；
        后续如需在 SQL 端排序，将在本方法内根据白名单字段安全构建 ORDER BY，并在包含 match_score 的情况下回退到上层排序。
        """
        # 预处理关键词
        keywords = [kw for kw in (keywords or []) if kw and str(kw).strip()]

        # 默认搜索字段
        if search_fields is None:
            search_fields = ['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords']

        where_clauses: List[str] = []
        params: List[Any] = []

        # 1) 关键词条件（字段内 OR，关键词间 AND）
        if keywords:
            keyword_conditions: List[str] = []
            for kw in keywords:
                escaped = str(kw).replace('%', '\\%').replace('_', '\\_')
                like_value = f"%{escaped}%"
                parts: List[str] = []
                if 'title' in search_fields:
                    parts.append("title LIKE ? ESCAPE '\\'")
                    params.append(like_value)
                if 'author' in search_fields:
                    parts.append("author LIKE ? ESCAPE '\\'")
                    params.append(like_value)
                if 'filename' in search_fields:
                    parts.append("json_extract(json_data, '$.filename') LIKE ? ESCAPE '\\'")
                    params.append(like_value)
                if 'tags' in search_fields:
                    parts.append("json_data LIKE ?")
                    params.append(f'%"{escaped}"%')
                if 'notes' in search_fields:
                    parts.append("json_extract(json_data, '$.notes') LIKE ? ESCAPE '\\'")
                    params.append(like_value)
                if 'subject' in search_fields:
                    parts.append("json_extract(json_data, '$.subject') LIKE ? ESCAPE '\\'")
                    params.append(like_value)
                if 'keywords' in search_fields:
                    parts.append("json_extract(json_data, '$.keywords') LIKE ? ESCAPE '\\'")
                    params.append(like_value)

                if parts:
                    keyword_conditions.append(f"({' OR '.join(parts)})")

            if keyword_conditions:
                where_clauses.append(' AND '.join(keyword_conditions))

        # 2) 过滤条件（递归构建 SQL）
        def build_filter_sql(node: Dict[str, Any]) -> Tuple[str, List[Any]]:
            if not node or not isinstance(node, dict):
                return "1=1", []
            ntype = node.get('type')
            if ntype == 'composite':
                op = str(node.get('operator', 'AND')).upper()
                conds = node.get('conditions') or []
                parts: List[str] = []
                p: List[Any] = []
                for child in conds:
                    sql_part, sql_params = build_filter_sql(child)
                    parts.append(f"({sql_part})")
                    p.extend(sql_params)
                if not parts:
                    return "1=1", []
                if op == 'NOT':
                    # NOT 仅对第一个子条件取反
                    return f"NOT ({parts[0]})", p
                joiner = ' AND ' if op == 'AND' else ' OR '
                return joiner.join(parts), p
            if ntype == 'field':
                field = node.get('field')
                operator = node.get('operator')
                value = node.get('value')
                # 映射支持的字段/操作符
                if field == 'rating' and operator == 'gte':
                    return "CAST(json_extract(json_data, '$.rating') AS INTEGER) >= ?", [int(value)]
                if field == 'is_visible' and operator == 'eq':
                    if bool(value):
                        # 兼容 true/1
                        return "(json_extract(json_data, '$.is_visible') = 1 OR json_extract(json_data, '$.is_visible') = true)", []
                    else:
                        return "(json_extract(json_data, '$.is_visible') = 0 OR json_extract(json_data, '$.is_visible') = false OR json_extract(json_data, '$.is_visible') IS NULL)", []
                if field == 'tags':
                    # 精确匹配：使用 JSON1 的 json_each 遍历数组元素，避免 'abc' 命中 'abcd'
                    vals = value if isinstance(value, list) else [value]
                    vals = [str(v) for v in vals if str(v)]
                    if not vals and operator != 'eq':
                        return "1=1", []
                    json_each = "json_each(json_extract(json_data, '$.tags'))"

                    def sql_exists_in(vs):
                        placeholders = ','.join(['?'] * len(vs))
                        return (
                            f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value IN ({placeholders}))",
                            vs,
                        )

                    def sql_not_exists_in(vs):
                        placeholders = ','.join(['?'] * len(vs))
                        return (
                            f"NOT EXISTS (SELECT 1 FROM {json_each} je WHERE je.value IN ({placeholders}))",
                            vs,
                        )

                    # has_any / contains / has_tag → 至少包含其中一个
                    if operator in ('contains', 'has_tag', 'has_any'):
                        return sql_exists_in(vals)

                    # not_contains / not_has_tag / not_has_any → 不包含给定任意一个
                    if operator in ('not_contains', 'not_has_tag', 'not_has_any'):
                        return sql_not_exists_in(vals)

                    # has_all → 必须全部包含：AND 链接每个 EXISTS
                    if operator == 'has_all':
                        parts = []
                        p: List[Any] = []
                        for v in vals:
                            parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                            p.append(v)
                        return ' AND '.join(parts), p

                    # not_has_all → 不是“全部包含” ≡ NOT(has_all)
                    if operator == 'not_has_all':
                        parts = []
                        p: List[Any] = []
                        for v in vals:
                            parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                            p.append(v)
                        return f"NOT ( {' AND '.join(parts)} )", p

                    # eq（标签集合相等，忽略顺序与去重）
                    if operator == 'eq':
                        # 特殊：空集合相等
                        if not vals:
                            return "json_array_length(json_extract(json_data, '$.tags')) = 0", []
                        distinct_vals = list(dict.fromkeys(vals))
                        length_check = f"json_array_length(json_extract(json_data, '$.tags')) = {len(distinct_vals)}"
                        exists_parts = []
                        p: List[Any] = []
                        for v in distinct_vals:
                            exists_parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                            p.append(v)
                        return f"( {length_check} AND {' AND '.join(exists_parts)} )", p

                    # ne（集合不相等）
                    if operator == 'ne':
                        if not vals:
                            return "json_array_length(json_extract(json_data, '$.tags')) <> 0", []
                        distinct_vals = list(dict.fromkeys(vals))
                        length_check = f"json_array_length(json_extract(json_data, '$.tags')) = {len(distinct_vals)}"
                        exists_parts = []
                        p: List[Any] = []
                        for v in distinct_vals:
                            exists_parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                            p.append(v)
                        eq_sql = f"( {length_check} AND {' AND '.join(exists_parts)} )"
                        return f"NOT {eq_sql}", p
                if field == 'total_reading_time' and operator == 'gte':
                    return "CAST(json_extract(json_data, '$.total_reading_time') AS INTEGER) >= ?", [int(value)]
                # 默认透传为真，避免误杀
                return "1=1", []
            return "1=1", []

        if filters:
            f_sql, f_params = build_filter_sql(filters)
            if f_sql and f_sql.strip():
                where_clauses.append(f_sql)
                params.extend(f_params)

        # 3) 组合 SQL
        sql = "SELECT * FROM pdf_info"
        if where_clauses:
            sql += f" WHERE {' AND '.join(['(' + c + ')' for c in where_clauses])}"
        # 不在此处强加排序/分页（排序可能依赖 match_score），交由上层处理

        rows = self._executor.execute_query(sql, tuple(params) if params else None)
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






