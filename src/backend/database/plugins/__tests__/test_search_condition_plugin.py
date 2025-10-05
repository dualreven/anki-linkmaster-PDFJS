"""SearchConditionTablePlugin 行为测试"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import DatabaseConstraintError, DatabaseValidationError
from ...plugin.event_bus import EventBus
from ..search_condition_plugin import SearchConditionTablePlugin  # 待实现
from .fixtures.search_condition_samples import (
    make_search_condition_sample,
    make_sequence,
)


@pytest.fixture
def connection_manager(tmp_path):
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'search_condition_test.db'
    manager = DatabaseConnectionManager(str(db_path))
    yield manager
    manager.close_all()
    DatabaseConnectionManager._instance = None


@pytest.fixture
def connection(connection_manager):
    return connection_manager.get_connection()


@pytest.fixture
def executor(connection):
    return SQLExecutor(connection)


@pytest.fixture
def event_bus():
    return EventBus()


@pytest.fixture
def plugin(executor, event_bus):
    plugin = SearchConditionTablePlugin(executor, event_bus, logging.getLogger('test.search'))
    plugin.enable()
    return plugin


# ==================== 建表 ====================


def test_create_table_idempotent(executor, event_bus):
    plugin = SearchConditionTablePlugin(executor, event_bus)
    plugin.enable()
    plugin.enable()
    rows = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'search_condition'
        """
    )
    assert rows and rows[0]['name'] == 'search_condition'


def test_indexes_created(executor, event_bus):
    plugin = SearchConditionTablePlugin(executor, event_bus)
    plugin.enable()
    indexes = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'search_condition'
        """
    )
    names = {row['name'] for row in indexes}
    assert {'idx_search_name', 'idx_search_created'}.issubset(names)


# ==================== 数据验证 ====================


def test_validate_fuzzy_condition(plugin):
    sample = make_search_condition_sample('fuzzy')
    validated = plugin.validate_data(sample)
    assert validated['json_data']['condition']['type'] == 'fuzzy'


def test_validate_field_condition(plugin):
    sample = make_search_condition_sample('field')
    validated = plugin.validate_data(sample)
    assert validated['json_data']['condition']['field'] == 'author'


def test_validate_composite_condition(plugin):
    sample = make_search_condition_sample('composite')
    validated = plugin.validate_data(sample)
    assert validated['json_data']['condition']['operator'] == 'AND'


def test_validate_missing_name(plugin):
    sample = make_search_condition_sample('fuzzy')
    sample['name'] = ''
    with pytest.raises(DatabaseValidationError, match='name must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_invalid_uuid(plugin):
    sample = make_search_condition_sample('fuzzy')
    sample['uuid'] = ''
    with pytest.raises(DatabaseValidationError, match='uuid must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_missing_condition(plugin):
    sample = make_search_condition_sample('fuzzy')
    del sample['json_data']['condition']
    with pytest.raises(DatabaseValidationError, match='condition is required'):
        plugin.validate_data(sample)


def test_validate_invalid_condition_type(plugin):
    sample = make_search_condition_sample('fuzzy')
    sample['json_data']['condition']['type'] = 'invalid'
    with pytest.raises(DatabaseValidationError, match='condition.type must be one of'):
        plugin.validate_data(sample)


def test_validate_field_condition_missing_value(plugin):
    sample = make_search_condition_sample('field')
    del sample['json_data']['condition']['value']
    with pytest.raises(DatabaseValidationError, match='field condition requires value'):
        plugin.validate_data(sample)


def test_validate_composite_conditions(plugin):
    sample = make_search_condition_sample('composite')
    sample['json_data']['condition']['conditions'] = []
    with pytest.raises(DatabaseValidationError, match='composite conditions must be a non-empty list'):
        plugin.validate_data(sample)


def test_validate_sort_config_multi(plugin):
    sample = make_search_condition_sample('field')
    sample['json_data']['sort_config'] = {
        'mode': 2,
        'multi_sort': []
    }
    with pytest.raises(DatabaseValidationError, match='multi_sort must be a non-empty list when mode=2'):
        plugin.validate_data(sample)


def test_validate_sort_config_weighted(plugin):
    sample = make_search_condition_sample('field')
    sample['json_data']['sort_config'] = {
        'mode': 3,
        'weighted_sort': {'field': 'rating'}
    }
    with pytest.raises(DatabaseValidationError, match='weighted_sort must contain weights'):
        plugin.validate_data(sample)


# ==================== CRUD ====================


def test_insert_search_condition(plugin):
    sample = make_search_condition_sample('fuzzy')
    uuid = plugin.insert(sample)
    row = plugin.query_by_id(uuid)
    assert row['name'] == sample['name']


def test_insert_duplicate_name(plugin):
    sample = make_search_condition_sample('fuzzy')
    plugin.insert(sample)
    another = make_search_condition_sample('field', name=sample['name'], uuid='sc-1728123999999-dup')
    with pytest.raises(DatabaseConstraintError):
        plugin.insert(another)


def test_update_search_condition(plugin):
    sample = make_search_condition_sample('field')
    uuid = plugin.insert(sample)
    plugin.update(uuid, {
        'name': '新的条件',
        'json_data': {
            'use_count': 5,
            'condition': {
                'type': 'field',
                'field': 'rating',
                'operator': 'gte',
                'value': 4
            }
        }
    })
    row = plugin.query_by_id(uuid)
    assert row['name'] == '新的条件'
    assert row['json_data']['use_count'] == 5


def test_delete_search_condition(plugin):
    sample = make_search_condition_sample('fuzzy')
    uuid = plugin.insert(sample)
    assert plugin.delete(uuid) is True
    assert plugin.query_by_id(uuid) is None


def test_query_all(plugin):
    for item in make_sequence(3):
        plugin.insert(item)
    rows = plugin.query_all()
    assert len(rows) == 3


def test_query_all_pagination(plugin):
    for item in make_sequence(5):
        plugin.insert(item)
    first = plugin.query_all(limit=2)
    second = plugin.query_all(limit=2, offset=2)
    assert len(first) == 2
    assert len(second) == 2
    assert {row['uuid'] for row in first}.isdisjoint({row['uuid'] for row in second})


# ==================== 扩展方法 ====================


def test_query_by_name(plugin):
    sample = make_search_condition_sample('fuzzy', name='常用搜索')
    plugin.insert(sample)
    found = plugin.query_by_name('常用搜索')
    assert found and found['name'] == '常用搜索'


def test_query_enabled(plugin):
    sample = make_search_condition_sample('fuzzy', uuid='sc-1728123473000-enabled', json_data={'enabled': True})
    plugin.insert(sample)
    rows = plugin.query_enabled()
    assert any(row['uuid'] == sample['uuid'] for row in rows)


def test_increment_use_count(plugin):
    sample = make_search_condition_sample('field', uuid='sc-1728123473001-count', json_data={'use_count': 0})
    uuid = plugin.insert(sample)
    plugin.increment_use_count(uuid)
    row = plugin.query_by_id(uuid)
    assert row['json_data']['use_count'] == 1


def test_set_last_used(plugin):
    sample = make_search_condition_sample('fuzzy', uuid='sc-1728123473002-last', json_data={'last_used_at': 0})
    uuid = plugin.insert(sample)
    plugin.set_last_used(uuid)
    row = plugin.query_by_id(uuid)
    assert row['json_data']['last_used_at'] > 0


def test_activate_exclusive(plugin):
    first = make_search_condition_sample('fuzzy', uuid='sc-1728123474000-a', json_data={'enabled': False})
    second = make_search_condition_sample('field', uuid='sc-1728123474001-b', json_data={'enabled': True})
    plugin.insert(first)
    plugin.insert(second)
    plugin.activate_exclusive(first['uuid'])
    rows = plugin.query_all()
    enabled = [row['uuid'] for row in rows if row['json_data'].get('enabled')]
    assert enabled == [first['uuid']]


def test_query_by_tag(plugin):
    sample = make_search_condition_sample('fuzzy', uuid='sc-1728123475000-tag', json_data={'tags': ['复习', 'ml']})
    plugin.insert(sample)
    rows = plugin.query_by_tag('ml')
    assert any(row['uuid'] == sample['uuid'] for row in rows)


def test_search_by_keyword(plugin):
    sample = make_search_condition_sample('fuzzy', name='深度学习搜索', json_data={'condition': {'type': 'fuzzy', 'keywords': ['深度学习']}})
    plugin.insert(sample)
    rows = plugin.search_by_keyword('深度')
    assert any(row['uuid'] == sample['uuid'] for row in rows)


# ==================== 事件 ====================


def test_event_emission_on_insert(plugin, event_bus):
    received: List[Dict[str, Any]] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:search-condition:create:completed', listener, 'test-listener')
    plugin.insert(make_search_condition_sample('fuzzy', uuid='sc-1728123476000-insert'))
    assert received and received[0]['uuid'] == 'sc-1728123476000-insert'


def test_event_emission_on_update(plugin, event_bus):
    uuid = plugin.insert(make_search_condition_sample('field', uuid='sc-1728123476001-update'))
    received: List[Dict[str, Any]] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:search-condition:update:completed', listener, 'test-listener')
    plugin.update(uuid, {'name': '更新名称'})
    assert received and received[0]['uuid'] == uuid


def test_event_emission_on_delete(plugin, event_bus):
    uuid = plugin.insert(make_search_condition_sample('fuzzy', uuid='sc-1728123476002-delete'))
    received: List[Dict[str, Any]] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:search-condition:delete:completed', listener, 'test-listener')
    plugin.delete(uuid)
    assert received and received[0]['uuid'] == uuid
