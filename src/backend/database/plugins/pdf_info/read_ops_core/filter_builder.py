# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict, List, Tuple


def build_filter_sql(node: Dict[str, Any]) -> Tuple[str, List[Any]]:
    """
    将筛选树节点编译为 (sql, params)
    行为与 read_ops.search_with_filters 中的内嵌版本保持一致。
    """
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

            def sql_exists_in(vs: List[str]):
                placeholders = ",".join(["?"] * len(vs))
                return (f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value IN ({placeholders}))", vs)

            def sql_not_exists_in(vs: List[str]):
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
                p = []
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
                p = []
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
                p = []
                for v in distinct_vals:
                    exists_parts.append(f"EXISTS (SELECT 1 FROM {json_each} je WHERE je.value = ?)")
                    p.append(v)
                eq_sql = f"( {length_check} AND {' AND '.join(exists_parts)} )"
                return f"NOT {eq_sql}", p
        if field == "total_reading_time" and operator == "gte":
            return "CAST(json_extract(json_data, '$.total_reading_time') AS INTEGER) >= ?", [int(value)]
        return "1=1", []
    return "1=1", []

