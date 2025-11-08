"""PDF 大纲表插件（对齐前端 outline）

事件命名使用 table:pdf-outline:*；DB 表为 pdf_outline（无历史数据，直接采用新表）。
"""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from .pdf_outline.validate import validate_data as _validate_outline_data
from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFOutlineTablePlugin(TablePlugin):
    """管理（兼容）pdf_bookmark 表，但事件命名为 pdf-outline。"""

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._subscriber_id = f"pdf-outline-plugin-{id(self)}"
        self._events_registered = False

    # ==================== 基本属性 ====================

    @property
    def table_name(self) -> str:
        # 事件名使用 pdf-outline
        return 'pdf_outline'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self) -> List[str]:
        return ['pdf_info']

    # ==================== 生命周期 ====================

    def enable(self) -> None:
        if not self._enabled:
            super().enable()
            self.register_events()
            self._events_registered = True

    def disable(self) -> None:
        if self._enabled and self._events_registered:
            try:
                self._event_bus.off(
                    'table:pdf-info:delete:completed',
                    self._handle_pdf_deleted,
                    self._subscriber_id
                )
            except Exception:
                pass
            self._events_registered = False
        super().disable()

    # ==================== 建表 ====================

    def create_table(self) -> None:
        # 直接使用新表名 pdf_outline
        script = """
        CREATE TABLE IF NOT EXISTS pdf_outline (
            outline_id TEXT PRIMARY KEY NOT NULL,
            pdf_uuid TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data)),
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_outline_pdf_uuid ON pdf_outline(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_outline_created ON pdf_outline(created_at DESC);
        DROP INDEX IF EXISTS idx_outline_page;
        CREATE INDEX IF NOT EXISTS idx_outline_page_at
            ON pdf_outline(json_extract(json_data, '$.pageAt'));
        """
        self._executor.execute_script(script)
        self._emit_event('create', 'completed')
        if self._logger:
            self._logger.info('pdf_outline table ensured')

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return _validate_outline_data(data)

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)
        sql = """
        INSERT INTO pdf_outline (
            outline_id, pdf_uuid, created_at, updated_at, version, json_data
        ) VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (
            validated['outline_id'],
            validated['pdf_uuid'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
        )
        self._executor.execute_update(sql, params)
        self._emit_event('create', 'completed', {
            'outline_id': validated['outline_id'],
            'pdf_uuid': validated['pdf_uuid']
        })
        if self._logger:
            self._logger.info(f"Inserted outline item: {validated['outline_id']}")
        return validated['outline_id']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        merged = {
            'bookmark_id': existing['bookmark_id'],
            'pdf_uuid': existing['pdf_uuid'],
            'created_at': existing['created_at'],
            'updated_at': int(time.time() * 1000),
            'version': existing.get('version', 1) + 1,
            'json_data': {
                'name': existing['name'],
                'pageAt': existing.get('pageAt'),
                'position': existing.get('position'),
                'children': json.loads(json.dumps(existing.get('children', []))),
                'parentId': existing.get('parentId'),
                'order': existing.get('order', 0),
            }
        }
        # 合并可被覆盖的字段；合法性由 validate_data 统一检查
        for k in ('pdf_uuid', 'created_at', 'updated_at', 'version'):
            if k in data:
                merged[k] = data[k]

        json_fields = ['name', 'pageAt', 'position', 'children', 'parentId', 'order']
        for field in json_fields:
            if field in data:
                merged['json_data'][field] = data[field]

        if 'json_data' in data and isinstance(data['json_data'], dict):
            for key, value in data['json_data'].items():
                merged['json_data'][key] = value

        normalized = self.validate_data(merged)

        sql = """
        UPDATE pdf_outline
        SET pdf_uuid = ?, created_at = ?, updated_at = ?, version = ?, json_data = ?
        WHERE outline_id = ?
        """
        params = (
            normalized['pdf_uuid'],
            normalized['created_at'],
            normalized['updated_at'],
            normalized['version'],
            json.dumps(normalized['json_data'], ensure_ascii=False),
            primary_key,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event('update', 'completed', {'outline_id': primary_key})
            if self._logger:
                self._logger.info(f"Updated outline item: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = "DELETE FROM pdf_outline WHERE outline_id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'outline_id': primary_key})
            if self._logger:
                self._logger.info(f"Deleted outline item: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_outline WHERE outline_id = ?"
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_outline ORDER BY created_at DESC"
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
            json_data = json.loads(row.get('json_data', '{}'))
        except json.JSONDecodeError:
            json_data = {}
        return {
            'outline_id': row['outline_id'],
            'pdf_uuid': row['pdf_uuid'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'name': json_data.get('name'),
            'pageAt': json_data.get('pageAt'),
            'position': json_data.get('position'),
            'region': json_data.get('region'),
            'children': json_data.get('children', []),
            'parentId': json_data.get('parentId'),
            'order': json_data.get('order', 0),
        }

    # ==================== 订阅与事件 ====================

    def register_events(self) -> None:
        self._event_bus.on(
            'table:pdf-info:delete:completed',
            self._handle_pdf_deleted,
            self._subscriber_id
        )

    def _handle_pdf_deleted(self, data: Dict[str, Any]) -> None:
        pdf_uuid = data.get('uuid')
        if pdf_uuid:
            self.delete_by_pdf(pdf_uuid)

    def delete_by_pdf(self, pdf_uuid: str) -> int:
        sql = "DELETE FROM pdf_outline WHERE pdf_uuid = ?"
        rows = self._executor.execute_update(sql, (pdf_uuid,))
        if rows > 0:
            self._emit_event('delete', 'completed', {
                'pdf_uuid': pdf_uuid,
                'count': rows,
            })
            if self._logger:
                self._logger.info(f"Deleted {rows} outline items for PDF {pdf_uuid}")
        return rows

    # ==================== 辅助 ====================

    def _emit_event(
        self,
        action: str,
        status: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        # 强制使用 pdf-outline 事件名（不依赖 table_name → replace）
        event_name = f"table:pdf-outline:{action}:{status}"
        try:
            self._event_bus.emit(event_name, data)
        except Exception as exc:
            if self._logger:
                self._logger.error(f"Failed to emit event '{event_name}': {exc}")

