"""验证按标签数（tags）排序在 SQL 层生效"""

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
    db_path = tmp_path / 'pdf_info_sort_tags.db'
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


def test_order_by_tags_count_desc(plugin):
    # a: 1个标签, b: 3个标签, c: 2个标签
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
        sort_rules=[{"field": "tags", "direction": "desc"}],
        limit=None,
        offset=None,
    )
    uuids = [r['uuid'] for r in rows]
    assert uuids[:3] == ['bbbbbbbbbbbb', 'cccccccccccc', 'aaaaaaaaaaaa']

