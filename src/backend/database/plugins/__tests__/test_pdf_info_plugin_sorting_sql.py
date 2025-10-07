"""验证在 SQL 层按多字段排序（ORDER BY）生效"""

from __future__ import annotations

import logging
from typing import List

import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ..pdf_info_plugin import PDFInfoTablePlugin
from ...plugin.event_bus import EventBus
from .fixtures.pdf_info_samples import make_pdf_info_sample


@pytest.fixture
def connection_manager(tmp_path):
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'pdf_info_sort_sql.db'
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


def test_sql_multi_field_order_by(plugin):
    # 构造三条数据，刻意打乱 rating 与 updated_at 分布
    items = [
        make_pdf_info_sample(
            uuid='aaaaaaaaaaaa', title='A',
            updated_at=2000,
            json_data={'filename': 'aaaaaaaaaaaa.pdf', 'rating': 3}
        ),
        make_pdf_info_sample(
            uuid='bbbbbbbbbbbb', title='B',
            updated_at=1000,
            json_data={'filename': 'bbbbbbbbbbbb.pdf', 'rating': 5}
        ),
        make_pdf_info_sample(
            uuid='cccccccccccc', title='C',
            updated_at=1500,
            json_data={'filename': 'cccccccccccc.pdf', 'rating': 5}
        ),
    ]
    for it in items:
        plugin.insert(it)

    # SQL 层排序：先 rating DESC，再 updated_at ASC（对 rating 相同者）
    rows = plugin.search_with_filters(
        keywords=[],
        filters=None,
        search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
        sort_rules=[
            {"field": "rating", "direction": "desc"},
            {"field": "updated_at", "direction": "asc"},
        ],
        limit=None,
        offset=None,
    )
    uuids: List[str] = [r['uuid'] for r in rows]
    # 预期：两条 rating=5 先按 updated_at 升序（1000 的 bbbb 在 1500 的 cccc 前），rating=3 的 aaaa 在最后
    assert uuids == ['bbbbbbbbbbbb', 'cccccccccccc', 'aaaaaaaaaaaa']

