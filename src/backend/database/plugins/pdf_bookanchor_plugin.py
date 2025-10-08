"""PDF 锚点表插件实现（pdf_bookanchor）

功能：管理“活动锚点/书签”的持久化，仅凭 uuid 可解析到 PDF 的页码与精确位置。

本表遵循项目现有风格：主键 + 外键 + 时间戳 + 版本 + json_data(JSON)。
SQL 字段：uuid, pdf_uuid, page_at, position, visited_at, created_at, updated_at, version, json_data
json_data 字段建议：name(必填), description, is_active, use_count, color, tags, selector 等。
其中 visited_at 放在 SQL 字段，不存放于 json_data。
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFBookanchorTablePlugin(TablePlugin):
    """管理 pdf_bookanchor 表的数据库插件。"""

    # 要求：锚点 uuid 必须以 'pdfanchor-' 开头，后接 12 位十六进制
    # 例如：pdfanchor-1a2b3c4d5e6f（总长度22）
    _ANCHOR_UUID_PATTERN = re.compile(r"^pdfanchor-[a-f0-9]{12}$")
    # PDF 记录 uuid（来自 pdf_info.uuid）仍为 12 位十六进制
    _PDF_UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return 'pdf_bookanchor'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        # 依赖 pdf_info（外键引用）
        return ['pdf_info']

    # ==================== 建表 ====================

    def create_table(self) -> None:
        script = """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS pdf_bookanchor (
            uuid TEXT PRIMARY KEY NOT NULL
                CHECK (length(uuid) = 22 AND substr(uuid,1,10) = 'pdfanchor-'),
            pdf_uuid TEXT NOT NULL,
            page_at INTEGER NOT NULL CHECK (page_at >= 1),
            position REAL NOT NULL DEFAULT 0 CHECK (position >= 0 AND position <= 1),
            visited_at INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data)),
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_bookanchor_pdf_uuid ON pdf_bookanchor(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_bookanchor_created ON pdf_bookanchor(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_bookanchor_pdf_page ON pdf_bookanchor(pdf_uuid, page_at);
        CREATE INDEX IF NOT EXISTS idx_bookanchor_visited ON pdf_bookanchor(visited_at DESC);

        -- 触发器：额外保护 uuid 前缀与长度（兼容旧库无法直接添加更复杂 CHECK 的场景）
        CREATE TRIGGER IF NOT EXISTS trg_pdf_bookanchor_uuid_ins
        BEFORE INSERT ON pdf_bookanchor
        FOR EACH ROW
        BEGIN
            SELECT CASE WHEN (substr(NEW.uuid,1,10) != 'pdfanchor-' OR length(NEW.uuid) != 22)
                THEN RAISE(ABORT, 'invalid uuid: must start with pdfanchor- and be 22 chars') END;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_pdf_bookanchor_uuid_upd
        BEFORE UPDATE OF uuid ON pdf_bookanchor
        FOR EACH ROW
        BEGIN
            SELECT CASE WHEN (substr(NEW.uuid,1,10) != 'pdfanchor-' OR length(NEW.uuid) != 22)
                THEN RAISE(ABORT, 'invalid uuid: must start with pdfanchor- and be 22 chars') END;
        END;
        """

        self._executor.execute_script(script)
        self._emit_event('create', 'completed')
        if self._logger:
            self._logger.info('pdf_bookanchor table ensured')

    # ==================== 数据校验 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError('data is required')

        normalized: Dict[str, Any] = {}

        # 主键与外键
        normalized['uuid'] = self._validate_uuid(data.get('uuid'))
        normalized['pdf_uuid'] = self._validate_uuid(data.get('pdf_uuid'), field='pdf_uuid')

        # 页码与位置
        normalized['page_at'] = self._validate_page_at(data.get('page_at'))
        normalized['position'] = self._validate_position(data.get('position'))

        # 版本与时间戳
        normalized['version'] = self._validate_version(data.get('version', 1))
        normalized['created_at'] = self._validate_timestamp(data.get('created_at'), 'created_at')
        normalized['updated_at'] = self._validate_timestamp(data.get('updated_at'), 'updated_at')
        normalized['visited_at'] = self._validate_non_negative_int(data.get('visited_at', 0), 'visited_at')

        # json_data（包含 name/description/is_active/use_count 等）
        json_data = data.get('json_data', {})
        if isinstance(json_data, str):
            try:
                json_data = json.loads(json_data)
            except json.JSONDecodeError as exc:
                raise DatabaseValidationError('json_data must be valid JSON') from exc
        if not isinstance(json_data, dict):
            raise DatabaseValidationError('json_data must be a dict')

        normalized['json_data'] = self._validate_json_data(json_data)
        return normalized

    def _validate_uuid(self, value: Any, field: str = 'uuid') -> str:
        if not value:
            raise DatabaseValidationError(f'{field} is required')
        if not isinstance(value, str):
            raise DatabaseValidationError(f'{field} must be a string')
        if field == 'pdf_uuid':
            # 引用 pdf_info.uuid（12位hex）
            if not self._PDF_UUID_PATTERN.fullmatch(value):
                raise DatabaseValidationError(
                    f"{field} must be 12 hex characters"
                )
        else:
            # 锚点自身 uuid
            if not self._ANCHOR_UUID_PATTERN.fullmatch(value):
                raise DatabaseValidationError(
                    f"{field} must start with 'pdfanchor-' and be followed by 12 hex characters"
                )
        return value

    def _validate_page_at(self, value: Any) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('page_at must be an integer')
        if num < 1:
            raise DatabaseValidationError('page_at must be >= 1')
        return num

    def _validate_position(self, value: Any) -> float:
        try:
            pos = float(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('position must be a number between 0 and 1')
        if pos < 0 or pos > 1:
            raise DatabaseValidationError('position must be between 0 and 1')
        return pos

    def _validate_version(self, value: Any) -> int:
        try:
            ver = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('version must be an integer')
        if ver < 1:
            raise DatabaseValidationError('version must be >= 1')
        return ver

    def _validate_timestamp(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be an integer')
        if num < 0:
            raise DatabaseValidationError(f'{field} must be >= 0')
        return num

    def _validate_non_negative_int(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be a non-negative integer')
        if num < 0:
            raise DatabaseValidationError(f'{field} must be a non-negative integer')
        return num

    def _validate_json_data(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        # name（必填，用于对外展示）
        name = json_data.get('name')
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError('name must be a non-empty string')

        # 可选：description
        description = json_data.get('description', '')
        if description is not None and not isinstance(description, str):
            raise DatabaseValidationError('description must be a string or null')

        # 可选：is_active（默认 true）
        is_active = json_data.get('is_active', True)
        if not isinstance(is_active, bool):
            raise DatabaseValidationError('is_active must be a boolean')

        # 可选：use_count（默认 0）
        use_count = json_data.get('use_count', 0)
        try:
            use_count = int(use_count)
        except (TypeError, ValueError):
            raise DatabaseValidationError('use_count must be a non-negative integer')
        if use_count < 0:
            raise DatabaseValidationError('use_count must be a non-negative integer')

        # 其他可扩展字段原样保留
        result = dict(json_data)
        result['name'] = name
        result['description'] = description
        result['is_active'] = is_active
        result['use_count'] = use_count

        # 强制：visited_at 不应放在 json 中（如出现则忽略，由 SQL 字段承载）
        if 'visited_at' in result:
            result.pop('visited_at', None)

        return result

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)
        sql = (
            "INSERT INTO pdf_bookanchor "
            "(uuid, pdf_uuid, page_at, position, visited_at, created_at, updated_at, version, json_data) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        params = (
            validated['uuid'],
            validated['pdf_uuid'],
            validated['page_at'],
            validated['position'],
            validated['visited_at'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
        )
        self._executor.execute_update(sql, params)
        self._emit_event('create', 'completed', {'uuid': validated['uuid']})
        if self._logger:
            self._logger.info(f"Inserted bookanchor: {validated['uuid']}")
        return validated['uuid']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        # 合并现有字段（以现有记录为基底）
        merged = {
            'uuid': existing['uuid'],
            'pdf_uuid': existing['pdf_uuid'],
            'page_at': existing['page_at'],
            'position': existing['position'],
            'visited_at': existing.get('visited_at', 0),
            'created_at': existing['created_at'],
            'updated_at': int(time.time() * 1000),
            'version': existing.get('version', 1) + 1,
            'json_data': json.loads(json.dumps(existing.get('json_data') or {})),
        }

        # 覆盖传入字段
        for k, v in data.items():
            if k == 'json_data' and isinstance(v, dict):
                merged['json_data'].update(v)
            else:
                merged[k] = v

        validated = self.validate_data(merged)

        sql = (
            "UPDATE pdf_bookanchor SET "
            "pdf_uuid=?, page_at=?, position=?, visited_at=?, created_at=?, updated_at=?, version=?, json_data=? "
            "WHERE uuid = ?"
        )
        params = (
            validated['pdf_uuid'],
            validated['page_at'],
            validated['position'],
            validated['visited_at'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
            primary_key,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': primary_key})
            if self._logger:
                self._logger.info(f"Updated bookanchor: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = "DELETE FROM pdf_bookanchor WHERE uuid = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'uuid': primary_key})
            if self._logger:
                self._logger.info(f"Deleted bookanchor: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_bookanchor WHERE uuid = ?"
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_bookanchor ORDER BY created_at DESC"
        params: List[Any] = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        if offset is not None:
            sql += " OFFSET ?"
            params.append(int(offset))
        rows = self._executor.execute_query(sql, tuple(params) if params else None)
        return [self._parse_row(row) for row in rows]

    # ==================== 扩展查询 ====================

    def query_by_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_bookanchor
        WHERE pdf_uuid = ?
        ORDER BY page_at ASC, position ASC
        """
        rows = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in rows]

    def query_by_pdf_page(self, pdf_uuid: str, page_at: int) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_bookanchor
        WHERE pdf_uuid = ? AND page_at = ?
        ORDER BY position ASC
        """
        rows = self._executor.execute_query(sql, (pdf_uuid, page_at))
        return [self._parse_row(row) for row in rows]

    # ==================== 解析行 ====================

    def _parse_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        try:
            json_data = json.loads(row.get('json_data', '{}'))
        except json.JSONDecodeError:
            json_data = {}

        result = {
            'uuid': row['uuid'],
            'pdf_uuid': row['pdf_uuid'],
            'page_at': row['page_at'],
            'position': row['position'],
            'visited_at': row.get('visited_at', 0),
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'json_data': json_data,
            # 便捷展开（常用展示字段）
            'name': json_data.get('name'),
            'description': json_data.get('description', ''),
            'is_active': json_data.get('is_active', True),
            'use_count': json_data.get('use_count', 0),
        }
        return result
