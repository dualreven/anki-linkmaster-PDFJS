# -*- coding: utf-8 -*-
from src.backend.database.plugins.pdf_info.read_ops_core.parser import parse_row
from src.backend.database.plugins.pdf_info.read_ops_core.weighted import compile_weighted_expr
from src.backend.database.plugins.pdf_info.read_ops_core.filter_builder import build_filter_sql


def test_parse_row_merges_json():
    row = {
        "uuid": "u1",
        "title": "T",
        "author": "A",
        "page_count": 10,
        "file_size": 1000,
        "created_at": 1,
        "updated_at": 2,
        "visited_at": 3,
        "version": 1,
        "json_data": '{"filename":"a.pdf","rating":5}',
    }
    parsed = parse_row(row)
    assert parsed["uuid"] == "u1"
    assert parsed["json_data"]["filename"] == "a.pdf"
    assert parsed["rating"] == 5


def test_weighted_compile_clamp_and_tags_funcs():
    sql1, p1 = compile_weighted_expr(None, "clamp(rating,1,5)")
    assert "CASE WHEN" in sql1 and "rating" not in p1  # 无参数
    # tags_has_all
    sql2, p2 = compile_weighted_expr(None, "tags_has_all('a','b')")
    assert "EXISTS" in sql2 and len(p2) == 2 and p2 == ["a", "b"]


def test_filter_builder_examples():
    # 可见性
    sql, params = build_filter_sql({"type": "field", "field": "is_visible", "operator": "eq", "value": True})
    assert "is_visible" in sql and params == []
    # 评分
    sql, params = build_filter_sql({"type": "field", "field": "rating", "operator": "gte", "value": 3})
    assert "CAST(json_extract(json_data, '$.rating')" in sql and params == [3]
    # 标签 has_all
    sql, params = build_filter_sql({"type": "field", "field": "tags", "operator": "has_all", "value": ["x","y"]})
    assert sql.count("EXISTS") == 2 and params == ["x", "y"]

