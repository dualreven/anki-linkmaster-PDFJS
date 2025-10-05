"""PDFInfoTablePlugin 行为测试"""

from __future__ import annotations

import logging
from typing import Dict, List

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import (
    DatabaseConstraintError,
    DatabaseValidationError,
)
from ..pdf_info_plugin import PDFInfoTablePlugin  # 待实现
from ...plugin.event_bus import EventBus
from .fixtures.pdf_info_samples import (
    make_pdf_info_sample,
    make_bulk_samples,
    apply_overrides,
)


@pytest.fixture
def connection_manager(tmp_path):
    """提供隔离的 DatabaseConnectionManager。"""
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'pdf_info_test.db'
    manager = DatabaseConnectionManager(str(db_path))
    yield manager
    manager.close_all()
    DatabaseConnectionManager._instance = None


@pytest.fixture
def connection(connection_manager):
    """返回单个 SQLite 连接。"""
    return connection_manager.get_connection()


@pytest.fixture
def executor(connection):
    """构造 SQLExecutor。"""
    return SQLExecutor(connection)


@pytest.fixture
def event_bus():
    """提供空事件总线。"""
    return EventBus()


@pytest.fixture
def plugin(executor, event_bus):
    """创建并启用 PDFInfoTablePlugin 实例。"""
    plugin = PDFInfoTablePlugin(executor, event_bus, logging.getLogger('test'))
    plugin.enable()
    return plugin


# ==================== 建表与基础校验 ====================


def test_create_table_idempotent(executor, event_bus):
    plugin = PDFInfoTablePlugin(executor, event_bus)
    plugin.enable()
    # 再次启用不会抛异常
    plugin.enable()

    rows = executor.execute_query("""
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'pdf_info'
    """)
    assert rows and rows[0]['name'] == 'pdf_info'


def test_indexes_created(executor, event_bus):
    plugin = PDFInfoTablePlugin(executor, event_bus)
    plugin.enable()

    indexes = executor.execute_query("""
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'pdf_info'
    """)
    index_names = {row['name'] for row in indexes}
    expected = {
        'idx_pdf_title',
        'idx_pdf_author',
        'idx_pdf_created',
        'idx_pdf_visited',
        'idx_pdf_rating',
        'idx_pdf_visible',
    }
    assert expected.issubset(index_names)


# ==================== 数据验证 ====================


def test_validate_data_success(plugin):
    sample = make_pdf_info_sample()
    validated = plugin.validate_data(sample)
    assert validated['uuid'] == sample['uuid']
    assert validated['json_data']['filename'].endswith('.pdf')


def test_validate_data_missing_uuid(plugin):
    sample = make_pdf_info_sample()
    del sample['uuid']

    with pytest.raises(DatabaseValidationError, match='uuid is required'):
        plugin.validate_data(sample)


def test_validate_data_invalid_uuid(plugin):
    sample = make_pdf_info_sample(uuid='INVALID')

    with pytest.raises(DatabaseValidationError, match='12 hex characters'):
        plugin.validate_data(sample)


def test_validate_data_negative_page_count(plugin):
    sample = make_pdf_info_sample(page_count=-1)

    with pytest.raises(DatabaseValidationError, match='non-negative integer'):
        plugin.validate_data(sample)


def test_validate_json_missing_filename(plugin):
    sample = make_pdf_info_sample()
    del sample['json_data']['filename']

    with pytest.raises(DatabaseValidationError, match='filename is required'):
        plugin.validate_data(sample)


def test_validate_json_invalid_filename(plugin):
    sample = make_pdf_info_sample(json_data={'filename': 'bad.txt'})

    with pytest.raises(DatabaseValidationError, match='must match pattern'):
        plugin.validate_data(sample)


def test_validate_json_invalid_rating(plugin):
    sample = make_pdf_info_sample(json_data={'rating': 99})

    with pytest.raises(DatabaseValidationError, match='rating must be between 0 and 5'):
        plugin.validate_data(sample)


def test_validate_json_invalid_tags(plugin):
    sample = make_pdf_info_sample(json_data={'tags': ['valid', '']})

    with pytest.raises(DatabaseValidationError, match='tags must be a list of non-empty strings'):
        plugin.validate_data(sample)


# ==================== CRUD 操作 ====================


def insert_sample(plugin, sample=None):
    data = sample or make_pdf_info_sample()
    uuid = plugin.insert(data)
    return uuid, data


def test_insert_and_query_by_id(plugin):
    uuid, sample = insert_sample(plugin)
    stored = plugin.query_by_id(uuid)
    assert stored is not None
    assert stored['uuid'] == uuid
    assert stored['title'] == sample['title']
    assert stored['filename'] == sample['json_data']['filename']


def test_insert_duplicate_uuid_raises(plugin):
    sample = make_pdf_info_sample()
    plugin.insert(sample)

    with pytest.raises(DatabaseConstraintError):
        plugin.insert(sample)


def test_update_basic_fields(plugin):
    uuid, _ = insert_sample(plugin)
    updated = plugin.update(uuid, {'title': 'Updated Title', 'page_count': 20})
    assert updated is True

    row = plugin.query_by_id(uuid)
    assert row['title'] == 'Updated Title'
    assert row['page_count'] == 20


def test_update_json_fields(plugin):
    uuid, _ = insert_sample(plugin)
    plugin.update(uuid, {'json_data': {'rating': 5, 'tags': ['python', 'db']}})

    row = plugin.query_by_id(uuid)
    assert row['rating'] == 5
    assert set(row['tags']) == {'python', 'db'}


def test_update_nonexistent_returns_false(plugin):
    assert plugin.update('ffffffffffff', {'title': 'Missing'}) is False


def test_delete_existing(plugin):
    uuid, _ = insert_sample(plugin)
    assert plugin.delete(uuid) is True
    assert plugin.query_by_id(uuid) is None


def test_delete_nonexistent_returns_false(plugin):
    assert plugin.delete('ffffffffffff') is False


def test_query_all_supports_limit_and_offset(plugin):
    for sample in make_bulk_samples(5):
        plugin.insert(sample)

    first_three = plugin.query_all(limit=3)
    assert len(first_three) == 3

    next_two = plugin.query_all(limit=2, offset=3)
    assert len(next_two) == 2

    first_ids = {row['uuid'] for row in first_three}
    next_ids = {row['uuid'] for row in next_two}
    assert first_ids.isdisjoint(next_ids)


# ==================== 扩展查询 ====================


def test_query_by_filename(plugin):
    uuid, sample = insert_sample(plugin)
    row = plugin.query_by_filename(sample['json_data']['filename'])
    assert row is not None
    assert row['uuid'] == uuid


def test_search_by_keyword(plugin):
    samples = make_bulk_samples(3)
    samples = apply_overrides(samples, title='Deep Learning Notes')
    for item in samples:
        plugin.insert(item)

    results = plugin.search(keyword='learning')
    assert len(results) == 3


def test_search_with_custom_fields(plugin):
    target = make_pdf_info_sample(
        uuid='cccccccccccc',
        json_data={'notes': 'Contains special keyword', 'filename': 'cccccccccccc.pdf'}
    )
    other = make_pdf_info_sample(
        uuid='dddddddddddd',
        json_data={'notes': 'Irrelevant note', 'filename': 'dddddddddddd.pdf'}
    )
    plugin.insert(target)
    plugin.insert(other)

    results = plugin.search('special', fields=['notes'])
    assert len(results) == 1
    assert results[0]['uuid'] == 'cccccccccccc'


def test_filter_by_tags_any(plugin):
    samples = make_bulk_samples(3)
    for item in samples:
        plugin.insert(item)

    results = plugin.filter_by_tags(['python', 'tag1'])
    assert len(results) >= 2
    assert all('tags' in row for row in results)


def test_filter_by_tags_all(plugin):
    sample = make_pdf_info_sample(json_data={'tags': ['python', 'ml']})
    plugin.insert(sample)

    results = plugin.filter_by_tags(['python', 'ml'], match_mode='all')
    assert len(results) == 1
    assert results[0]['uuid'] == sample['uuid']


def test_filter_by_rating_range(plugin):
    samples = make_bulk_samples(5)
    for item in samples:
        plugin.insert(item)

    results = plugin.filter_by_rating(min_rating=2, max_rating=4)
    assert all(2 <= row['rating'] <= 4 for row in results)


def test_get_visible_pdfs(plugin):
    visible = make_pdf_info_sample(uuid='aaaaaaaaaaaa', json_data={'is_visible': True})
    hidden = make_pdf_info_sample(uuid='bbbbbbbbbbbb', json_data={'is_visible': False})
    plugin.insert(visible)
    plugin.insert(hidden)

    results = plugin.get_visible_pdfs()
    uuids = {row['uuid'] for row in results}
    assert 'aaaaaaaaaaaa' in uuids
    assert 'bbbbbbbbbbbb' not in uuids


def test_update_reading_stats(plugin):
    uuid, _ = insert_sample(plugin)
    assert plugin.update_reading_stats(uuid, reading_time_delta=120)
    row = plugin.query_by_id(uuid)
    assert row['total_reading_time'] == 120
    assert row['review_count'] == 1
    assert row['visited_at'] > 0


def test_add_tag(plugin):
    uuid, _ = insert_sample(plugin)
    plugin.add_tag(uuid, 'database')
    row = plugin.query_by_id(uuid)
    assert 'database' in row['tags']


def test_remove_tag(plugin):
    sample = make_pdf_info_sample(json_data={'tags': ['python', 'database']})
    uuid, _ = insert_sample(plugin, sample)
    plugin.remove_tag(uuid, 'database')
    row = plugin.query_by_id(uuid)
    assert 'database' not in row['tags']


def test_get_statistics(plugin):
    for item in make_bulk_samples(3):
        plugin.insert(item)

    stats = plugin.get_statistics()
    assert stats['total_count'] == 3
    assert 'total_size' in stats
    assert 'avg_pages' in stats
    assert 'visible_count' in stats


# ==================== 事件测试 ====================


def test_event_emission_on_insert(connection_manager, event_bus):
    executor = SQLExecutor(connection_manager.get_connection())
    plugin = PDFInfoTablePlugin(executor, event_bus)
    plugin.enable()

    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-info:create:completed', listener, 'test-listener')

    plugin.insert(make_pdf_info_sample())
    assert len(received) == 1
    assert received[0]['uuid'] == '0c251de0e2ac'


def test_event_emission_on_update(plugin, event_bus):
    uuid, _ = insert_sample(plugin)
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-info:update:completed', listener, 'test-listener')

    plugin.update(uuid, {'title': 'Event Title'})
    assert len(received) == 1
    assert received[0]['uuid'] == uuid


def test_event_emission_on_delete(plugin, event_bus):
    uuid, _ = insert_sample(plugin)
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-info:delete:completed', listener, 'test-listener')

    plugin.delete(uuid)
    assert len(received) == 1
    assert received[0]['uuid'] == uuid








