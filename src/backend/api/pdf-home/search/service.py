from __future__ import annotations

from typing import Any, Dict, List, Optional

# 兼容动态加载（文件路径导入）与常规包导入两种场景
try:
    from backend.api.utils.mapping import map_row_to_frontend  # type: ignore
except Exception:
    try:
        from src.backend.api.utils.mapping import map_row_to_frontend  # type: ignore
    except Exception:  # pragma: no cover - 兜底
        map_row_to_frontend = None  # 动态使用 context._map_to_frontend 代替


class SearchService:
    """Interface-like base for search service.

    Concrete implementations should provide `search_records`.
    """

    def search_records(self, payload: Dict[str, Any], *, context: Optional[Any] = None) -> Dict[str, Any]:
        """Execute search and return records/total/page/meta structure.

        Args:
            payload: search request payload.
            context: optional facade or container, useful for accessing
                     plugins or shared utilities.
        """
        raise NotImplementedError


class DefaultSearchService(SearchService):
    """Default in-process search implementation.

    It uses the context's plugins (PDFInfo) and mapping utils to produce a
    frontend-friendly response. Logic mirrors the previous facade behavior.
    """

    def search_records(self, payload: Dict[str, Any], *, context: Optional[Any] = None) -> Dict[str, Any]:
        if context is None:
            raise ValueError("context is required for DefaultSearchService")
        if payload is None:
            raise context._annotation_plugin.ValidationError("payload is required")  # type: ignore[attr-defined]

        # local import to reuse existing exception class on context
        try:
            DatabaseValidationError = context._annotation_plugin.__class__.__bases__[0]  # type: ignore
        except Exception:
            from ...database.exceptions import DatabaseValidationError  # fallback if introspection fails

        tokens = [str(token).strip().lower() for token in payload.get("tokens", []) if str(token).strip()]
        filters = payload.get("filters")
        sort_rules = payload.get("sort") or []
        pagination = payload.get("pagination") or {}
        try:
            limit = int(pagination.get("limit", 50))
        except (TypeError, ValueError):
            raise DatabaseValidationError("pagination.limit must be an integer")
        try:
            offset = int(pagination.get("offset", 0))
        except (TypeError, ValueError):
            raise DatabaseValidationError("pagination.offset must be an integer")
        if limit < 0:
            raise DatabaseValidationError("pagination.limit must be >= 0")
        if offset < 0:
            raise DatabaseValidationError("pagination.offset must be >= 0")
        need_total = bool(pagination.get("need_total", False))

        query_text = str(payload.get("query", "") or "").strip().lower()
        # 先在 SQLite 内部完成“搜索 + 筛选”的候选集选取
        try:
            rows = context._pdf_info_plugin.search_with_filters(  # type: ignore[attr-defined]
                tokens,
                filters,
                search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
                sort_rules=sort_rules,
                limit=None,
                offset=None,
            )
        except Exception:
            # 回退到全量查询（极端情况下保持可用性）
            rows = context._pdf_info_plugin.query_all()  # type: ignore[attr-defined]
        matches: List[Dict[str, Any]] = []
        for row in rows:
            if map_row_to_frontend is not None:
                record = map_row_to_frontend(row)
            else:
                record = context._map_to_frontend(row)  # type: ignore[attr-defined]
            match_info = context._calculate_match_info(record, row, tokens, query_text)  # type: ignore[attr-defined]
            if tokens and not match_info["matched"]:
                continue
            if filters and not context._apply_search_filters(record, filters):  # type: ignore[attr-defined]
                continue
            record_copy = dict(record)
            record_copy["match_score"] = match_info["score"]
            record_copy["matched_fields"] = sorted(match_info["fields"])
            matches.append({
                "record": record_copy,
                "row": row,
                "score": match_info["score"],
            })

        # 排序策略：
        # - 若未提供 sort 且无关键词：依赖 SQL 默认（title ASC），不在内存排序
        # - 若未提供 sort 且有关键词：按 match_score DESC, updated_at DESC 在内存排序
        # - 若提供了 sort：仅当包含非 SQL 可排序字段（如 match_score）时，才在内存排序；
        #                 否则完全信任 SQL 的 ORDER BY 顺序（不二次排序）。

        # SQL 可排序字段白名单（与插件 _build_order_by 一致）
        sql_orderable_fields = {
            'title', 'author', 'filename', 'modified_time', 'updated_at',
            'created_time', 'created_at', 'page_count', 'file_size', 'size',
            'rating', 'review_count', 'total_reading_time', 'last_accessed_at', 'due_date', 'star'
        }

        def needs_memory_sort(rules: List[Dict[str, Any]]) -> bool:
            if not rules:
                return False
            for r in rules:
                f = str(r.get('field', '')).strip().lower()
                if f == 'match_score':
                    return True
                if f not in sql_orderable_fields:
                    return True
            return False

        # 为空时的默认规则
        if tokens and not sort_rules:
            sort_rules = [
                {"field": "match_score", "direction": "desc"},
                {"field": "updated_at", "direction": "desc"},
            ]

        if needs_memory_sort(sort_rules):
            import ast
            def _safe_eval_weighted(item, formula: str) -> float:
                try:
                    row = item.get("row", {}) or {}
                    rec = item.get("record", {}) or {}
                    def _val(name: str):
                        name = str(name)
                        if name == 'size': name = 'file_size'
                        if name == 'modified_time': name = 'updated_at'
                        if name == 'created_time': name = 'created_at'
                        return row.get(name, rec.get(name))
                    tags = row.get('tags') or rec.get('tags') or []
                    def ifnull(x, y): return y if x is None else x
                    def clamp(x, lo, hi):
                        try: return max(min(float(x), float(hi)), float(lo))
                        except Exception: return x
                    def normalize(x, lo, hi):
                        try:
                            x, lo, hi = float(x), float(lo), float(hi)
                            return (x - lo) / (hi - lo) if hi > lo else 0.0
                        except Exception: return 0.0
                    def length(x):
                        try: return len(str(x) if x is not None else '')
                        except Exception: return 0
                    def tags_length():
                        try: return len(tags if isinstance(tags, list) else [])
                        except Exception: return 0
                    def tags_has(tag):
                        try: return 1 if tag in (tags or []) else 0
                        except Exception: return 0
                    def tags_has_any(*args):
                        try: return 1 if any(t in (tags or []) for t in args) else 0
                        except Exception: return 0
                    def tags_has_all(*args):
                        try: return 1 if all(t in (tags or []) for t in args) else 0
                        except Exception: return 0
                    allowed_funcs = {
                        'abs': abs, 'round': round, 'min': min, 'max': max,
                        'ifnull': ifnull, 'clamp': clamp, 'normalize': normalize,
                        'length': length, 'tags_length': tags_length,
                        'tags_has': tags_has, 'tags_has_any': tags_has_any, 'tags_has_all': tags_has_all,
                    }
                    allowed_names = {
                        'updated_at','created_at','page_count','file_size','size',
                        'rating','review_count','total_reading_time','last_accessed_at','due_date','star',
                        'title','author','filename','modified_time','created_time'
                    }
                    node = ast.parse(formula, mode='eval')
                    def _eval(n):
                        if isinstance(n, ast.Expression):
                            return _eval(n.body)
                        if isinstance(n, ast.Num): return n.n
                        if isinstance(n, ast.Constant): return n.value
                        if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
                            l = _eval(n.left); r = _eval(n.right)
                            try:
                                if isinstance(n.op, ast.Add): return (l or 0) + (r or 0)
                                if isinstance(n.op, ast.Sub): return (l or 0) - (r or 0)
                                if isinstance(n.op, ast.Mult): return (l or 0) * (r or 0)
                                if isinstance(n.op, ast.Div): return float(l or 0) / float(r or 1)
                            except Exception: return 0.0
                        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
                            v = _eval(n.operand); return +v if isinstance(n.op, ast.UAdd) else -v
                        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
                            fname = n.func.id
                            if fname not in allowed_funcs: raise ValueError('bad func')
                            args = [_eval(a) for a in n.args]
                            return allowed_funcs[fname](*args)
                        if isinstance(n, ast.Name):
                            ident = n.id
                            if ident not in allowed_names: raise ValueError('bad ident')
                            return _val(ident)
                        raise ValueError('bad expr')
                    v = _eval(node)
                    try: return float(v)
                    except Exception: return 0.0
                except Exception:
                    return 0.0

            for rule in reversed(sort_rules):
                field = rule.get("field", "")
                direction = str(rule.get("direction", "asc")).lower()
                reverse = direction == "desc"
                if field == 'weighted':
                    formula = str(rule.get('formula', '') or '')
                    matches.sort(key=lambda item: _safe_eval_weighted(item, formula), reverse=reverse)
                else:
                    matches.sort(key=lambda item: context._search_sort_value(item, field), reverse=reverse)  # type: ignore[attr-defined]
        
        total = len(matches)
        if limit == 0:
            paginated = matches[offset:]
        else:
            end = offset + limit if limit else None
            paginated = matches[offset:end]
        records = [item["record"] for item in paginated]
        page_info = {"limit": limit, "offset": offset}
        return {
            "records": records,
            "total": total if need_total else total,
            "page": page_info,
            "meta": {"query": payload.get("query", ""), "tokens": tokens},
        }
