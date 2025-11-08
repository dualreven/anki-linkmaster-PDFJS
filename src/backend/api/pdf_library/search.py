from __future__ import annotations
from typing import Any, Dict, List, Optional
from .utils import map_to_frontend as _map_to_frontend


def _needs_memory_sort(rules: List[Dict[str, Any]]) -> bool:
    if not rules:
        return False
    sql_orderable_fields = {
        'title', 'author', 'filename', 'modified_time', 'updated_at',
        'created_time', 'created_at', 'page_count', 'file_size', 'size',
        'rating', 'review_count', 'total_reading_time', 'last_accessed_at', 'due_date', 'star'
    }
    for r in rules:
        f = str(r.get('field', '')).strip().lower()
        if f == 'match_score':
            return True
        if f not in sql_orderable_fields:
            return True
    return False


def _calculate_match_info(api, record: Dict[str, Any], row: Dict[str, Any], tokens: List[str], query: str) -> Dict[str, Any]:
    if not tokens:
        return {"matched": True, "score": 0, "fields": set()}

    json_data = row.get("json_data", {}) or {}
    field_weights = {
        "title": 5,
        "author": 3,
        "tags": 2,
        "subject": 2,
        "keywords": 2,
        "notes": 1,
    }

    matched_fields = set()
    score = 0

    def _contains(value: Any, token: str) -> bool:
        if value is None:
            return False
        if isinstance(value, (int, float)):
            value = str(value)
        if isinstance(value, str):
            return token in value.lower()
        if isinstance(value, list):
            return any(_contains(v, token) for v in value)
        if isinstance(value, dict):
            return any(_contains(v, token) for v in value.values())
        return False

    fields = {
        "title": record.get("title"),
        "author": record.get("author"),
        "tags": json_data.get("tags", []),
        "subject": json_data.get("subject", ""),
        "keywords": json_data.get("keywords", ""),
        "notes": json_data.get("notes", ""),
    }

    # 多词查询时（tokens>1）限制在标题内做“全词命中”判断；
    # 单词查询时允许跨字段匹配（与现有行为保持一致）。
    field_items = fields.items()
    if len(tokens) > 1:
        field_items = (("title", fields["title"]),)

    for token in tokens:
        token_matched = False
        for field_name, value in field_items:
            if _contains(value, token):
                matched_fields.add(field_name)
                score += field_weights.get(field_name, 1)
                token_matched = True
        if not token_matched:
            return {"matched": False, "score": 0, "fields": set()}

    # 额外的 query（原始字符串）加分：命中标题则加 2 分
    if query and isinstance(fields.get("title"), str) and query in fields["title"].lower():
        score += 2

    return {"matched": True, "score": score, "fields": matched_fields}


def _apply_search_filters(record: Dict[str, Any], filters: Dict[str, Any]) -> bool:
    if not filters:
        return True
    jd = (record.get("json_data") or {}) if isinstance(record.get("json_data"), dict) else {}
    # 可扩展的过滤规则（现有兼容）
    if "is_visible" in jd and isinstance(filters.get("is_visible"), bool):
        if bool(jd.get("is_visible")) != bool(filters.get("is_visible")):
            return False
    # tags 交集匹配
    if "tags" in filters and isinstance(filters["tags"], list) and filters["tags"]:
        want = set([str(t).strip().lower() for t in filters["tags"] if str(t).strip()])
        have = set([str(t).strip().lower() for t in (jd.get("tags") or []) if str(t).strip()])
        if not want.intersection(have):
            return False
    return True


def _search_sort_value(item: Dict[str, Any], field: str) -> Any:
    v = item.get(field)
    if v is None:
        return ""
    return v


def search_records(api, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    提供与 PDFLibraryAPI.search_records 等价的实现，以 API 实例为上下文。
    仅依赖 api 的插件/映射方法，保持行为一致。
    """
    if payload is None:
        from ..database.exceptions import DatabaseValidationError  # type: ignore
        raise DatabaseValidationError("payload is required")

    # 优先分支：无关键词 + 特定排序 → 直接 SQL
    try:
        tokens_peek = [str(token).strip().lower() for token in (payload.get("tokens") or []) if str(token).strip()]
        sort_rules_peek = payload.get("sort") or []
        pagination_peek = payload.get("pagination") or {}
        limit_peek = int(pagination_peek.get("limit", 50))
        offset_peek = int(pagination_peek.get("offset", 0))
        need_total_peek = bool(pagination_peek.get("need_total", False))
        only_visited_desc = (
            isinstance(sort_rules_peek, list)
            and len(sort_rules_peek) >= 1
            and sort_rules_peek[0].get("field") == "visited_at"
            and str(sort_rules_peek[0].get("direction", "desc")).lower() == "desc"
        )
        only_created_desc = (
            isinstance(sort_rules_peek, list)
            and len(sort_rules_peek) >= 1
            and sort_rules_peek[0].get("field") == "created_at"
            and str(sort_rules_peek[0].get("direction", "desc")).lower() == "desc"
        )
        no_filters = not bool(payload.get("filters"))
        if (not tokens_peek) and only_visited_desc and no_filters:
            rows = api._pdf_info_plugin.query_all_by_visited(limit=limit_peek, offset=offset_peek)
            records = [_map_to_frontend(api, r) for r in rows]
            total = api._pdf_info_plugin.count_all() if need_total_peek else len(records)
            return {
                "records": records,
                "total": total,
                "page": {"limit": limit_peek, "offset": offset_peek},
                "meta": {"query": payload.get("query", ""), "tokens": []},
            }
        if (not tokens_peek) and only_created_desc and no_filters:
            rows = api._pdf_info_plugin.query_all_by_created(limit=limit_peek, offset=offset_peek)
            records = [_map_to_frontend(api, r) for r in rows]
            total = api._pdf_info_plugin.count_all() if need_total_peek else len(records)
            return {
                "records": records,
                "total": total,
                "page": {"limit": limit_peek, "offset": offset_peek},
                "meta": {"query": payload.get("query", ""), "tokens": []},
            }
    except Exception:
        pass

    tokens = [str(token).strip().lower() for token in (payload.get("tokens") or []) if str(token).strip()]
    filters = payload.get("filters")
    sort_rules = payload.get("sort") or []
    pagination = payload.get("pagination") or {}
    try:
        limit = int(pagination.get("limit", 50))
    except (TypeError, ValueError):
        from ..database.exceptions import DatabaseValidationError  # type: ignore
        raise DatabaseValidationError("pagination.limit must be an integer")
    try:
        offset = int(pagination.get("offset", 0))
    except (TypeError, ValueError):
        from ..database.exceptions import DatabaseValidationError  # type: ignore
        raise DatabaseValidationError("pagination.offset must be an integer")
    if limit < 0 or offset < 0:
        from ..database.exceptions import DatabaseValidationError  # type: ignore
        raise DatabaseValidationError("pagination.limit/offset must be >= 0")
    need_total = bool(pagination.get("need_total", False))

    query_text = str(payload.get("query", "") or "").strip().lower()

    # 默认路径：无 tokens/filters/sort → 按 created_at DESC 返回
    if (not tokens) and (not filters) and (not sort_rules):
        rows = api._pdf_info_plugin.query_all_by_created(limit=limit, offset=offset)
        records = [_map_to_frontend(api, r) for r in rows]
        total = len(records) if not bool(pagination.get("need_total", False)) else api._pdf_info_plugin.count_all()
        return {
            "records": records,
            "total": total,
            "page": {"limit": limit, "offset": offset},
            "meta": {"query": payload.get("query", ""), "tokens": tokens},
        }
    try:
        rows = api._pdf_info_plugin.search_with_filters(
            tokens,
            filters,
            search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
            sort_rules=sort_rules,
            limit=None,
            offset=None,
        )
    except Exception:
        rows = api._pdf_info_plugin.query_all()

    matches: List[Dict[str, Any]] = []
    for row in rows:
        record = _map_to_frontend(api, row)
        match_info = _calculate_match_info(api, record, row, tokens, query_text)
        if tokens and not match_info["matched"]:
            continue
        if filters and not _apply_search_filters(record, filters):
            continue
        record_copy = dict(record)
        record_copy["match_score"] = match_info["score"]
        record_copy["matched_fields"] = sorted(match_info["fields"])
        matches.append({"record": record_copy, "row": row, "score": match_info["score"]})

    if _needs_memory_sort(sort_rules):
        def _key(item):
            vals = []
            for rule in sort_rules:
                field = str(rule.get("field", "")).strip().lower()
                direction = str(rule.get("direction", "desc")).lower()
                val = _search_sort_value(item["record"], field if field != "match_score" else "match_score")
                vals.append((val, direction))
            return vals
        reverse = False  # handled per-field below
        matches.sort(key=lambda it: tuple([v[0] if v[1] == "asc" else _neg(v[0]) for v in _key(it)]), reverse=reverse)
    records = [it["record"] for it in matches]
    if not _needs_memory_sort(sort_rules):
        # 若使用 SQL 排序则只需要截取到分页；否则对内存排序同样适用
        pass
    # 分页截断
    paginated = records[offset: offset + limit] if limit is not None else records[offset:]
    total = len(records) if need_total else len(paginated)
    return {
        "records": paginated,
        "total": total,
        "page": {"limit": limit, "offset": offset},
        "meta": {"query": payload.get("query", ""), "tokens": tokens},
    }


def _neg(v):
    try:
        return -float(v)
    except Exception:
        return v

