'''SearchCondition 表插件实现'''

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class SearchConditionTablePlugin(TablePlugin):
    '''管理 search_condition 表的数据库插件。'''

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._subscriber_id = f'search-condition-plugin-{id(self)}'

    @property
    def table_name(self) -> str:
        return 'search_condition'

    @property
    def version(self) -> str:
        return '1.0.0'

    def create_table(self) -> None:
        script = """
        CREATE TABLE IF NOT EXISTS search_condition (
            uuid TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0,
            version INTEGER NOT NULL DEFAULT 1,
            json_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(json_data))
        );

        CREATE INDEX IF NOT EXISTS idx_search_name ON search_condition(name);
        CREATE INDEX IF NOT EXISTS idx_search_created ON search_condition(created_at DESC);
        """
        self._executor.execute_script(script)
        self._emit_event('create', 'completed')
        if self._logger:
            self._logger.info('search_condition table ensured')

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError('data is required')

        normalized: Dict[str, Any] = {}
        normalized['uuid'] = self._validate_string(data.get('uuid'), 'uuid')
        normalized['name'] = self._validate_string(data.get('name'), 'name')
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

    def _validate_json_data(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        description = payload.get('description')
        if description is not None and not isinstance(description, str):
            raise DatabaseValidationError('description must be a string')

        condition = payload.get('condition')
        if condition is None:
            raise DatabaseValidationError('condition is required')
        validated_condition = self._validate_condition(condition)

        use_count = self._validate_non_negative_int(payload.get('use_count', 0), 'use_count')
        last_used_at = self._validate_non_negative_int(payload.get('last_used_at', 0), 'last_used_at')

        enabled = payload.get('enabled', False)
        if not isinstance(enabled, bool):
            raise DatabaseValidationError('enabled must be a boolean')

        tags = payload.get('tags', [])
        if tags is None:
            tags = []
        if not isinstance(tags, list) or any(not isinstance(tag, str) for tag in tags):
            raise DatabaseValidationError('tags must be a list of strings')

        sort_config = payload.get('sort_config')
        validated_sort = self._validate_sort_config(sort_config) if sort_config is not None else None

        result = {
            'description': description,
            'condition': validated_condition,
            'use_count': use_count,
            'last_used_at': last_used_at,
            'enabled': enabled,
            'tags': tags,
        }
        if validated_sort is not None:
            result['sort_config'] = validated_sort
        return result

    def _validate_condition(self, condition: Any) -> Dict[str, Any]:
        if not isinstance(condition, dict):
            raise DatabaseValidationError('condition must be an object')
        condition_type = condition.get('type')
        if condition_type == 'fuzzy':
            return self._validate_fuzzy_condition(condition)
        if condition_type == 'field':
            return self._validate_field_condition(condition)
        if condition_type == 'composite':
            return self._validate_composite_condition(condition)
        raise DatabaseValidationError('condition.type must be one of fuzzy/field/composite')

    def _validate_fuzzy_condition(self, condition: Dict[str, Any]) -> Dict[str, Any]:
        keywords = condition.get('keywords')
        if not isinstance(keywords, list) or not keywords:
            raise DatabaseValidationError('fuzzy condition requires keywords list')
        if any(not isinstance(keyword, str) or not keyword.strip() for keyword in keywords):
            raise DatabaseValidationError('fuzzy keywords must be non-empty strings')
        search_fields = condition.get('searchFields', ['filename', 'tags', 'notes'])
        if not isinstance(search_fields, list) or any(not isinstance(field, str) for field in search_fields):
            raise DatabaseValidationError('searchFields must be a list of strings')
        match_mode = condition.get('matchMode', 'any')
        if match_mode not in {'any', 'all'}:
            raise DatabaseValidationError('matchMode must be any or all')
        return {
            'type': 'fuzzy',
            'keywords': keywords,
            'searchFields': search_fields,
            'matchMode': match_mode,
        }

    def _validate_field_condition(self, condition: Dict[str, Any]) -> Dict[str, Any]:
        field = condition.get('field')
        if not isinstance(field, str) or not field.strip():
            raise DatabaseValidationError('field condition requires field')
        operator = condition.get('operator')
        allowed = {
            'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
            'contains', 'not_contains', 'starts_with', 'ends_with',
            'in_range', 'has_tag', 'not_has_tag',
            # 扩展：标签集合相关
            'has_all', 'not_has_all', 'has_any', 'not_has_any'
        }
        if operator not in allowed:
            raise DatabaseValidationError('field condition operator invalid')
        if 'value' not in condition:
            raise DatabaseValidationError('field condition requires value')
        return {
            'type': 'field',
            'field': field,
            'operator': operator,
            'value': condition.get('value'),
        }

    def _validate_composite_condition(self, condition: Dict[str, Any]) -> Dict[str, Any]:
        operator = condition.get('operator')
        if operator not in {'AND', 'OR', 'NOT'}:
            raise DatabaseValidationError('composite operator must be AND/OR/NOT')
        conditions = condition.get('conditions')
        if not isinstance(conditions, list) or not conditions:
            raise DatabaseValidationError('composite conditions must be a non-empty list')
        validated_children = [self._validate_condition(child) for child in conditions]
        return {
            'type': 'composite',
            'operator': operator,
            'conditions': validated_children,
        }

    def _validate_sort_config(self, sort_config: Any) -> Dict[str, Any]:
        if not isinstance(sort_config, dict):
            raise DatabaseValidationError('sort_config must be an object')
        mode = self._validate_non_negative_int(sort_config.get('mode', 0), 'sort_config.mode')
        result: Dict[str, Any] = {'mode': mode}
        if mode == 1:
            manual = sort_config.get('manual_order')
            if not isinstance(manual, list) or not manual:
                raise DatabaseValidationError('manual_order must be a non-empty list when mode=1')
            if any(not isinstance(item, str) for item in manual):
                raise DatabaseValidationError('manual_order items must be strings')
            result['manual_order'] = manual
        elif mode == 2:
            multi = sort_config.get('multi_sort')
            if not isinstance(multi, list) or not multi:
                raise DatabaseValidationError('multi_sort must be a non-empty list when mode=2')
            for entry in multi:
                if not isinstance(entry, dict) or 'field' not in entry or 'direction' not in entry:
                    raise DatabaseValidationError('multi_sort entries must contain field and direction')
                if entry['direction'] not in {'asc', 'desc'}:
                    raise DatabaseValidationError('multi_sort direction must be asc/desc')
            result['multi_sort'] = multi
        elif mode == 3:
            weighted = sort_config.get('weighted_sort')
            if not isinstance(weighted, dict) or not weighted:
                raise DatabaseValidationError('weighted_sort must contain weights when mode=3')
            formula = weighted.get('formula')
            if not isinstance(formula, str) or not formula.strip():
                raise DatabaseValidationError('weighted_sort must contain weights when mode=3')
            result['weighted_sort'] = {'formula': formula}
        return result

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)
        sql = '''
        INSERT INTO search_condition (
            uuid, name, created_at, updated_at, version, json_data
        ) VALUES (?, ?, ?, ?, ?, ?)
        '''
        params = (
            validated['uuid'],
            validated['name'],
            validated['created_at'],
            validated['updated_at'],
            validated['version'],
            json.dumps(validated['json_data'], ensure_ascii=False),
        )
        self._executor.execute_update(sql, params)
        self._emit_event('create', 'completed', {'uuid': validated['uuid']})
        if self._logger:
            self._logger.info(f"Inserted search condition: {validated['uuid']}")
        return validated['uuid']

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        existing = self.query_by_id(primary_key)
        if not existing:
            return False

        merged = {
            'uuid': existing['uuid'],
            'name': existing['name'],
            'created_at': existing['created_at'],
            'updated_at': int(time.time() * 1000),
            'version': existing.get('version', 1) + 1,
            'json_data': json.loads(json.dumps(existing['json_data'])),
        }

        if 'name' in data:
            merged['name'] = self._validate_string(data['name'], 'name')
        if 'created_at' in data:
            merged['created_at'] = self._validate_timestamp(data['created_at'], 'created_at')
        if 'version' in data:
            new_version = self._validate_positive_int(data['version'], 'version')
            if new_version < 1:
                raise DatabaseValidationError('version must be >= 1')
            merged['version'] = new_version
        if 'json_data' in data and isinstance(data['json_data'], dict):
            merged['json_data'].update(data['json_data'])
        for key in ('use_count', 'last_used_at', 'enabled', 'tags', 'condition', 'sort_config', 'description'):
            if key in data:
                merged['json_data'][key] = data[key]

        normalized = self.validate_data(merged)
        sql = '''
        UPDATE search_condition
        SET name = ?, created_at = ?, updated_at = ?, version = ?, json_data = ?
        WHERE uuid = ?
        '''
        params = (
            normalized['name'],
            normalized['created_at'],
            normalized['updated_at'],
            normalized['version'],
            json.dumps(normalized['json_data'], ensure_ascii=False),
            primary_key,
        )
        rows = self._executor.execute_update(sql, params)
        if rows > 0:
            self._emit_event('update', 'completed', {'uuid': primary_key})
            if self._logger:
                self._logger.info(f"Updated search condition: {primary_key}")
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        sql = 'DELETE FROM search_condition WHERE uuid = ?'
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'uuid': primary_key})
            if self._logger:
                self._logger.info(f"Deleted search condition: {primary_key}")
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        sql = 'SELECT * FROM search_condition WHERE uuid = ?'
        rows = self._executor.execute_query(sql, (primary_key,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        sql = 'SELECT * FROM search_condition ORDER BY created_at DESC'
        params: List[Any] = []
        if limit is not None:
            sql += ' LIMIT ?'
            params.append(int(limit))
        if offset is not None:
            sql += ' OFFSET ?'
            params.append(int(offset))
        rows = self._executor.execute_query(sql, tuple(params) if params else None)
        return [self._parse_row(row) for row in rows]

    def query_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        sql = 'SELECT * FROM search_condition WHERE name = ?'
        rows = self._executor.execute_query(sql, (name,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def query_enabled(self) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM search_condition
        WHERE json_extract(json_data, '$.enabled') = 1
            OR json_extract(json_data, '$.enabled') = true
        """
        rows = self._executor.execute_query(sql)
        return [self._parse_row(row) for row in rows]

    def increment_use_count(self, uuid: str) -> None:
        sql = """
        UPDATE search_condition
        SET json_data = json_set(json_data, '$.use_count', coalesce(json_extract(json_data, '$.use_count'), 0) + 1)
        WHERE uuid = ?
        """
        self._executor.execute_update(sql, (uuid,))

    def set_last_used(self, uuid: str) -> None:
        timestamp = int(time.time() * 1000)
        sql = """
        UPDATE search_condition
        SET json_data = json_set(json_data, '$.last_used_at', ?)
        WHERE uuid = ?
        """
        self._executor.execute_update(sql, (timestamp, uuid))

    def activate_exclusive(self, uuid: str) -> None:
        sql_disable = "UPDATE search_condition SET json_data = json_set(json_data, '$.enabled', 0)"
        self._executor.execute_update(sql_disable)
        sql_enable = """
        UPDATE search_condition
        SET json_data = json_set(json_data, '$.enabled', 1)
        WHERE uuid = ?
        """
        self._executor.execute_update(sql_enable, (uuid,))

    def query_by_tag(self, tag: str) -> List[Dict[str, Any]]:
        pattern = f'%"{tag}"%'
        sql = 'SELECT * FROM search_condition WHERE json_data LIKE ?'
        rows = self._executor.execute_query(sql, (pattern,))
        return [self._parse_row(row) for row in rows]

    def search_by_keyword(self, keyword: str) -> List[Dict[str, Any]]:
        like = f'%{keyword}%'
        sql = """
        SELECT * FROM search_condition
        WHERE name LIKE ?
           OR json_extract(json_data, '$.description') LIKE ?
        """
        rows = self._executor.execute_query(sql, (like, like))
        return [self._parse_row(row) for row in rows]

    def _parse_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        try:
            json_data = json.loads(row.get('json_data', '{}'))
        except json.JSONDecodeError:
            json_data = {}
        return {
            'uuid': row['uuid'],
            'name': row['name'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'version': row['version'],
            'json_data': json_data,
        }

    def register_events(self) -> None:
        pass

    def _emit_event(self, action: str, status: str, data: Optional[Dict[str, Any]] = None) -> None:
        event_name = f"table:search-condition:{action}:{status}"
        try:
            self._event_bus.emit(event_name, data)
        except Exception as exc:
            if self._logger:
                self._logger.error(f"Failed to emit event '{event_name}': {exc}")

    def _validate_string(self, value: Any, field: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise DatabaseValidationError(f'{field} must be a non-empty string')
        return value

    def _validate_timestamp(self, value: Any, field: str) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be an integer')

    def _validate_positive_int(self, value: Any, field: str) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            raise DatabaseValidationError(f'{field} must be an integer')

    def _validate_non_negative_int(self, value: Any, field: str) -> int:
        num = self._validate_positive_int(value, field)
        if num < 0:
            raise DatabaseValidationError(f'{field} must be >= 0')
        return num
