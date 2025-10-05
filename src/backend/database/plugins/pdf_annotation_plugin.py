"""PDF 标注表插件实现"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFAnnotationTablePlugin(TablePlugin):
    """管理 pdf_annotation 表的插件实现。"""

    _UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
    _ANN_ID_PATTERN = re.compile(r'^ann_[0-9]{6,}_[0-9a-zA-Z]{6}$')
    _MD5_PATTERN = re.compile(r"^[a-f0-9]{32}$")
    _HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
    _ALLOWED_TYPES = {"screenshot", "text-highlight", "comment"}

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
        if data is None:
            raise DatabaseValidationError("data is required")

        normalized: Dict[str, Any] = {}

        ann_id = data.get('ann_id')
        normalized['ann_id'] = self._validate_ann_id(ann_id)

        pdf_uuid = data.get('pdf_uuid')
        normalized['pdf_uuid'] = self._validate_pdf_uuid(pdf_uuid)

        page_number = data.get('page_number')
        normalized['page_number'] = self._validate_positive_int(page_number, 'page_number')

        ann_type = data.get('type')
        if ann_type not in self._ALLOWED_TYPES:
            raise DatabaseValidationError(
                f"type must be one of {sorted(self._ALLOWED_TYPES)}"
            )
        normalized['type'] = ann_type

        normalized['created_at'] = self._validate_timestamp(data.get('created_at'), 'created_at')
        normalized['updated_at'] = self._validate_timestamp(data.get('updated_at'), 'updated_at')

        version = data.get('version', 1)
        version_int = self._validate_positive_int(version, 'version')
        if version_int < 1:
            raise DatabaseValidationError('version must be >= 1')
        normalized['version'] = version_int

        json_data = data.get('json_data', {})
        if isinstance(json_data, str):
            try:
                json_data = json.loads(json_data)
            except json.JSONDecodeError as exc:
                raise DatabaseValidationError('json_data must be valid JSON') from exc
        if not isinstance(json_data, dict):
            raise DatabaseValidationError('json_data must be a dict')

        payload = json_data.get('data')
        if not isinstance(payload, dict):
            raise DatabaseValidationError('json_data.data must be an object')

        comments = json_data.get('comments', [])
        validated_comments = self._validate_comments(comments)

        if ann_type == 'screenshot':
            validated_payload = self._validate_screenshot_payload(payload)
        elif ann_type == 'text-highlight':
            validated_payload = self._validate_text_highlight_payload(payload)
        else:
            validated_payload = self._validate_comment_payload(payload)

        normalized['json_data'] = {
            'data': validated_payload,
            'comments': validated_comments
        }

        return normalized

    def _validate_ann_id(self, value: Any) -> str:
        if not value:
            raise DatabaseValidationError('ann_id is required')
        if not isinstance(value, str):
            raise DatabaseValidationError('ann_id must be a string')
        if not self._ANN_ID_PATTERN.fullmatch(value):
            raise DatabaseValidationError('ann_id must match pattern ann_<timestamp>_<random>')
        return value

    def _validate_pdf_uuid(self, value: Any) -> str:
        if not value:
            raise DatabaseValidationError('pdf_uuid is required')
        if not isinstance(value, str):
            raise DatabaseValidationError('pdf_uuid must be a string')
        if not self._UUID_PATTERN.fullmatch(value):
            raise DatabaseValidationError('pdf_uuid must be 12 hex characters')
        return value

    def _validate_positive_int(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be a positive integer')
        if num <= 0:
            raise DatabaseValidationError(f'{field} must be greater than 0')
        return num

    def _validate_timestamp(self, value: Any, field: str) -> int:
        if value is None:
            raise DatabaseValidationError(f'{field} is required')
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be a non-negative integer')
        if num < 0:
            raise DatabaseValidationError(f'{field} must be a non-negative integer')
        return num

    def _validate_non_negative_number(self, value: Any, field: str) -> float:
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be a non-negative number')
        if num < 0:
            raise DatabaseValidationError(f'{field} must be a non-negative number')
        return num

    def _validate_positive_number(self, value: Any, field: str) -> float:
        num = self._validate_non_negative_number(value, field)
        if num <= 0:
            raise DatabaseValidationError(f'{field} must be greater than 0')
        return num

    def _validate_screenshot_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        rect = payload.get('rect')
        if not isinstance(rect, dict):
            raise DatabaseValidationError('rect is required')
        validated_rect = {
            'x': self._validate_non_negative_number(rect.get('x'), 'rect.x'),
            'y': self._validate_non_negative_number(rect.get('y'), 'rect.y'),
            'width': self._validate_positive_number(rect.get('width'), 'rect.width'),
            'height': self._validate_positive_number(rect.get('height'), 'rect.height'),
        }

        image_path = payload.get('imagePath')
        if not isinstance(image_path, str) or not image_path.strip():
            raise DatabaseValidationError('imagePath must be a non-empty string')

        image_hash = payload.get('imageHash')
        if not isinstance(image_hash, str) or not self._MD5_PATTERN.fullmatch(image_hash):
            raise DatabaseValidationError('imageHash must be 32 hex characters')

        image_data = payload.get('imageData')
        if image_data is not None:
            if not isinstance(image_data, str) or not image_data.startswith('data:image/'):
                raise DatabaseValidationError('imageData must be base64 data URI')

        description = payload.get('description')
        if description is not None and not isinstance(description, str):
            raise DatabaseValidationError('description must be a string')

        result = {
            'rect': validated_rect,
            'imagePath': image_path,
            'imageHash': image_hash,
        }
        if image_data is not None:
            result['imageData'] = image_data
        if description is not None:
            result['description'] = description
        return result

    def _validate_text_highlight_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        selected = payload.get('selectedText')
        if not isinstance(selected, str) or not selected.strip():
            raise DatabaseValidationError('selectedText must be a non-empty string')

        ranges = payload.get('textRanges')
        if not isinstance(ranges, list) or not ranges:
            raise DatabaseValidationError('textRanges must be a non-empty array')
        for idx, item in enumerate(ranges):
            if not isinstance(item, dict):
                raise DatabaseValidationError(f'textRanges[{idx}] must be an object')

        color = payload.get('highlightColor')
        if not isinstance(color, str) or not self._HEX_COLOR_PATTERN.fullmatch(color):
            raise DatabaseValidationError('highlightColor must be a HEX color (#rrggbb)')

        note = payload.get('note')
        if note is not None and not isinstance(note, str):
            raise DatabaseValidationError('note must be a string')

        result = {
            'selectedText': selected,
            'textRanges': ranges,
            'highlightColor': color,
        }
        if note is not None:
            result['note'] = note
        return result

    def _validate_comment_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        position = payload.get('position')
        if not isinstance(position, dict):
            raise DatabaseValidationError('position is required')
        validated_position = {
            'x': self._validate_non_negative_number(position.get('x'), 'position.x'),
            'y': self._validate_non_negative_number(position.get('y'), 'position.y'),
        }

        content = payload.get('content')
        if not isinstance(content, str) or not content.strip():
            raise DatabaseValidationError('content must be a non-empty string')

        result = {
            'position': validated_position,
            'content': content,
        }
        return result

    def _validate_comments(self, comments: Any) -> List[Dict[str, Any]]:
        if comments is None:
            return []
        if not isinstance(comments, list):
            raise DatabaseValidationError('comments must be an array')

        normalized: List[Dict[str, Any]] = []
        for item in comments:
            if not isinstance(item, dict):
                raise DatabaseValidationError('each comment must be an object')
            if not all(key in item for key in ('id', 'content', 'createdAt')):
                raise DatabaseValidationError('each comment must contain id/content/createdAt')
            if not isinstance(item['id'], str) or not item['id'].strip():
                raise DatabaseValidationError('comment.id must be a non-empty string')
            if not isinstance(item['content'], str) or not item['content'].strip():
                raise DatabaseValidationError('comment.content must be a non-empty string')
            if not isinstance(item['createdAt'], str) or not item['createdAt'].strip():
                raise DatabaseValidationError('comment.createdAt must be a non-empty string')
            normalized.append({
                'id': item['id'],
                'content': item['content'],
                'createdAt': item['createdAt'],
            })
        return normalized

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

        if 'pdf_uuid' in data:
            merged['pdf_uuid'] = self._validate_pdf_uuid(data['pdf_uuid'])
        if 'page_number' in data:
            merged['page_number'] = self._validate_positive_int(data['page_number'], 'page_number')
        if 'type' in data:
            ann_type = data['type']
            if ann_type not in self._ALLOWED_TYPES:
                raise DatabaseValidationError(
                    f"type must be one of {sorted(self._ALLOWED_TYPES)}"
                )
            merged['type'] = ann_type

        if 'created_at' in data:
            merged['created_at'] = self._validate_timestamp(data['created_at'], 'created_at')
        if 'version' in data:
            version = self._validate_positive_int(data['version'], 'version')
            if version < 1:
                raise DatabaseValidationError('version must be >= 1')
            merged['version'] = version

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


