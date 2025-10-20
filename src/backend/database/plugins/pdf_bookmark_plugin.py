"""PDF 书签表插件实现"""

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


class PDFBookmarkTablePlugin(TablePlugin):
    """管理 pdf_bookmark 表的数据库插件。"""

    _UUID_PATTERN = re.compile(r"^[a-f0-9]{12}$")
    # 兼容两种前端ID格式：
    # - 旧：bookmark-<timestamp>-<random>
    # - 新：outlineItem-<8位Base64URL>（A-Za-z0-9_-）
    _BOOKMARK_ID_PATTERN = re.compile(r"^(bookmark-[0-9]+-[a-z0-9]+|outlineItem-[A-Za-z0-9_-]{8})$")

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._subscriber_id = f"pdf-bookmark-plugin-{id(self)}"
        self._events_registered = False

    # ==================== 基本属性 ====================

    @property
    def table_name(self) -> str:
        return 'pdf_bookmark'

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
            # 严格模式：禁用旧数据自动迁移，要求数据已为标准结构（pageAt/position），否则在上层流程中报错

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
        CREATE TABLE IF NOT EXISTS pdf_bookmark (
            bookmark_id TEXT PRIMARY KEY NOT NULL,
            pdf_uuid TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data)),
            FOREIGN KEY (pdf_uuid) REFERENCES pdf_info(uuid) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_bookmark_pdf_uuid ON pdf_bookmark(pdf_uuid);
        CREATE INDEX IF NOT EXISTS idx_bookmark_created ON pdf_bookmark(created_at DESC);
        -- 破坏性更新：切换到 pageAt 索引；删除旧索引（如果存在）
        DROP INDEX IF EXISTS idx_bookmark_page;
        CREATE INDEX IF NOT EXISTS idx_bookmark_page_at
            ON pdf_bookmark(json_extract(json_data, '$.pageAt'));
        """
        self._executor.execute_script(script)
        self._emit_event('create', 'completed')
        if self._logger:
            self._logger.info('pdf_bookmark table ensured')

    # ==================== 验证 ====================
    def _migrate_legacy_schema(self) -> None:
        """
        将旧数据(json_data 内包含 pageNumber/region/type)迁移为新结构(pageAt/position)，递归处理 children。
        仅在 json_data 缺少 pageAt 时执行。
        """
        sql = """
        SELECT bookmark_id, json_data
        FROM pdf_bookmark
        WHERE json_valid(json_data)
          AND (json_extract(json_data, '$.pageAt') IS NULL)
        """
        rows = self._executor.execute_query(sql, ())
        if not rows:
            if self._logger:
                self._logger.info("[pdf_bookmark] migration: no legacy rows detected")
            return

        def transform(node: Dict[str, Any]) -> Dict[str, Any]:
            name = node.get('name') or ''
            try:
                page_at = int(node.get('pageAt', node.get('pageNumber', 1)))
            except Exception:
                page_at = 1
            if page_at < 1:
                page_at = 1
            pos = node.get('position', None)
            if pos is None:
                region = node.get('region')
                if isinstance(region, dict):
                    try:
                        pos = int(round(float(region.get('scrollY', 0))))
                    except Exception:
                        pos = None
            if isinstance(pos, (int, float)):
                pos = int(round(pos))
                if pos < 0: pos = 0
                if pos > 100: pos = 100
            else:
                pos = None
            children = node.get('children', [])
            new_children = []
            if isinstance(children, list):
                for ch in children:
                    if isinstance(ch, dict):
                        new_children.append(transform(ch))
            return {
                'name': name,
                'pageAt': page_at,
                'position': pos,
                'children': new_children,
                'parentId': node.get('parentId'),
                'order': node.get('order', 0),
            }

        migrated = 0
        for row in rows:
            try:
                jd = json.loads(row.get('json_data', '{}'))
            except json.JSONDecodeError:
                continue
            new_json = transform(jd)
            ok = self.update(row['bookmark_id'], {'json_data': new_json})
            if ok:
                migrated += 1
        if self._logger:
            self._logger.info(f"[pdf_bookmark] migration completed: migrated_rows={migrated}")

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError('data is required')

        normalized: Dict[str, Any] = {}

        normalized['bookmark_id'] = self._validate_bookmark_id(data.get('bookmark_id'))
        normalized['pdf_uuid'] = self._validate_pdf_uuid(data.get('pdf_uuid'))
        normalized['created_at'] = self._validate_timestamp(data.get('created_at'), 'created_at')
        normalized['updated_at'] = self._validate_timestamp(data.get('updated_at'), 'updated_at')

        version = self._validate_positive_int(data.get('version', 1), 'version')
        if version < 1:
            raise DatabaseValidationError('version must be >= 1')
        normalized['version'] = version

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

    def _validate_bookmark_id(self, value: Any) -> str:
        if not value:
            raise DatabaseValidationError('bookmark_id is required')
        if not isinstance(value, str) or not value.strip():
            raise DatabaseValidationError('bookmark_id must be a non-empty string')
        if not self._BOOKMARK_ID_PATTERN.fullmatch(value):
            raise DatabaseValidationError("bookmark_id must match pattern 'bookmark-{timestamp}-{random}'")
        return value

    def _validate_pdf_uuid(self, value: Any) -> str:
        if not value:
            raise DatabaseValidationError('pdf_uuid is required')
        if not isinstance(value, str):
            raise DatabaseValidationError('pdf_uuid must be a string')
        if not self._UUID_PATTERN.fullmatch(value):
            raise DatabaseValidationError('pdf_uuid must be 12 hex characters')
        return value

    def _validate_timestamp(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be an integer')
        if num < 0:
            raise DatabaseValidationError(f'{field} must be >= 0')
        return num

    def _validate_positive_int(self, value: Any, field: str) -> int:
        try:
            num = int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be an integer')
        return num

    def _validate_json_data(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        name = json_data.get('name')
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError('name must be a non-empty string')

        # 破坏性更新：不再使用 type/region，统一 pageAt/position

        page_at = json_data.get('pageAt')
        try:
            page_at = int(page_at)
        except (TypeError, ValueError):
            raise DatabaseValidationError('pageAt must be an integer')
        if page_at < 1:
            raise DatabaseValidationError('pageAt must be >= 1')

        # 可选 position（0~100 的整数百分比）
        position_value = json_data.get('position', None)
        if position_value is not None:
            try:
                position_value = int(position_value)
            except (TypeError, ValueError):
                raise DatabaseValidationError('position must be an integer between 0 and 100')
            if position_value < 0 or position_value > 100:
                raise DatabaseValidationError('position must be in range 0~100')
        else:
            position_value = None

        parent_id = json_data.get('parentId')
        if parent_id is not None and (not isinstance(parent_id, str) or not parent_id.strip()):
            raise DatabaseValidationError('parentId must be string or null')

        order_value = json_data.get('order', 0)
        try:
            order_value = int(order_value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('order must be a non-negative integer')
        if order_value < 0:
            raise DatabaseValidationError('order must be a non-negative integer')

        children = json_data.get('children', [])
        validated_children = self._validate_children(children)

        return {
            'name': name,
            'pageAt': page_at,
            'position': position_value,
            'children': validated_children,
            'parentId': parent_id,
            'order': order_value,
        }

    def _validate_children(self, children: Any) -> List[Dict[str, Any]]:
        if children is None:
            return []
        if not isinstance(children, list):
            raise DatabaseValidationError('children must be a list')
        return [self._validate_bookmark_object(child) for child in children]

    def _validate_bookmark_object(self, bookmark: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(bookmark, dict):
            raise DatabaseValidationError('child bookmark must be an object')

        child_id = bookmark.get('bookmark_id')
        if child_id:
            self._validate_bookmark_id(child_id)
        else:
            child_id = ''

        name = bookmark.get('name')
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError('child bookmark name must be a non-empty string')

        # 破坏性更新：子节点也统一 pageAt/position
        page_at = bookmark.get('pageAt')
        try:
            page_at = int(page_at)
        except (TypeError, ValueError):
            raise DatabaseValidationError('child bookmark pageAt must be an integer')
        if page_at < 1:
            raise DatabaseValidationError('child bookmark pageAt must be >= 1')

        position_value = bookmark.get('position', None)
        if position_value is not None:
            try:
                position_value = int(position_value)
            except (TypeError, ValueError):
                raise DatabaseValidationError('child position must be an integer between 0 and 100')
            if position_value < 0 or position_value > 100:
                raise DatabaseValidationError('child position must be in range 0~100')
        else:
            position_value = None

        parent_id = bookmark.get('parentId')
        if parent_id is not None and (not isinstance(parent_id, str) or not parent_id.strip()):
            raise DatabaseValidationError('child parentId must be string or null')

        order_value = bookmark.get('order', 0)
        try:
            order_value = int(order_value)
        except (TypeError, ValueError):
            raise DatabaseValidationError('child order must be a non-negative integer')
        if order_value < 0:
            raise DatabaseValidationError('child order must be a non-negative integer')

        children = bookmark.get('children', [])
        validated_children = self._validate_children(children)

        return {
            'bookmark_id': child_id,
            'name': name,
            'pageAt': page_at,
            'position': position_value,
            'children': validated_children,
            'parentId': parent_id,
            'order': order_value,
        }

    def _validate_number(self, value: Any, field: str) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be a number')

    def _validate_strict_positive(self, value: Any, field: str) -> float:
        number = self._validate_number(value, field)
        if number <= 0:
            raise DatabaseValidationError(f'{field} must be greater than 0')
        return number

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)
        sql = """
        INSERT INTO pdf_bookmark (
            bookmark_id, pdf_uuid, created_at, updated_at, version, json_data
        ) VALUES (?, ?, ?, ?, ?, ?)
        """
        params = (
            validated['bookmark_id'],
            validated['pdf_uuid'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
        )
        self._executor.execute_update(sql, params)
        self._emit_event('create', 'completed', {
            'bookmark_id': validated['bookmark_id'],
            'pdf_uuid': validated['pdf_uuid']
        })
        if self._logger:
            self._logger.info(f"Inserted bookmark: {validated['bookmark_id']}")
        return validated['bookmark_id']

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

        if 'pdf_uuid' in data:
            merged['pdf_uuid'] = self._validate_pdf_uuid(data['pdf_uuid'])
        if 'created_at' in data:
            merged['created_at'] = self._validate_timestamp(data['created_at'], 'created_at')
        if 'updated_at' in data:
            merged['updated_at'] = self._validate_timestamp(data['updated_at'], 'updated_at')
        if 'version' in data:
            version = self._validate_positive_int(data['version'], 'version')
            if version < 1:
                raise DatabaseValidationError('version must be >= 1')
            merged['version'] = version

        json_fields = ['name', 'pageAt', 'position', 'children', 'parentId', 'order']
        for field in json_fields:
            if field in data:
                merged['json_data'][field] = data[field]

        if 'json_data' in data and isinstance(data['json_data'], dict):
            for key, value in data['json_data'].items():
                merged['json_data'][key] = value

        normalized = self.validate_data(merged)

        sql = """
        UPDATE pdf_bookmark
        SET pdf_uuid = ?, created_at = ?, updated_at = ?, version = ?, json_data = ?
        WHERE bookmark_id = ?
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
            self._emit_event('update', 'completed', {'bookmark_id': primary_key})
            if self._logger:
                self._logger.info(f"Updated bookmark: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = "DELETE FROM pdf_bookmark WHERE bookmark_id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'bookmark_id': primary_key})
            if self._logger:
                self._logger.info(f"Deleted bookmark: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_bookmark WHERE bookmark_id = ?"
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_bookmark ORDER BY created_at DESC"
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
        result = {
            'bookmark_id': row['bookmark_id'],
            'pdf_uuid': row['pdf_uuid'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'name': json_data.get('name'),
            'pageAt': json_data.get('pageAt'),
            'position': json_data.get('position'),
            'children': json_data.get('children', []),
            'parentId': json_data.get('parentId'),
            'order': json_data.get('order', 0),
        }
        return result

    # ==================== 扩展查询 ====================

    def query_by_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
        ORDER BY json_extract(json_data, '$.order')
        """
        rows = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in rows]

    def query_root_bookmarks(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
          AND (json_extract(json_data, '$.parentId') IS NULL
               OR json_extract(json_data, '$.parentId') = 'null')
        ORDER BY json_extract(json_data, '$.order')
        """
        rows = self._executor.execute_query(sql, (pdf_uuid,))
        return [self._parse_row(row) for row in rows]

    def query_by_page(self, pdf_uuid: str, page_number: int) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_bookmark
        WHERE pdf_uuid = ?
          AND json_extract(json_data, '$.pageAt') = ?
        """
        rows = self._executor.execute_query(sql, (pdf_uuid, page_number))
        return [self._parse_row(row) for row in rows]

    def count_by_pdf(self, pdf_uuid: str) -> int:
        sql = "SELECT COUNT(*) as count FROM pdf_bookmark WHERE pdf_uuid = ?"
        result = self._executor.execute_query(sql, (pdf_uuid,))[0]
        return result['count']

    def delete_by_pdf(self, pdf_uuid: str) -> int:
        sql = "DELETE FROM pdf_bookmark WHERE pdf_uuid = ?"
        rows = self._executor.execute_update(sql, (pdf_uuid,))
        if rows > 0:
            self._emit_event('delete', 'completed', {
                'pdf_uuid': pdf_uuid,
                'count': rows,
            })
            if self._logger:
                self._logger.info(f"Deleted {rows} bookmarks for PDF {pdf_uuid}")
        return rows

    def add_child_bookmark(self, parent_id: str, child_bookmark: Dict[str, Any]) -> Optional[str]:
        parent = self.query_by_id(parent_id)
        if not parent:
            return None
        validated_child = self._validate_bookmark_object(child_bookmark)
        children = parent.get('children', [])
        validated_child['parentId'] = parent_id
        validated_child['order'] = len(children)
        children.append(validated_child)
        success = self.update(parent_id, {'children': children})
        if success:
            return validated_child.get('bookmark_id') or f"child-{len(children) - 1}"
        return None

    def remove_child_bookmark(self, parent_id: str, child_index: int) -> bool:
        parent = self.query_by_id(parent_id)
        if not parent:
            return False
        children = list(parent.get('children', []))
        if child_index < 0 or child_index >= len(children):
            return False
        del children[child_index]
        for idx, child in enumerate(children):
            child['order'] = idx
        return self.update(parent_id, {'children': children})

    def reorder_bookmarks(self, pdf_uuid: str, ordered_ids: List[str]) -> bool:
        for order, bookmark_id in enumerate(ordered_ids):
            bookmark = self.query_by_id(bookmark_id)
            if bookmark and bookmark['pdf_uuid'] == pdf_uuid:
                self.update(bookmark_id, {'order': order})
        return True

    def flatten_bookmarks(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        records = self.query_by_pdf(pdf_uuid)
        if not records:
            return []

        record_map = {record['bookmark_id']: record for record in records}
        tree_children: Dict[str, List[Dict[str, Any]]] = {record_id: [] for record_id in record_map}

        for record in records:
            parent_id = record.get('parentId')
            if parent_id and parent_id in tree_children:
                tree_children[parent_id].append(record)

        for children in tree_children.values():
            children.sort(key=lambda item: item.get('order', 0))

        roots = [record for record in records if not record.get('parentId')]
        roots.sort(key=lambda item: item.get('order', 0))

        def flatten(node: Dict[str, Any], level: int = 0) -> List[Dict[str, Any]]:
            result = [{**node, 'level': level}]
            for child in tree_children.get(node['bookmark_id'], []):
                result.extend(flatten(child, level + 1))
            return result

        flat: List[Dict[str, Any]] = []
        for root in roots:
            flat.extend(flatten(root, 0))
        return flat

    # ==================== 事件 ====================

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

    # ==================== 辅助方法 ====================

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
                self._logger.error(f"Failed to emit event '{event_name}': {exc}")
