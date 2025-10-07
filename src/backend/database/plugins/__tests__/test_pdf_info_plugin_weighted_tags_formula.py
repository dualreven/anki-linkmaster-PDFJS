"""按加权公式（使用 SQL 内置函数与 JSON1）排序：tags_length 与 tags_has_*"""

from __future__ import annotations

import logging

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ..pdf_info_plugin import PDFInfoTablePlugin
from ...plugin.event_bus import EventBus
from .fixtures.pdf_info_samples import make_pdf_info_sample


@pytest.fixture
def connection_manager(tmp_path):
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'pdf_info_weighted_tags.db'
    manager = DatabaseConnectionManager(str(db_path))
    yield manager
    manager.close_all()
    DatabaseConnectionManager._instance = None


@pytest.fixture
def executor(connection_manager):
    return SQLExecutor(connection_manager.get_connection())


@pytest.fixture
def plugin(executor):
    plugin = PDFInfoTablePlugin(executor, EventBus(), logging.getLogger('test'))
    plugin.enable()
    return plugin


def test_order_by_weighted_tags_length(plugin):
    # a: 1 tag, b: 3 tags, c: 2 tags
    a = make_pdf_info_sample(
        uuid='aaaaaaaaaaaa', title='A',
        json_data={'filename': 'aaaaaaaaaaaa.pdf', 'tags': ['one']}
    )
    b = make_pdf_info_sample(
        uuid='bbbbbbbbbbbb', title='B',
        json_data={'filename': 'bbbbbbbbbbbb.pdf', 'tags': ['x', 'y', 'z']}
    )
    c = make_pdf_info_sample(
        uuid='cccccccccccc', title='C',
        json_data={'filename': 'cccccccccccc.pdf', 'tags': ['p', 'q']}
    )
    for it in (a, b, c):
        plugin.insert(it)

    rows = plugin.search_with_filters(
        keywords=[],
        filters=None,
        search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
        sort_rules=[{"field": "weighted", "direction": "desc", "formula": "tags_length()"}],
        limit=None, offset=None,
    )
    uuids = [r['uuid'] for r in rows]
    assert uuids[:3] == ['bbbbbbbbbbbb', 'cccccccccccc', 'aaaaaaaaaaaa']


def test_order_by_weighted_tags_has(plugin):
    m = make_pdf_info_sample(
        uuid='a1a1a1a1a1a1', title='M',
        json_data={'filename': 'a1a1a1a1a1a1.pdf', 'tags': ['math', 'ai']}
    )
    n = make_pdf_info_sample(
        uuid='b1b1b1b1b1b1', title='N',
        json_data={'filename': 'b1b1b1b1b1b1.pdf', 'tags': ['ai']}
    )
    o = make_pdf_info_sample(
        uuid='c1c1c1c1c1c1', title='O',
        json_data={'filename': 'c1c1c1c1c1c1.pdf', 'tags': []}
    )
    for it in (m, n, o):
        plugin.insert(it)

    # 将包含 'math' 的排前面
    rows = plugin.search_with_filters(
        keywords=[], filters=None,
        search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
        sort_rules=[{"field": "weighted", "direction": "desc", "formula": "tags_has('math')"}],
        limit=None, offset=None,
    )
    uuids = [r['uuid'] for r in rows]
    assert uuids[:2] == ['a1a1a1a1a1a1', 'b1b1b1b1b1b1']

