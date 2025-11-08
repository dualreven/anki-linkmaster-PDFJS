from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# 拆分：将纯函数外提，保持行为不变
from .read_ops_core.parser import parse_row
from .read_ops_core.filter_builder import build_filter_sql
from .read_ops_core.weighted import compile_weighted_expr as _compile_weighted_expr


def query_by_id(plugin, primary_key: str) -> Optional[Dict[str, Any]]:
    sql = "SELECT * FROM pdf_info WHERE uuid = ?"
    rows = plugin._executor.execute_query(sql, (primary_key,))
    if not rows:
        return None
    return parse_row(rows[0])


def query_all(plugin, limit: Optional[int] = None, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM pdf_info ORDER BY title COLLATE NOCASE ASC"
    params: List[Any] = []
    if limit is not None:
        sql += " LIMIT ?"
        params.append(int(limit))
    if offset is not None:
        sql += " OFFSET ?"
        params.append(int(offset))
    rows = plugin._executor.execute_query(sql, tuple(params) if params else None)
    return [parse_row(row) for row in rows]


def query_all_by_visited(plugin, limit: Optional[int] = None, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM pdf_info ORDER BY visited_at DESC"
    params: List[Any] = []
    if limit is not None:
        sql += " LIMIT ?"
        params.append(int(limit))
    if offset is not None:
        sql += " OFFSET ?"
        params.append(int(offset))
    rows = plugin._executor.execute_query(sql, tuple(params) if params else None)
    return [parse_row(row) for row in rows]


def query_all_by_created(plugin, limit: Optional[int] = None, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM pdf_info ORDER BY created_at DESC"
    params: List[Any] = []
    if limit is not None:
        sql += " LIMIT ?"
        params.append(int(limit))
    if offset is not None:
        sql += " OFFSET ?"
        params.append(int(offset))
    rows = plugin._executor.execute_query(sql, tuple(params) if params else None)
    return [parse_row(row) for row in rows]


def count_all(plugin) -> int:
    rows = plugin._executor.execute_query("SELECT COUNT(*) AS c FROM pdf_info")
    if not rows:
        return 0
    row = rows[0]
    return int(row.get("c", list(row.values())[0] if isinstance(row, dict) and row else 0))


def search(plugin, keyword: str, fields: Optional[List[str]] = None, limit: Optional[int] = 50) -> List[Dict[str, Any]]:
    if not keyword:
        return []
    if fields is None:
        fields = ["title", "author", "filename", "notes"]
    conditions: List[str] = []
    params: List[Any] = []
    like_value = f"%{keyword}%"
    if "title" in fields:
        conditions.append("title LIKE ?")
        params.append(like_value)
    if "author" in fields:
        conditions.append("author LIKE ?")
        params.append(like_value)
    if "filename" in fields:
        conditions.append("json_extract(json_data, '$.filename') LIKE ?")
        params.append(like_value)
    if "notes" in fields:
        conditions.append("json_extract(json_data, '$.notes') LIKE ?")
        params.append(like_value)
    if not conditions:
        return []
    sql = f"""
    SELECT * FROM pdf_info
    WHERE ({' OR '.join(conditions)})
    ORDER BY updated_at DESC
    LIMIT ?
    """
    params.append(limit if limit is not None else 50)
    rows = plugin._executor.execute_query(sql, tuple(params))
    return [parse_row(row) for row in rows]


def search_records(
    plugin,
    keywords: List[str],
    search_fields: Optional[List[str]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not keywords:
        return query_all(plugin, limit=limit, offset=offset)
    keywords = [kw for kw in keywords if kw and kw.strip()]
    if not keywords:
        return query_all(plugin, limit=limit, offset=offset)
    if search_fields is None:
        search_fields = ["title", "author", "filename", "tags", "notes", "subject", "keywords"]
    keyword_conditions: List[str] = []
    params: List[Any] = []
    for keyword in keywords:
        escaped_keyword = keyword.replace("%", "\\%").replace("_", "\\_")
        like_value = f"%{escaped_keyword}%"
        field_conditions: List[str] = []
        if "title" in search_fields:
            field_conditions.append("title LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if "author" in search_fields:
            field_conditions.append("author LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if "filename" in search_fields:
            field_conditions.append("json_extract(json_data, '$.filename') LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if "tags" in search_fields:
            field_conditions.append("json_data LIKE ?")
            params.append(f'%"{escaped_keyword}"%')
        if "notes" in search_fields:
            field_conditions.append("json_extract(json_data, '$.notes') LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if "subject" in search_fields:
            field_conditions.append("json_extract(json_data, '$.subject') LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if "keywords" in search_fields:
            field_conditions.append("json_extract(json_data, '$.keywords') LIKE ? ESCAPE '\\'")
            params.append(like_value)
        if field_conditions:
            keyword_conditions.append(f"({' OR '.join(field_conditions)})")
    if not keyword_conditions:
        return []
    where_clause = " AND ".join(keyword_conditions)
    sql = f"""
    SELECT * FROM pdf_info
    WHERE {where_clause}
    ORDER BY updated_at DESC
    """
    if limit is not None:
        sql += " LIMIT ?"
        params.append(int(limit))
    if offset is not None:
        sql += " OFFSET ?"
        params.append(int(offset))
    rows = plugin._executor.execute_query(sql, tuple(params))
    return [parse_row(row) for row in rows]


def search_with_filters(
    plugin,
    keywords: List[str],
    filters: Optional[Dict[str, Any]] = None,
    search_fields: Optional[List[str]] = None,
    sort_rules: Optional[List[Dict[str, Any]]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
) -> List[Dict[str, Any]]:
    keywords = [kw for kw in (keywords or []) if kw and str(kw).strip()]
    if search_fields is None:
        search_fields = ["title", "author", "filename", "tags", "notes", "subject", "keywords"]
    where_clauses: List[str] = []
    params: List[Any] = []
    if keywords:
        keyword_conditions: List[str] = []
        for kw in keywords:
            escaped = str(kw).replace("%", "\\%").replace("_", "\\_")
            like_value = f"%{escaped}%"
            parts: List[str] = []
            if "title" in search_fields:
                parts.append("title LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if "author" in search_fields:
                parts.append("author LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if "filename" in search_fields:
                parts.append("json_extract(json_data, '$.filename') LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if "tags" in search_fields:
                parts.append("json_data LIKE ?")
                params.append(f'%"{escaped}"%')
            if "notes" in search_fields:
                parts.append("json_extract(json_data, '$.notes') LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if "subject" in search_fields:
                parts.append("json_extract(json_data, '$.subject') LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if "keywords" in search_fields:
                parts.append("json_extract(json_data, '$.keywords') LIKE ? ESCAPE '\\'")
                params.append(like_value)
            if parts:
                keyword_conditions.append(f"({' OR '.join(parts)})")
        if keyword_conditions:
            where_clauses.append(" AND ".join(keyword_conditions))

    # 过滤条件
    if filters:
        filter_sql, p = build_filter_sql(filters)
        where_clauses.append(filter_sql)
        params.extend(p)

    # 组合 WHERE
    where_sql = " AND ".join([f"({w})" for w in where_clauses]) if where_clauses else "1=1"
    order_sql = ""
    order_params: List[Any] = []
    if sort_rules:
        compiled: List[str] = []
        for r in sort_rules:
            field = str(r.get("field", "")).strip().lower()
            direction = str(r.get("direction", "desc")).lower()
            if field == "weighted":
                formula = str(r.get("formula", "")).strip()
                if formula:
                    expr_sql, expr_params = _compile_weighted_expr(plugin, formula)
                    compiled.append(f"{expr_sql} {'ASC' if direction == 'asc' else 'DESC'}")
                    order_params.extend(expr_params)
            else:
                mapping = {
                    "updated_at": "updated_at",
                    "created_at": "created_at",
                    "title": "title",
                    "author": "author",
                    "filename": "json_extract(json_data, '$.filename')",
                    "rating": "CAST(json_extract(json_data, '$.rating') AS INTEGER)",
                }
                col = mapping.get(field)
                if col:
                    compiled.append(f"{col} {'ASC' if direction == 'asc' else 'DESC'}")
        if compiled:
            order_sql = " ORDER BY " + ", ".join(compiled)

    sql = f"SELECT * FROM pdf_info WHERE {where_sql}{order_sql}"
    if limit is not None:
        sql += " LIMIT ?"
        order_params.append(int(limit))
    if offset is not None:
        sql += " OFFSET ?"
        order_params.append(int(offset))
    rows = plugin._executor.execute_query(sql, tuple(params + order_params) if (params or order_params) else None)
    return [parse_row(row) for row in rows]


# 公式编译与标识符替换（按现有实现保持行为）



def filter_by_tags(plugin, tags: List[str], match_mode: str = "any") -> List[Dict[str, Any]]:
    if not tags:
        return []
    if match_mode == "all":
        results: List[Dict[str, Any]] = []
        for row in query_all(plugin):
            row_tags = row.get("tags", [])
            if all(tag in row_tags for tag in tags):
                results.append(row)
        return results
    conditions = []
    params: List[Any] = []
    for tag in tags:
        conditions.append("json_data LIKE ?")
        params.append(f'%"{tag}"%')
    sql = f"""
    SELECT * FROM pdf_info
    WHERE ({' OR '.join(conditions)})
    ORDER BY updated_at DESC
    """
    rows = plugin._executor.execute_query(sql, tuple(params))
    return [parse_row(row) for row in rows]


def filter_by_rating(plugin, min_rating: int = 0, max_rating: int = 5) -> List[Dict[str, Any]]:
    min_rating = max(0, min_rating)
    max_rating = min(5, max_rating)
    if min_rating > max_rating:
        min_rating, max_rating = max_rating, min_rating
    sql = """
    SELECT * FROM pdf_info
    WHERE json_extract(json_data, '$.rating') BETWEEN ? AND ?
    ORDER BY json_extract(json_data, '$.rating') DESC
    """
    rows = plugin._executor.execute_query(sql, (min_rating, max_rating))
    return [parse_row(row) for row in rows]


def get_visible_pdfs(plugin) -> List[Dict[str, Any]]:
    sql = """
    SELECT * FROM pdf_info
    WHERE json_extract(json_data, '$.is_visible') = 1
        OR json_extract(json_data, '$.is_visible') = true
    ORDER BY updated_at DESC
    """
    rows = plugin._executor.execute_query(sql)
    return [parse_row(row) for row in rows]


def get_statistics(plugin) -> Dict[str, Any]:
    sql = """
    SELECT
        COUNT(*) as total_count,
        SUM(file_size) as total_size,
        AVG(page_count) as avg_pages,
        MAX(created_at) as latest_created,
        COUNT(CASE WHEN json_extract(json_data, '$.is_visible') = 1
            OR json_extract(json_data, '$.is_visible') = true THEN 1 END) as visible_count
    FROM pdf_info
    """
    result = plugin._executor.execute_query(sql)[0]
    return {
        "total_count": result["total_count"],
        "total_size": result["total_size"] or 0,
        "avg_pages": round(result["avg_pages"], 2) if result["avg_pages"] else 0,
        "latest_created": result["latest_created"] or 0,
        "visible_count": result["visible_count"],
    }

