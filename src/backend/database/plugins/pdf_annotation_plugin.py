"""PDF 标注表插件实现"""

from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus
from .pdf_annotation.validate import validate_data as _validate_annotation_data

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFAnnotationTablePlugin(TablePlugin):
    """管理 pdf_annotation 表的插件实现。"""

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._events_registered = False
        self._subscriber_id = f"pdf-annotation-plugin-{id(self)}"

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return "pdf_annotation"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def dependencies(self) -> List[str]:
        return ["pdf_info"]

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
        script = """
        CREATE TABLE IF NOT EXISTS pdf_annotation (
            ann_id TEXT PRIMARY KEY NOT NULL,
            pdf_uuid TEXT NOT NULL,
            page_number INTEGER NOT NULL CHECK (page_number > 0),
            type TEXT NOT NULL CHECK (type IN ('screenshot', 'text-highlight', 'comment')),
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data)),
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_ann_pdf_uuid ON pdf_annotation(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_ann_page ON pdf_annotation(page_number);
        CREATE INDEX IF NOT EXISTS idx_ann_type ON pdf_annotation(type);
        CREATE INDEX IF NOT EXISTS idx_ann_created ON pdf_annotation(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ann_pdf_page
            ON pdf_annotation(pdf_uuid, page_number);
        """
        self._executor.execute_script(script)
        self._emit_event('create', 'completed')
        if self._logger:
            self._logger.info('pdf_annotation table ensured')

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # 委托纯函数校验模块，保持行为一致
        return _validate_annotation_data(data)

    # （验证相关的私有方法已拆分至 pdf_annotation/validate.py）

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)

        sql = """
        INSERT INTO pdf_annotation (
            ann_id, pdf_uuid, page_number, type,
            created_at, updated_at, version, json_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            validated['ann_id'],
            validated['pdf_uuid'],
            validated['page_number'],
            validated['type'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
        )

        self._executor.execute_update(sql, params)
        self._emit_event('create', 'completed', {
            'ann_id': validated['ann_id'],
            'pdf_uuid': validated['pdf_uuid']
        })
        if self._logger:
            self._logger.info(f"Inserted annotation: {validated['ann_id']}")
        return validated['ann_id']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        merged = {
            'ann_id': existing['ann_id'],
            'pdf_uuid': existing['pdf_uuid'],
            'page_number': existing['page_number'],
            'type': existing['type'],
            'created_at': existing['created_at'],
            'updated_at': int(time.time() * 1000),
            'version': existing.get('version', 1) + 1,
            'json_data': {
                'data': json.loads(json.dumps(existing['data'])),
                'comments': json.loads(json.dumps(existing.get('comments', [])))
            }
        }

        # 合并允许的字段；具体合法性统一交给 validate_data 校验
        for key in ('pdf_uuid', 'page_number', 'type', 'created_at', 'version'):
            if key in data:
                merged[key] = data[key]

        if 'json_data' in data:
            payload = data['json_data']
            if not isinstance(payload, dict):
                raise DatabaseValidationError('json_data must be a dict')
            if 'data' in payload:
                merged['json_data']['data'].update(payload['data'])
            if 'comments' in payload:
                merged['json_data']['comments'] = payload['comments']

        if 'comments' in data:
            merged['json_data']['comments'] = data['comments']
        if 'data' in data:
            if not isinstance(data['data'], dict):
                raise DatabaseValidationError('data must be a dict')
            merged['json_data']['data'].update(data['data'])

        normalized = self.validate_data(merged)

        sql = """
        UPDATE pdf_annotation
        SET
            pdf_uuid = ?,
            page_number = ?,
            type = ?,
            created_at = ?,
            updated_at = ?,
            version = ?,
            json_data = ?
        WHERE ann_id = ?
        """
        params = (
            normalized['pdf_uuid'],
            normalized['page_number'],
            normalized['type'],
            normalized['created_at'],
            normalized['updated_at'],
            normalized['version'],
            json.dumps(normalized['json_data'], ensure_ascii=False),
            primary_key,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event('update', 'completed', {'ann_id': primary_key})
            if self._logger:
                self._logger.info(f"Updated annotation: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = "DELETE FROM pdf_annotation WHERE ann_id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'ann_id': primary_key})
            if self._logger:
                self._logger.info(f"Deleted annotation: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_annotation WHERE ann_id = ?"
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_annotation ORDER BY created_at DESC"
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
            'ann_id': row['ann_id'],
            'pdf_uuid': row['pdf_uuid'],
            'page_number': row['page_number'],
            'type': row['type'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'data': json_data.get('data', {}),
            'comments': json_data.get('comments', []),
        }

    # ==================== 扩展方法 ====================

    def query_by_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ?
        ORDER BY page_number, created_at
        """
        rows = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in rows]

    def query_by_page(self, pdf_uuid: str, page_number: int) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ? AND page_number = ?
        ORDER BY created_at
        """
        rows = self._executor.execute_query(sql, (pdf_uuid, page_number))
        return [self._parse_row(row) for row in rows]

    def query_by_type(self, pdf_uuid: str, ann_type: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation
        WHERE pdf_uuid = ? AND type = ?
        ORDER BY page_number, created_at
        """
        rows = self._executor.execute_query(sql, (pdf_uuid, ann_type))
        return [self._parse_row(row) for row in rows]

    def count_by_pdf(self, pdf_uuid: str) -> int:
        sql = "SELECT COUNT(*) as count FROM pdf_annotation WHERE pdf_uuid = ?"
        result = self._executor.execute_query(sql, (pdf_uuid,))[0]
        return result['count']

    def count_by_type(self, pdf_uuid: str, ann_type: str) -> int:
        sql = """
        SELECT COUNT(*) as count FROM pdf_annotation
        WHERE pdf_uuid = ? AND type = ?
        """
        result = self._executor.execute_query(sql, (pdf_uuid, ann_type))[0]
        return result['count']

    def delete_by_pdf(self, pdf_uuid: str) -> int:
        sql = "DELETE FROM pdf_annotation WHERE pdf_uuid = ?"
        rows = self._executor.execute_update(sql, (pdf_uuid,))
        if rows > 0:
            self._emit_event('delete', 'completed', {
                'pdf_uuid': pdf_uuid,
                'count': rows,
            })
            if self._logger:
                self._logger.info(f"Deleted {rows} annotations for PDF {pdf_uuid}")
        return rows

    def add_comment(self, ann_id: str, comment_content: str) -> Optional[Dict[str, Any]]:
        annotation = self.query_by_id(ann_id)
        if not annotation:
            return None
        comment_id = self._generate_comment_id()
        new_comment = {
            'id': comment_id,
            'content': comment_content,
            'createdAt': datetime.utcnow().isoformat() + 'Z',
        }
        comments = list(annotation.get('comments', []))
        comments.append(new_comment)
        success = self.update(ann_id, {'comments': comments})
        if success:
            if self._logger:
                self._logger.info(f"Added comment to annotation {ann_id}")
            return new_comment
        return None

    def remove_comment(self, ann_id: str, comment_id: str) -> bool:
        annotation = self.query_by_id(ann_id)
        if not annotation:
            return False
        comments = annotation.get('comments', [])
        filtered = [comment for comment in comments if comment.get('id') != comment_id]
        if len(filtered) == len(comments):
            return False
        success = self.update(ann_id, {'comments': filtered})
        if success and self._logger:
            self._logger.info(f"Removed comment {comment_id} from annotation {ann_id}")
        return success

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

    # ==================== 工具方法 ====================

    def _emit_event(
        self,
        action: str,
        status: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        table_segment = self.table_name.replace('_', '-')
        event_name = f"table:{table_segment}:{action}:{status}"
        try:
            self._event_bus.emit(event_name, data)
        except Exception as exc:
            if self._logger:
                self._logger.error(
                    f"Failed to emit event '{event_name}': {exc}"
                )

    def _generate_comment_id(self) -> str:
        timestamp = int(time.time() * 1000)
        random_part = str(timestamp)[-6:]
        return f"comment_{timestamp}_{random_part}"


