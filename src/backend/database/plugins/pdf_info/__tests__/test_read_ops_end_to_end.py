# -*- coding: utf-8 -*-
from typing import Any, List, Tuple, Optional

from src.backend.database.plugins.pdf_info import read_ops as ro


class _FakeExecutor:
    def __init__(self):
        self.last_sql: Optional[str] = None
        self.last_params: Optional[Tuple[Any, ...]] = None
        self._rows: List[dict] = []

    def execute_query(self, sql: str, params: Optional[Tuple[Any, ...]] = None):
        self.last_sql = sql
        self.last_params = params
        return self._rows


class _FakePlugin:
    def __init__(self):
        self._executor = _FakeExecutor()


def test_search_with_filters_sql_and_params_shape():
    plugin = _FakePlugin()
    keywords = ["alpha"]
    filters = {"type": "field", "field": "is_visible", "operator": "eq", "value": True}
    sort_rules = [{"field": "weighted", "formula": "tags_has_all('x','y')"}]
    limit = 10
    offset = 5

    ro.search_with_filters(plugin, keywords, filters=filters, search_fields=None, sort_rules=sort_rules, limit=limit, offset=offset)

    assert plugin._executor.last_sql is not None
    sql = plugin._executor.last_sql or ""
    params = list(plugin._executor.last_params or ())

    # SQL 形态断言：包含 WHERE / ORDER BY / LIMIT / OFFSET
    assert "WHERE" in sql and "ORDER BY" in sql and "LIMIT" in sql and "OFFSET" in sql

    # 参数顺序断言：
    # title, author, filename, tags(json LIKE), notes, subject, keywords -> 7 个关键字参数
    # weighted(tags_has_all) -> 'x','y'
    # 最后追加 limit, offset
    expected = [
        "%alpha%",  # title
        "%alpha%",  # author
        "%alpha%",  # filename
        '%"alpha"%',  # tags LIKE
        "%alpha%",  # notes
        "%alpha%",  # subject
        "%alpha%",  # keywords
        "x", "y",   # weighted params
        10, 5,      # limit, offset
    ]
    assert params == expected

