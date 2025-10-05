"""PDFBookmarkTablePlugin 行为测试"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import DatabaseConstraintError, DatabaseValidationError
from ..pdf_info_plugin import PDFInfoTablePlugin
from ...plugins.pdf_info_plugin import PDFInfoTablePlugin as _PDFInfoTablePlugin  # noqa
from ...plugin.event_bus import EventBus
from ..pdf_bookmark_plugin import PDFBookmarkTablePlugin  # 待实现
from .fixtures.pdf_info_samples import make_pdf_info_sample
from .fixtures.pdf_bookmark_samples import (
    make_bookmark_sample,
    make_tree_samples,
    make_sequence,
)


@pytest.fixture
def connection_manager(tmp_path):
    """提供隔离的 DatabaseConnectionManager。"""
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'bookmark_test.db'
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
def pdf_info_plugin(executor, event_bus):
    plugin = PDFInfoTablePlugin(executor, event_bus, logging.getLogger('test.pdf_info'))
    plugin.enable()
    return plugin


@pytest.fixture
def plugin(executor, event_bus, pdf_info_plugin):
    plugin = PDFBookmarkTablePlugin(executor, event_bus, logging.getLogger('test.bookmark'))
    plugin.enable()
    return plugin


@pytest.fixture
def pdf_uuid(pdf_info_plugin):
    sample = make_pdf_info_sample()
    pdf_info_plugin.insert(sample)
    return sample['uuid']


def _make_sample(kind: str, pdf_uuid: str, **overrides: Dict) -> Dict[str, Any]:
    sample = make_bookmark_sample(kind=kind, **overrides)
    sample['pdf_uuid'] = pdf_uuid
    return sample


# ==================== 建表与基础校验 ====================


def test_create_table_idempotent(executor, event_bus, pdf_info_plugin):
    bookmark_plugin = PDFBookmarkTablePlugin(executor, event_bus)
    bookmark_plugin.enable()
    bookmark_plugin.enable()
    rows = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'pdf_bookmark'
        """
    )
    assert rows and rows[0]['name'] == 'pdf_bookmark'


def test_indexes_created(executor, event_bus, pdf_info_plugin):
    bookmark_plugin = PDFBookmarkTablePlugin(executor, event_bus)
    bookmark_plugin.enable()
    indexes = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'pdf_bookmark'
        """
    )
    index_names = {row['name'] for row in indexes}
    expected = {
        'idx_bookmark_pdf_uuid',
        'idx_bookmark_created',
        'idx_bookmark_page',
    }
    assert expected.issubset(index_names)


# ==================== 数据验证 ====================


def test_validate_page_bookmark(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    validated = plugin.validate_data(sample)
    assert validated['json_data']['type'] == 'page'


def test_validate_region_bookmark(plugin, pdf_uuid):
    sample = _make_sample('region', pdf_uuid)
    validated = plugin.validate_data(sample)
    assert validated['json_data']['region']['zoom'] > 0


def test_validate_missing_name(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['name'] = ''
    with pytest.raises(DatabaseValidationError, match='name must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_invalid_type(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['type'] = 'invalid'
    with pytest.raises(DatabaseValidationError, match='type must be'):
        plugin.validate_data(sample)


def test_validate_invalid_page_number(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['pageNumber'] = 0
    with pytest.raises(DatabaseValidationError, match='pageNumber must be >= 1'):
        plugin.validate_data(sample)


def test_validate_region_missing_region(plugin, pdf_uuid):
    sample = _make_sample('region', pdf_uuid)
    sample['json_data']['region'] = None
    with pytest.raises(DatabaseValidationError, match='region is required when type=region'):
        plugin.validate_data(sample)


def test_validate_region_invalid_zoom(plugin, pdf_uuid):
    sample = _make_sample('region', pdf_uuid)
    sample['json_data']['region']['zoom'] = 0
    with pytest.raises(DatabaseValidationError, match='zoom must be greater than 0'):
        plugin.validate_data(sample)


def test_validate_children_array(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['children'] = 'invalid'
    with pytest.raises(DatabaseValidationError, match='children must be a list'):
        plugin.validate_data(sample)


def test_validate_recursive_children(plugin, pdf_uuid):
    tree = make_tree_samples()
    tree['parent']['pdf_uuid'] = pdf_uuid
    validated = plugin.validate_data(tree['parent'])
    assert validated['json_data']['children'][0]['order'] == 0


def test_validate_invalid_bookmark_id_format(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['bookmark_id'] = 'invalid'
    with pytest.raises(DatabaseValidationError, match='bookmark_id must match pattern'):
        plugin.validate_data(sample)


def test_validate_parent_id(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['parentId'] = 123
    with pytest.raises(DatabaseValidationError, match='parentId must be string or null'):
        plugin.validate_data(sample)


def test_validate_order(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    sample['json_data']['order'] = -1
    with pytest.raises(DatabaseValidationError, match='order must be a non-negative integer'):
        plugin.validate_data(sample)


def test_foreign_key_constraint(plugin):
    sample = make_bookmark_sample()
    with pytest.raises(DatabaseConstraintError):
        plugin.insert(sample)


# ==================== CRUD ====================


def test_insert_page_bookmark(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    row = plugin.query_by_id(bookmark_id)
    assert row['name'] == sample['json_data']['name']


def test_insert_region_bookmark(plugin, pdf_uuid):
    sample = _make_sample('region', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    row = plugin.query_by_id(bookmark_id)
    assert row['type'] == 'region'

def test_insert_bookmark_with_children(plugin, pdf_uuid):
    tree = make_tree_samples()
    parent = tree['parent']
    parent['pdf_uuid'] = pdf_uuid
    plugin.insert(parent)
    stored = plugin.query_by_id(parent['bookmark_id'])
    assert len(stored['children']) == 2


def test_insert_duplicate_id(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    plugin.insert(sample)
    with pytest.raises(DatabaseConstraintError):
        plugin.insert(sample)


def test_update_bookmark(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    updated = plugin.update(bookmark_id, {'name': '新的书签', 'order': 2})
    assert updated is True
    row = plugin.query_by_id(bookmark_id)
    assert row['name'] == '新的书签'
    assert row['order'] == 2


def test_delete_bookmark(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    assert plugin.delete(bookmark_id) is True
    assert plugin.query_by_id(bookmark_id) is None


def test_query_by_id(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    row = plugin.query_by_id(bookmark_id)
    assert row['bookmark_id'] == bookmark_id


def test_query_all(plugin, pdf_uuid):
    for item in make_sequence(3):
        item['pdf_uuid'] = pdf_uuid
        plugin.insert(item)
    rows = plugin.query_all()
    assert len(rows) == 3


def test_query_all_pagination(plugin, pdf_uuid):
    for item in make_sequence(5):
        item['pdf_uuid'] = pdf_uuid
        plugin.insert(item)
    first = plugin.query_all(limit=3)
    second = plugin.query_all(limit=2, offset=3)
    assert len(first) == 3
    assert len(second) == 2
    assert {row['bookmark_id'] for row in first}.isdisjoint({row['bookmark_id'] for row in second})


def test_parse_row(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid)
    bookmark_id = plugin.insert(sample)
    row = plugin.query_by_id(bookmark_id)
    assert 'children' in row


# ==================== 扩展方法 ====================


def test_query_by_pdf(plugin, pdf_uuid):
    for item in make_sequence(3):
        item['pdf_uuid'] = pdf_uuid
        plugin.insert(item)
    rows = plugin.query_by_pdf(pdf_uuid)
    assert len(rows) == 3


def test_query_root_bookmarks(plugin, pdf_uuid):
    tree = make_tree_samples()
    for sample in tree.values():
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    roots = plugin.query_root_bookmarks(pdf_uuid)
    assert any(b['bookmark_id'] == tree['parent']['bookmark_id'] for b in roots)


def test_query_by_page(plugin, pdf_uuid):
    sample = _make_sample('page', pdf_uuid, json_data={'pageNumber': 10})
    plugin.insert(sample)
    rows = plugin.query_by_page(pdf_uuid, 10)
    assert rows and rows[0]['pageNumber'] == 10


def test_count_by_pdf(plugin, pdf_uuid):
    for sample in make_sequence(4):
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    assert plugin.count_by_pdf(pdf_uuid) == 4


def test_delete_by_pdf(plugin, pdf_uuid):
    plugin.insert(_make_sample('page', pdf_uuid))
    plugin.insert(_make_sample('region', pdf_uuid, bookmark_id='bookmark-1728123999999-other'))
    deleted = plugin.delete_by_pdf(pdf_uuid)
    assert deleted == 2


def test_cascade_delete_on_pdf_delete(plugin, pdf_info_plugin, pdf_uuid):
    plugin.insert(_make_sample('page', pdf_uuid))
    pdf_info_plugin.delete(pdf_uuid)
    assert plugin.query_by_pdf(pdf_uuid) == []


def test_add_child_bookmark(plugin, pdf_uuid):
    parent = _make_sample('page', pdf_uuid, bookmark_id='bookmark-1728123457998-parent1')
    plugin.insert(parent)
    child_payload = {
        'bookmark_id': 'bookmark-1728123457999-child1',
        'name': '子节点',
        'type': 'page',
        'pageNumber': 2,
        'children': [],
    }
    child_id = plugin.add_child_bookmark(parent['bookmark_id'], child_payload)
    assert child_id is not None
    updated_parent = plugin.query_by_id(parent['bookmark_id'])
    assert len(updated_parent['children']) == 1


def test_remove_child_bookmark(plugin, pdf_uuid):
    tree = make_tree_samples()
    for sample in tree.values():
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    parent_id = tree['parent']['bookmark_id']
    assert plugin.remove_child_bookmark(parent_id, 0)
    updated_parent = plugin.query_by_id(parent_id)
    assert updated_parent['children'][0]['order'] == 0


def test_reorder_bookmarks(plugin, pdf_uuid):
    items = make_sequence(3)
    for sample in items:
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    ordered_ids = [items[2]['bookmark_id'], items[0]['bookmark_id'], items[1]['bookmark_id']]
    plugin.reorder_bookmarks(pdf_uuid, ordered_ids)
    rows = plugin.query_by_pdf(pdf_uuid)
    orders = {row['bookmark_id']: row['order'] for row in rows}
    assert orders[ordered_ids[0]] == 0


def test_flatten_bookmarks(plugin, pdf_uuid):
    tree = make_tree_samples()
    for sample in tree.values():
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    flat = plugin.flatten_bookmarks(pdf_uuid)
    assert len(flat) >= 3

def test_flatten_nested_bookmarks(plugin, pdf_uuid):
    tree = make_tree_samples()
    grandchild = make_bookmark_sample(kind='page', bookmark_id='bookmark-1728123458000-grandchild1', json_data={'name': '三级', 'parentId': tree['child1']['bookmark_id'], 'order': 0})
    for sample in list(tree.values()) + [grandchild]:
        sample['pdf_uuid'] = pdf_uuid
        plugin.insert(sample)
    flat = plugin.flatten_bookmarks(pdf_uuid)
    levels = {item['bookmark_id']: item['level'] for item in flat}
    assert levels[tree['parent']['bookmark_id']] == 0
    assert levels[tree['child1']['bookmark_id']] == 1
    assert levels['bookmark-1728123458000-grandchild1'] == 2


# ==================== 事件 ====================


def test_event_emission_on_insert(plugin, pdf_uuid, event_bus):
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-bookmark:create:completed', listener, 'test-listener')
    plugin.insert(_make_sample('page', pdf_uuid))
    assert received and received[0]['bookmark_id'].startswith('bookmark-')


def test_event_emission_on_update(plugin, pdf_uuid, event_bus):
    bookmark_id = plugin.insert(_make_sample('page', pdf_uuid))
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-bookmark:update:completed', listener, 'test-listener')
    plugin.update(bookmark_id, {'name': '更新'})
    assert received and received[0]['bookmark_id'] == bookmark_id


def test_event_emission_on_delete(plugin, pdf_uuid, event_bus):
    bookmark_id = plugin.insert(_make_sample('page', pdf_uuid))
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-bookmark:delete:completed', listener, 'test-listener')
    plugin.delete(bookmark_id)
    assert received and received[0]['bookmark_id'] == bookmark_id

