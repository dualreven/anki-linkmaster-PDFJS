from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def parse_row(row: Dict[str, Any]) -> Dict[str, Any]:
    import json
    try:
        json_data = json.loads(row.get("json_data", "{}"))
    except json.JSONDecodeError:
        json_data = {}
    parsed = {
        "uuid": row["uuid"],
        "title": row["title"],
        "author": row["author"],
        "page_count": row["page_count"],
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "visited_at": row["visited_at"],
        "version": row["version"],
        "json_data": json_data,
    }
    parsed.update(json_data)
    return parsed


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

    def build_filter_sql(node: Dict[str, Any]) -> Tuple[str, List[Any]]:
        if not node or not isinstance(node, dict):
            return "1=1", []
        ntype = node.get("type")
        if ntype == "composite":
            op = str(node.get("operator", "AND")).upper()
            conds = node.get("conditions") or []
            parts: List[str] = []
            p: List[Any] = []
            for child in conds:
                sql_part, sql_params = build_filter_sql(child)
                parts.append(f"({sql_part})")
                p.extend(sql_params)
            if not parts:
                return "1=1", []
            if op == "NOT":
                return f"NOT ({parts[0]})", p
            joiner = " AND " if op == "AND" else " OR "
            return joiner.join(parts), p
        if ntype == "field":
            field = node.get("field")
            operator = node.get("operator")
            value = node.get("value")
            if field == "rating" and operator == "gte":
                return "CAST(json_extract(json_data, '$.rating') AS INTEGER) >= ?", [int(value)]
            if field == "is_visible" and operator == "eq":
                if bool(value):
                    return "(json_extract(json_data, '$.is_visible') = 1 OR json_extract(json_data, '$.is_visible') = true)", []
                else:
                    return "(json_extract(json_data, '$.is_visible') = 0 OR json_extract(json_data, '$.is_visible') = false OR json_extract(json_data, '$.is_visible') IS NULL)", []
            if field == "tags":
                vals = value if isinstance(value, list) else [value]
                vals = [str(v) for v in vals if str(v)]
                if not vals and operator != "eq":
                    return "1=1", []
                json_each = "json_each(json_extract(json_data, '$.tags'))"
                def sql_exists_in(vs):
                    placeholders = ",".join(["?"] * len(vs))
                    return (f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value IN ({placeholders}))", vs)
                def sql_not_exists_in(vs):
                    placeholders = ",".join(["?"] * len(vs))
                    return (f"NOT EXISTS (SELECT 1 FROM {json_each} je WHERE je.value IN ({placeholders}))", vs)
                if operator in ("contains", "has_tag", "has_any"):
                    return sql_exists_in(vals)
                if operator in ("not_contains", "not_has_tag", "not_has_any"):
                    return sql_not_exists_in(vals)
                if operator == "has_all":
                    parts = []
                    p: List[Any] = []
                    for v in vals:
                        parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                        p.append(v)
                    return " AND ".join(parts), p
                if operator == "not_has_all":
                    parts = []
                    p: List[Any] = []
                    for v in vals:
                        parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                        p.append(v)
                    return f"NOT ( {' AND '.join(parts)} )", p
                if operator == "eq":
                    if not vals:
                        return "json_array_length(json_extract(json_data, '$.tags')) = 0", []
                    distinct_vals = list(dict.fromkeys(vals))
                    length_check = f"json_array_length(json_extract(json_data, '$.tags')) = {len(distinct_vals)}"
                    exists_parts = []
                    p: List[Any] = []
                    for v in distinct_vals:
                        exists_parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                        p.append(v)
                    return f"( {length_check} AND {' AND '.join(exists_parts)} )", p
                if operator == "ne":
                    if not vals:
                        return "json_array_length(json_extract(json_data, '$.tags')) <> 0", []
                    distinct_vals = list(dict.fromkeys(vals))
                    length_check = f"json_array_length(json_extract(json_data, '$.tags')) = {len(distinct_vals)}"
                    exists_parts = []
                    p: List[Any] = []
                    for v in distinct_vals:
                        exists_parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                        p.append(v)
                    eq_sql = f"( {length_check} AND {' AND '.join(exists_parts)} )"
                    return f"NOT {eq_sql}", p
            if field == "total_reading_time" and operator == "gte":
                return "CAST(json_extract(json_data, '$.total_reading_time') AS INTEGER) >= ?", [int(value)]
            return "1=1", []
        return "1=1", []

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
def _compile_weighted_expr(plugin, expr: str) -> Tuple[str, List[Any]]:
    def is_ident(ch: str) -> bool:
        return ch.isalnum() or ch == "_"
    def split_args(s: str) -> List[str]:
        args: List[str] = []
        depth = 0
        cur = ""
        for ch in s:
            if ch == "," and depth == 0:
                args.append(cur.strip())
                cur = ""
            else:
                cur += ch
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
        if cur.strip():
            args.append(cur.strip())
        return args
    def extract_str(token: str) -> str:
        t = token.strip()
        if len(t) >= 2 and ((t[0] == t[-1] == "'") or (t[0] == t[-1] == '"')):
            return t[1:-1]
        return t
    params: List[Any] = []
    def compile_func(fname: str, args_raw: List[str], args_compiled: List[str]) -> Tuple[str, List[Any]]:
        f = fname.lower()
        if f == "clamp" and len(args_compiled) == 3:
            return f"CASE WHEN {args_compiled[0]} < {args_compiled[1]} THEN {args_compiled[1]} WHEN {args_compiled[0]} > {args_compiled[2]} THEN {args_compiled[2]} ELSE {args_compiled[0]} END", []
        if f == "normalize" and len(args_compiled) == 3:
            return f"CASE WHEN {args_compiled[2]} - {args_compiled[1]} = 0 THEN 0 ELSE ({args_compiled[0]} - {args_compiled[1]}) / ({args_compiled[2]} - {args_compiled[1]}) END", []
        if f == "tags_length" and len(args_raw) == 0:
            return "json_array_length(json_extract(json_data, '$.tags'))", []
        if f == "tags_has" and len(args_raw) == 1:
            val = extract_str(args_raw[0])
            return "CASE WHEN EXISTS (SELECT 1 FROM json_each(json_extract(json_data, '$.tags')) je WHERE je.value = ?) THEN 1 ELSE 0 END", [val]
        if f == "tags_has_any" and len(args_raw) >= 1:
            tags = [extract_str(a) for a in args_raw]
            placeholders = ",".join(["?"] * len(tags))
            sql = (
                "CASE WHEN EXISTS (SELECT 1 FROM json_each(json_extract(json_data, '$.tags')) je "
                f"WHERE je.value IN ({placeholders})) THEN 1 ELSE 0 END"
            )
            return sql, tags
        if f == "tags_has_all" and len(args_raw) >= 1:
            tags = [extract_str(a) for a in args_raw]
            exists_parts = [
                "EXISTS (SELECT 1 FROM json_each(json_extract(json_data, '$.tags')) je WHERE je.value = ?)"
                for _ in tags
            ]
            sql = f"CASE WHEN {' AND '.join(exists_parts)} THEN 1 ELSE 0 END"
            return sql, tags
        raise ValueError(f"unsupported function or arity: {fname}")
    allowed_funcs = {"abs", "round", "min", "max", "ifnull", "length", "clamp", "normalize", "tags_length", "tags_has", "tags_has_any", "tags_has_all"}
    while True:
        stack: List[int] = []
        replaced = False
        for idx, ch in enumerate(expr):
            if ch == "(":
                stack.append(idx)
            elif ch == ")" and stack:
                l = stack.pop()
                j = l - 1
                while j >= 0 and expr[j].isspace():
                    j -= 1
                end = j + 1
                while j >= 0 and is_ident(expr[j]):
                    j -= 1
                start = j + 1
                fname = expr[start:end]
                if fname and all(is_ident(c) for c in fname) and fname.lower() in allowed_funcs:
                    inside = expr[l + 1 : idx]
                    raw_args = split_args(inside)
                    args_compiled: List[str] = []
                    for a in raw_args:
                        if "(" in a:
                            a_sql, a_params = _compile_weighted_expr(plugin, a)
                        else:
                            a_sql = _replace_identifiers(a)
                            a_params = []
                        args_compiled.append(a_sql)
                        params.extend(a_params)
                    func_sql, func_params = compile_func(fname, raw_args, args_compiled)
                    params.extend(func_params)
                    expr = expr[:start] + f"({func_sql})" + expr[idx + 1 :]
                    replaced = True
                    break
        if not replaced:
            break
    expr = _replace_identifiers(expr)
    return expr, params


def _replace_identifiers(s: str) -> str:
    import re
    mapping = {
        "updated_at": "updated_at",
        "modified_time": "updated_at",
        "created_at": "created_at",
        "created_time": "created_at",
        "page_count": "page_count",
        "file_size": "file_size",
        "size": "file_size",
        "rating": "CAST(json_extract(json_data, '$.rating') AS INTEGER)",
        "review_count": "CAST(json_extract(json_data, '$.review_count') AS INTEGER)",
        "total_reading_time": "CAST(json_extract(json_data, '$.total_reading_time') AS INTEGER)",
        "last_accessed_at": "CAST(json_extract(json_data, '$.last_accessed_at') AS INTEGER)",
        "due_date": "CAST(json_extract(json_data, '$.due_date') AS INTEGER)",
        "star": "CAST(json_extract(json_data, '$.star') AS INTEGER)",
        "title": "title",
        "author": "author",
        "filename": "json_extract(json_data, '$.filename')",
    }
    s_wo_strings = re.sub(r"'[^']*'", "", s)
    if re.search(r"(?<![A-Za-z0-9_])tags(?![A-Za-z0-9_])", s_wo_strings):
        raise ValueError("不允许直接使用 'tags'，请使用 tags_length/tags_has/tags_has_any/tags_has_all")
    def sub_word(word: str, repl: str, text: str) -> str:
        return re.sub(rf"(?<![A-Za-z0-9_]){word}(?![A-Za-z0-9_])", repl, text)
    out = s
    for k, v in mapping.items():
        out = sub_word(k, v, out)
    return out


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

