# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, List, Tuple
import re


def _replace_identifiers(s: str) -> str:
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


def compile_weighted_expr(_plugin, expr: str) -> Tuple[str, List[Any]]:
    """
    将带函数/标识符的加权表达式编译为 SQL 片段与参数。
    保持与原有 read_ops._compile_weighted_expr 行为一致。
    """
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
                            a_sql, a_params = compile_weighted_expr(_plugin, a)
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

