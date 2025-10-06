"""PDFInfoTablePlugin.search_records 行为测试（多关键词、多字段、转义与分页）"""

from __future__ import annotations

from typing import List, Dict
import logging
import pytest

from ...connection import DatabaseConnectionManager
from ...executor import SQLExecutor
from ..pdf_info_plugin import PDFInfoTablePlugin
from .fixtures.pdf_info_samples import (
    make_pdf_info_sample,
    make_bulk_samples,
)


@pytest.fixture
def plugin(tmp_path):
    DatabaseConnectionManager._instance = None
    db_path = tmp_path / 'pdf_info_search_records.db'
    manager = DatabaseConnectionManager(str(db_path))
    executor = SQLExecutor(manager.get_connection())
    event_bus = None
    plugin = PDFInfoTablePlugin(executor, event_bus, logging.getLogger('test'))
    plugin.enable()
    yield plugin
    manager.close_all()
    DatabaseConnectionManager._instance = None


def _insert(plugin: PDFInfoTablePlugin, data: Dict) -> str:
    return plugin.insert(data)


def test_search_records_empty_returns_all(plugin):
    for s in make_bulk_samples(3):
        _insert(plugin, s)

    rows = plugin.search_records([], None)
    assert len(rows) == 3


def test_search_records_multi_keywords_and(plugin):
    one = make_pdf_info_sample(
        uuid='a1a1a1a1a1a1',
        title='Deep Learning for Graphs',
        author='Alice',
        json_data={'tags': ['ai', 'graph'], 'notes': 'GNN tutorials'}
    )
    two = make_pdf_info_sample(
        uuid='b2b2b2b2b2b2',
        title='Deep Dive into Systems',
        author='Bob',
        json_data={'tags': ['systems']}
    )
    _insert(plugin, one)
    _insert(plugin, two)

    # 要求两个关键词都命中（AND），字段内 OR
    rows = plugin.search_records(['deep', 'graph'])
    ids = {r['uuid'] for r in rows}
    assert 'a1a1a1a1a1a1' in ids
    assert 'b2b2b2b2b2b2' not in ids


def test_search_records_json_fields_and_tags(plugin):
    one = make_pdf_info_sample(
        uuid='c3c3c3c3c3c3',
        title='Reinforcement Learning',
        json_data={'tags': ['rl', 'ai'], 'subject': 'Control', 'keywords': 'policy, value'}
    )
    _insert(plugin, one)

    rows1 = plugin.search_records(['ai'])
    assert any(r['uuid'] == 'c3c3c3c3c3c3' for r in rows1), 'tags 数组应可被模糊匹配到关键字 ai'

    rows2 = plugin.search_records(['control'])
    assert any(r['uuid'] == 'c3c3c3c3c3c3' for r in rows2), 'subject 字段应可匹配'

    rows3 = plugin.search_records(['policy'])
    assert any(r['uuid'] == 'c3c3c3c3c3c3' for r in rows3), 'keywords 字段应可匹配'


def test_search_records_like_escape(plugin):
    special = make_pdf_info_sample(
        uuid='d4d4d4d4d4d4',
        title='Report 50%_done',
    )
    _insert(plugin, special)

    # 关键字包含 % 与 _ 时不应作为通配符生效，需转义
    rows = plugin.search_records(['50%_done'])
    assert any(r['uuid'] == 'd4d4d4d4d4d4' for r in rows)


def test_search_records_pagination(plugin):
    # 插入 5 条，并验证 limit/offset 生效
    for idx in range(5):
        sample = make_pdf_info_sample(
            uuid=f'e{idx:011d}',
            title=f'Graph Theory {idx}',
        )
        _insert(plugin, sample)

    page = plugin.search_records(['graph'], limit=2, offset=2)
    assert len(page) == 2

