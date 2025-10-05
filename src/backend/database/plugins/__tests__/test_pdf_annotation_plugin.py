"""PDFAnnotationTablePlugin 行为测试"""

from __future__ import annotations

import logging
import time
from typing import Dict, List

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ...exceptions import (
    DatabaseConstraintError,
    DatabaseValidationError,
)
from ..pdf_info_plugin import PDFInfoTablePlugin
from ...plugin.event_bus import EventBus
from ..pdf_annotation_plugin import PDFAnnotationTablePlugin  # 待实现
from .fixtures.pdf_info_samples import make_pdf_info_sample
from .fixtures.pdf_annotation_samples import (
    make_annotation_sample,
    make_multiple_annotations,
)


@pytest.fixture
def connection_manager(tmp_path):
    """提供隔离的 DatabaseConnectionManager。"""
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'annotation_test.db'
    manager = DatabaseConnectionManager(str(db_path))
    yield manager
    manager.close_all()
    DatabaseConnectionManager._instance = None


@pytest.fixture
def connection(connection_manager):
    """返回 SQLite 连接。"""
    return connection_manager.get_connection()


@pytest.fixture
def executor(connection):
    """构造 SQLExecutor。"""
    return SQLExecutor(connection)


@pytest.fixture
def event_bus():
    """提供事件总线。"""
    return EventBus()


@pytest.fixture
def pdf_info_plugin(executor, event_bus):
    """创建并启用 PDFInfoTablePlugin。"""
    plugin = PDFInfoTablePlugin(executor, event_bus, logging.getLogger('test.pdf_info'))
    plugin.enable()
    return plugin


@pytest.fixture
def plugin(executor, event_bus, pdf_info_plugin):
    """创建并启用 PDFAnnotationTablePlugin。"""
    plugin = PDFAnnotationTablePlugin(executor, event_bus, logging.getLogger('test.annotation'))
    plugin.enable()
    return plugin


@pytest.fixture
def pdf_uuid(pdf_info_plugin):
    """插入 PDF 样例，返回 uuid。"""
    sample = make_pdf_info_sample()
    pdf_info_plugin.insert(sample)
    return sample['uuid']


def _make_sample(ann_type: str, pdf_uuid: str, **overrides: Dict) -> Dict:
    sample = make_annotation_sample(ann_type=ann_type, **overrides)
    sample['pdf_uuid'] = pdf_uuid
    return sample


# ==================== 建表与基础校验 ====================


def test_create_table_idempotent(executor, event_bus, pdf_info_plugin):
    annotation_plugin = PDFAnnotationTablePlugin(executor, event_bus)
    annotation_plugin.enable()
    # 再次启用不会抛出异常
    annotation_plugin.enable()

    rows = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'pdf_annotation'
        """
    )
    assert rows and rows[0]['name'] == 'pdf_annotation'


def test_indexes_created(executor, event_bus, pdf_info_plugin):
    annotation_plugin = PDFAnnotationTablePlugin(executor, event_bus)
    annotation_plugin.enable()

    indexes = executor.execute_query(
        """
        SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'pdf_annotation'
        """
    )
    index_names = {row['name'] for row in indexes}
    expected = {
        'idx_ann_pdf_uuid',
        'idx_ann_page',
        'idx_ann_type',
        'idx_ann_created',
        'idx_ann_pdf_page',
    }
    assert expected.issubset(index_names)


# ==================== 数据验证 ====================


def test_validate_screenshot_data_success(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    validated = plugin.validate_data(sample)
    assert validated['type'] == 'screenshot'
    assert validated['json_data']['data']['rect']['width'] > 0


def test_validate_screenshot_missing_rect(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    del sample['json_data']['data']['rect']

    with pytest.raises(DatabaseValidationError, match='rect is required'):
        plugin.validate_data(sample)


def test_validate_screenshot_invalid_image_path(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['json_data']['data']['imagePath'] = ''

    with pytest.raises(DatabaseValidationError, match='imagePath must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_screenshot_invalid_image_hash(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['json_data']['data']['imageHash'] = '123'

    with pytest.raises(DatabaseValidationError, match='imageHash must be 32 hex characters'):
        plugin.validate_data(sample)


def test_validate_text_highlight_success(plugin, pdf_uuid):
    sample = _make_sample('text-highlight', pdf_uuid)
    validated = plugin.validate_data(sample)
    assert validated['json_data']['data']['highlightColor'] == '#ffcc00'


def test_validate_text_highlight_missing_selected_text(plugin, pdf_uuid):
    sample = _make_sample('text-highlight', pdf_uuid)
    sample['json_data']['data']['selectedText'] = ''

    with pytest.raises(DatabaseValidationError, match='selectedText must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_text_highlight_invalid_color(plugin, pdf_uuid):
    sample = _make_sample('text-highlight', pdf_uuid)
    sample['json_data']['data']['highlightColor'] = 'yellow'

    with pytest.raises(DatabaseValidationError, match='highlightColor must be a HEX color'):
        plugin.validate_data(sample)


def test_validate_comment_success(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    validated = plugin.validate_data(sample)
    assert validated['type'] == 'comment'


def test_validate_comment_missing_position(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    del sample['json_data']['data']['position']

    with pytest.raises(DatabaseValidationError, match='position is required'):
        plugin.validate_data(sample)


def test_validate_comment_missing_content(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    sample['json_data']['data']['content'] = ''

    with pytest.raises(DatabaseValidationError, match='content must be a non-empty string'):
        plugin.validate_data(sample)


def test_validate_comments_array(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['json_data']['comments'] = [{'id': 'c1', 'createdAt': '2025-10-05'}]

    with pytest.raises(DatabaseValidationError, match='each comment must contain id/content/createdAt'):
        plugin.validate_data(sample)


def test_validate_invalid_type(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['type'] = 'unknown'

    with pytest.raises(DatabaseValidationError, match='type must be one of'):
        plugin.validate_data(sample)


def test_validate_invalid_page_number(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['page_number'] = 0

    with pytest.raises(DatabaseValidationError, match='page_number must be greater than 0'):
        plugin.validate_data(sample)


def test_validate_missing_pdf_uuid(plugin):
    sample = make_annotation_sample()
    sample.pop('pdf_uuid')

    with pytest.raises(DatabaseValidationError, match='pdf_uuid is required'):
        plugin.validate_data(sample)


def test_validate_invalid_ann_id_format(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    sample['ann_id'] = 'invalid'

    with pytest.raises(DatabaseValidationError, match='ann_id must match pattern'):
        plugin.validate_data(sample)


def test_validate_foreign_key_constraint(plugin):
    sample = make_annotation_sample()

    with pytest.raises(DatabaseConstraintError):
        plugin.insert(sample)


# ==================== CRUD ====================


def test_insert_screenshot_annotation(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    ann_id = plugin.insert(sample)
    row = plugin.query_by_id(ann_id)
    assert row['type'] == 'screenshot'
    assert row['data']['rect']['width'] == sample['json_data']['data']['rect']['width']


def test_insert_text_highlight_annotation(plugin, pdf_uuid):
    sample = _make_sample('text-highlight', pdf_uuid)
    ann_id = plugin.insert(sample)
    row = plugin.query_by_id(ann_id)
    assert row['type'] == 'text-highlight'
    assert row['data']['selectedText'] == '深度学习'


def test_insert_comment_annotation(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    ann_id = plugin.insert(sample)
    row = plugin.query_by_id(ann_id)
    assert row['type'] == 'comment'
    assert row['data']['content'] == '需要复习这一段'


def test_insert_duplicate_ann_id(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    plugin.insert(sample)

    with pytest.raises(DatabaseConstraintError):
        plugin.insert(sample)


def test_update_annotation(plugin, pdf_uuid):
    sample = _make_sample('text-highlight', pdf_uuid)
    ann_id = plugin.insert(sample)

    updated = plugin.update(ann_id, {
        'page_number': 5,
        'json_data': {
            'data': {'note': '更新后的笔记'}
        }
    })
    assert updated is True

    row = plugin.query_by_id(ann_id)
    assert row['page_number'] == 5
    assert row['data']['note'] == '更新后的笔记'


def test_delete_annotation(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    ann_id = plugin.insert(sample)
    assert plugin.delete(ann_id) is True
    assert plugin.query_by_id(ann_id) is None


def test_query_by_id(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    ann_id = plugin.insert(sample)
    row = plugin.query_by_id(ann_id)
    assert row['ann_id'] == ann_id


def test_query_all(plugin, pdf_uuid):
    annotations = make_multiple_annotations(3)
    for record in annotations:
        record['pdf_uuid'] = pdf_uuid
        plugin.insert(record)

    rows = plugin.query_all()
    assert len(rows) == 3


def test_query_all_pagination(plugin, pdf_uuid):
    annotations = make_multiple_annotations(5)
    for record in annotations:
        record['pdf_uuid'] = pdf_uuid
        plugin.insert(record)

    first_three = plugin.query_all(limit=3)
    assert len(first_three) == 3

    next_two = plugin.query_all(limit=2, offset=3)
    assert len(next_two) == 2
    first_ids = {row['ann_id'] for row in first_three}
    next_ids = {row['ann_id'] for row in next_two}
    assert first_ids.isdisjoint(next_ids)


def test_parse_row(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    ann_id = plugin.insert(sample)
    row = plugin.query_by_id(ann_id)
    assert row['comments']
    assert isinstance(row['data'], dict)


# ==================== 扩展查询 ====================


def test_query_by_pdf(plugin, pdf_uuid):
    for record in make_multiple_annotations(3):
        record['pdf_uuid'] = pdf_uuid
        plugin.insert(record)

    rows = plugin.query_by_pdf(pdf_uuid)
    assert len(rows) == 3


def test_query_by_page(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid, page_number=7)
    plugin.insert(sample)
    rows = plugin.query_by_page(pdf_uuid, 7)
    assert rows[0]['page_number'] == 7


def test_query_by_type(plugin, pdf_uuid):
    plugin.insert(_make_sample('comment', pdf_uuid))
    rows = plugin.query_by_type(pdf_uuid, 'comment')
    assert rows and rows[0]['type'] == 'comment'


def test_count_by_pdf(plugin, pdf_uuid):
    for record in make_multiple_annotations(4):
        record['pdf_uuid'] = pdf_uuid
        plugin.insert(record)
    assert plugin.count_by_pdf(pdf_uuid) == 4


def test_count_by_type(plugin, pdf_uuid):
    plugin.insert(_make_sample('comment', pdf_uuid))
    plugin.insert(_make_sample('comment', pdf_uuid, ann_id='ann_172800000099_888888'))
    assert plugin.count_by_type(pdf_uuid, 'comment') == 2


def test_delete_by_pdf(plugin, pdf_uuid):
    plugin.insert(_make_sample('comment', pdf_uuid))
    plugin.insert(_make_sample('screenshot', pdf_uuid, ann_id='ann_172800000100_777777'))

    deleted = plugin.delete_by_pdf(pdf_uuid)
    assert deleted == 2
    assert plugin.query_by_pdf(pdf_uuid) == []


def test_delete_by_pdf_cascade(plugin, pdf_info_plugin, pdf_uuid):
    plugin.insert(_make_sample('comment', pdf_uuid))
    pdf_info_plugin.delete(pdf_uuid)
    assert plugin.query_by_pdf(pdf_uuid) == []


def test_query_empty_results(plugin, pdf_uuid):
    assert plugin.query_by_pdf('missing') == []


# ==================== 评论管理 ====================


def test_add_comment(plugin, pdf_uuid):
    ann_id = plugin.insert(_make_sample('comment', pdf_uuid))
    new_comment = plugin.add_comment(ann_id, '新的评论')
    assert new_comment is not None
    row = plugin.query_by_id(ann_id)
    assert any(c['content'] == '新的评论' for c in row['comments'])


def test_add_comment_to_nonexistent_annotation(plugin):
    assert plugin.add_comment('ann_missing', '评论内容') is None


def test_remove_comment(plugin, pdf_uuid):
    sample = _make_sample('screenshot', pdf_uuid)
    ann_id = plugin.insert(sample)
    comment_id = sample['json_data']['comments'][0]['id']
    assert plugin.remove_comment(ann_id, comment_id)
    row = plugin.query_by_id(ann_id)
    assert not row['comments']


def test_remove_nonexistent_comment(plugin, pdf_uuid):
    sample = _make_sample('comment', pdf_uuid)
    ann_id = plugin.insert(sample)
    assert plugin.remove_comment(ann_id, 'missing') is False


def test_multiple_comments(plugin, pdf_uuid):
    ann_id = plugin.insert(_make_sample('comment', pdf_uuid))
    plugin.add_comment(ann_id, '评论一')
    plugin.add_comment(ann_id, '评论二')
    row = plugin.query_by_id(ann_id)
    assert len(row['comments']) >= 2


# ==================== 事件 ====================


def test_event_emission_on_insert(plugin, pdf_uuid, event_bus):
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-annotation:create:completed', listener, 'test-listener')
    plugin.insert(_make_sample('comment', pdf_uuid))
    assert len(received) == 1
    assert received[0]['ann_id'].startswith('ann_')


def test_event_emission_on_update(plugin, pdf_uuid, event_bus):
    ann_id = plugin.insert(_make_sample('comment', pdf_uuid))
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-annotation:update:completed', listener, 'test-listener')
    plugin.update(ann_id, {'json_data': {'data': {'content': '更新内容'}}})
    assert len(received) == 1
    assert received[0]['ann_id'] == ann_id


def test_event_emission_on_delete(plugin, pdf_uuid, event_bus):
    ann_id = plugin.insert(_make_sample('screenshot', pdf_uuid))
    received: List[Dict] = []

    def listener(data):
        received.append(data)

    event_bus.on('table:pdf-annotation:delete:completed', listener, 'test-listener')
    plugin.delete(ann_id)
    assert len(received) == 1
    assert received[0]['ann_id'] == ann_id

