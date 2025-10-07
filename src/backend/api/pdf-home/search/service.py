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

        # default sorting
        if not tokens and not sort_rules:
            sort_rules = [{"field": "updated_at", "direction": "desc"}]
        elif tokens and not sort_rules:
            sort_rules = [
                {"field": "match_score", "direction": "desc"},
                {"field": "updated_at", "direction": "desc"},
            ]

        for rule in reversed(sort_rules):
            field = rule.get("field", "")
            direction = str(rule.get("direction", "asc")).lower()
            reverse = direction == "desc"
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
