"""PDF library API bridging database plugins and frontend requests."""

from __future__ import annotations

import logging
import os
import uuid as uuid_module
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING
from pathlib import Path
import importlib.util

import time

from ..database.config import get_db_path, get_connection_options
from ..database.connection import DatabaseConnectionManager
from ..database.executor import SQLExecutor
from ..database.exceptions import (
    DatabaseConstraintError,
    DatabaseError,
    DatabaseValidationError,
)
from ..database.plugin.event_bus import EventBus
from ..database.plugin.plugin_registry import TablePluginRegistry
from ..database.plugins.pdf_info_plugin import PDFInfoTablePlugin
from ..database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin
from ..database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin
from ..database.plugins.pdf_bookanchor_plugin import PDFBookanchorTablePlugin
from ..database.plugins.search_condition_plugin import SearchConditionTablePlugin
# Lazy imports for pdf_manager to avoid hard dependency during tests
# 可选的服务注册表（在某些分支/环境中尚未提供时，采用本地降级桩）
try:  # pragma: no cover - 动态兼容导入
    from .service_registry import (
        ServiceRegistry,
        SERVICE_PDF_HOME_SEARCH,
        SERVICE_PDF_HOME_ADD,
        SERVICE_PDF_VIEWER_BOOKMARK,
    )
except Exception:  # pragma: no cover - 兼容路径：提供最小桩以通过现有测试
    class ServiceRegistry:  # type: ignore
        def __init__(self) -> None:
            self._services = {}

        def has(self, key: str) -> bool:
            return key in self._services

        def get(self, key: str):
            return self._services[key]

        def register(self, key: str, service) -> None:
            self._services[key] = service

    SERVICE_PDF_HOME_SEARCH = "pdf-home.search"
    SERVICE_PDF_HOME_ADD = "pdf-home.add"
    SERVICE_PDF_VIEWER_BOOKMARK = "pdf-viewer.bookmark"

if TYPE_CHECKING:  # pragma: no cover - typing only
    from ..pdf_manager.standard_manager import StandardPDFManager


class PDFLibraryAPI:
    """Facade exposing database-backed PDF operations for frontend usage."""

    def __init__(
        self,
        db_path: Optional[str] = None,
        *,
        logger: Optional[logging.Logger] = None,
        event_bus: Optional[EventBus] = None,
        pdf_manager: Optional[StandardPDFManager] = None,
        service_registry: Optional[ServiceRegistry] = None,
    ) -> None:
        self._logger = logger or logging.getLogger("pdf.library.api")
        self._db_path = db_path or str(get_db_path())
        options = get_connection_options()

        self._connection_manager = DatabaseConnectionManager(self._db_path, **options)
        self._executor = SQLExecutor(self._connection_manager.get_connection())
        self._event_bus = event_bus or EventBus()

        self._registry = TablePluginRegistry.get_instance(self._executor, self._event_bus, self._logger)

        self._pdf_info_plugin = PDFInfoTablePlugin(self._executor, self._event_bus, self._logger)
        self._annotation_plugin = PDFAnnotationTablePlugin(self._executor, self._event_bus, self._logger)
        self._bookmark_plugin = PDFBookmarkTablePlugin(self._executor, self._event_bus, self._logger)
        self._bookanchor_plugin = PDFBookanchorTablePlugin(self._executor, self._event_bus, self._logger)
        self._search_condition_plugin = SearchConditionTablePlugin(self._executor, self._event_bus, self._logger)

        self._register_plugins()

        # API-level service registry (domain delegates)
        self._services = service_registry or ServiceRegistry()
        self._auto_register_default_services()

        self._pdf_manager = pdf_manager
        if self._pdf_manager is None:
            try:
                # Lazy import to avoid hard dependency during headless tests
                from ..pdf_manager.standard_manager import StandardPDFManager as _StdMgr  # type: ignore

                self._pdf_manager = _StdMgr()
            except Exception as exc:  # pragma: no cover - fallback path
                self._logger.warning("StandardPDFManager init failed: %s", exc)
                self._pdf_manager = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        """Close active connections and reset plugin registry state."""
        try:
            self._connection_manager.close_all()
        except DatabaseError as exc:  # pragma: no cover - defensive
            self._logger.error("Failed to close database connections: %s", exc)

    # CRUD ----------------------------------------------------------------

    def create_record(self, data: Dict[str, Any]) -> str:
        payload = self._normalize_input(data)
        return self._pdf_info_plugin.insert(payload)

    def update_record(self, uuid: str, updates: Dict[str, Any]) -> bool:
        normalized = self._normalize_update(uuid, updates)
        return self._pdf_info_plugin.update(uuid, normalized)

    def delete_record(self, uuid: str) -> bool:
        if self._pdf_manager is not None:
            try:
                # Best-effort removal; ignore failures to keep DB consistent
                self._pdf_manager.remove_file(uuid)
            except Exception as exc:  # pragma: no cover - filesystem errors
                self._logger.warning("remove_file failed for %s: %s", uuid, exc)
        return self._pdf_info_plugin.delete(uuid)

    def get_record(self, uuid: str) -> Optional[Dict[str, Any]]:
        row = self._pdf_info_plugin.query_by_id(uuid)
        if not row:
            return None
        return self._map_to_frontend(row)

    def get_record_detail(self, uuid: str) -> Optional[Dict[str, Any]]:
        record = self.get_record(uuid)
        if record is None:
            return None

        try:
            record["annotation_count"] = self._annotation_plugin.count_by_pdf(uuid)
        except DatabaseError:
            record["annotation_count"] = 0

        try:
            record["bookmark_count"] = self._bookmark_plugin.count_by_pdf(uuid)
        except DatabaseError:
            record["bookmark_count"] = 0

        return record

    def list_records(
        self,
        *,
        include_hidden: bool = True,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        rows = self._pdf_info_plugin.query_all(limit=limit, offset=offset)
        mapped: List[Dict[str, Any]] = []
        for row in rows:
            record = self._map_to_frontend(row)
            if include_hidden or record.get("is_visible", True):
                mapped.append(record)
        return mapped

    def search_records(
        self,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        # 优先分支：无关键词，且请求按 visited_at 降序排序 -> 走 SQL 层截断（性能更优）
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

            # 优化分支1：最近阅读（visited_at DESC）
            if (not tokens_peek) and only_visited_desc and no_filters:
                rows = self._pdf_info_plugin.query_all_by_visited(
                    limit=limit_peek if limit_peek is not None else None,
                    offset=offset_peek if offset_peek is not None else None,
                )
                records = [self._map_to_frontend(r) for r in rows]
                total = self._pdf_info_plugin.count_all() if need_total_peek else len(records)
                return {
                    "records": records,
                    "total": total,
                    "page": {"limit": limit_peek, "offset": offset_peek},
                    "meta": {"query": payload.get("query", ""), "tokens": []},
                }

            # 优化分支2：最近添加（created_at DESC）
            if (not tokens_peek) and only_created_desc and no_filters:
                rows = self._pdf_info_plugin.query_all_by_created(
                    limit=limit_peek if limit_peek is not None else None,
                    offset=offset_peek if offset_peek is not None else None,
                )
                records = [self._map_to_frontend(r) for r in rows]
                total = self._pdf_info_plugin.count_all() if need_total_peek else len(records)
                return {
                    "records": records,
                    "total": total,
                    "page": {"limit": limit_peek, "offset": offset_peek},
                    "meta": {"query": payload.get("query", ""), "tokens": []},
                }
        except Exception:
            # 兜底到通用路径（不影响原有行为）
            pass

        # Delegate to registered service if available
        if self._services and self._services.has(SERVICE_PDF_HOME_SEARCH):
            service = self._services.get(SERVICE_PDF_HOME_SEARCH)
            return service.search_records(payload, context=self)
        if payload is None:
            raise DatabaseValidationError("payload is required")
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
        # 在 SQLite 内部优先执行“搜索 + 筛选”以缩小候选集
        try:
            rows = self._pdf_info_plugin.search_with_filters(
                tokens,
                filters,
                search_fields=['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
                sort_rules=sort_rules,
                limit=None,
                offset=None,
            )
        except Exception:
            rows = self._pdf_info_plugin.query_all()
        matches = []
        for row in rows:
            record = self._map_to_frontend(row)
            match_info = self._calculate_match_info(record, row, tokens, query_text)
            if tokens and not match_info["matched"]:
                continue
            if filters and not self._apply_search_filters(record, filters):
                continue
            record_copy = dict(record)
            record_copy["match_score"] = match_info["score"]
            record_copy["matched_fields"] = sorted(match_info["fields"])
            matches.append({
                "record": record_copy,
                "row": row,
                "score": match_info["score"],
            })

        # 排序策略与服务层一致：仅当包含非SQL字段（如 match_score）时才在内存排序
        sql_orderable_fields = {
            'title', 'author', 'filename', 'modified_time', 'updated_at',
            'created_time', 'created_at', 'page_count', 'file_size', 'size',
            'rating', 'review_count', 'total_reading_time', 'last_accessed_at', 'due_date', 'star'
        }

        def needs_memory_sort(rules: List[Dict[str, Any]]) -> bool:  # type: ignore[name-defined]
            if not rules:
                return False
            for r in rules:
                f = str(r.get('field', '')).strip().lower()
                if f == 'match_score':
                    return True
                if f not in sql_orderable_fields:
                    return True
            return False

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
                    matches.sort(key=lambda item: self._search_sort_value(item, field), reverse=reverse)

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

    def list_bookmarks(
        self,
        pdf_uuid: str,
    ) -> Dict[str, Any]:
        # Delegate to registered service if available
        if self._services and self._services.has(SERVICE_PDF_VIEWER_BOOKMARK):
            service = self._services.get(SERVICE_PDF_VIEWER_BOOKMARK)
            return service.list_bookmarks(pdf_uuid, context=self)
        if not pdf_uuid:
            raise DatabaseValidationError("pdf_uuid is required")
        rows = self._bookmark_plugin.query_by_pdf(pdf_uuid)
        if not rows:
            return {"bookmarks": [], "root_ids": []}

        node_map: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            bookmark_id = row['bookmark_id']
            node_map[bookmark_id] = {
                "id": bookmark_id,
                "name": row.get('name', ''),
                "type": row.get('type', 'page'),
                "pageNumber": row.get('pageNumber', 1),
                "region": row.get('region'),
                "children": [],
                "parentId": row.get('parentId'),
                "order": row.get('order', 0),
                "createdAt": self._ms_to_iso(row.get('created_at')),
                "updatedAt": self._ms_to_iso(row.get('updated_at')),
            }

        root_ids: List[str] = []
        for row in rows:
            bookmark_id = row['bookmark_id']
            parent_id = row.get('parentId')
            node = node_map[bookmark_id]
            if parent_id and parent_id in node_map:
                node_map[parent_id]["children"].append(node)
            else:
                root_ids.append(bookmark_id)

        for node in node_map.values():
            node['children'].sort(key=lambda item: item['order'])

        root_ids.sort(key=lambda item: node_map[item]['order'])
        # 仅返回根节点列表，避免将所有节点平铺到顶层破坏层级结构
        bookmarks = [node_map[bid] for bid in root_ids if bid in node_map]
        return {"bookmarks": bookmarks, "root_ids": root_ids}

    def save_bookmarks(
        self,
        pdf_uuid: str,
        bookmarks: List[Dict[str, Any]],
        *,
        root_ids: Optional[List[str]] = None,
    ) -> int:
        # Delegate to registered service if available
        if self._services and self._services.has(SERVICE_PDF_VIEWER_BOOKMARK):
            service = self._services.get(SERVICE_PDF_VIEWER_BOOKMARK)
            return service.save_bookmarks(pdf_uuid, bookmarks, root_ids=root_ids, context=self)
        if not pdf_uuid:
            raise DatabaseValidationError("pdf_uuid is required")
        if bookmarks is None:
            raise DatabaseValidationError("bookmarks is required")
        if not isinstance(bookmarks, list):
            raise DatabaseValidationError("bookmarks must be a list")
        root_order = self._build_root_order(bookmarks, root_ids)

        rows: List[Dict[str, Any]] = []
        for bookmark in bookmarks:
            order = root_order.get(bookmark.get('id'))
            bookmark_rows, _ = self._flatten_bookmark_tree(
                bookmark, pdf_uuid, parent_id=None, order=order
            )
            rows.extend(bookmark_rows)

        self._bookmark_plugin.delete_by_pdf(pdf_uuid)
        for row in rows:
            self._bookmark_plugin.insert(row)
        return len(rows)

    def clear_bookmarks(self, pdf_uuid: str) -> int:
        if not pdf_uuid:
            raise DatabaseValidationError("pdf_uuid is required")
        return self._bookmark_plugin.delete_by_pdf(pdf_uuid)

    # Sync helpers --------------------------------------------------------

    def register_file_info(self, file_info: Dict[str, Any]) -> str:
        # Delegate to registered service if available
        if self._services and self._services.has(SERVICE_PDF_HOME_ADD):
            service = self._services.get(SERVICE_PDF_HOME_ADD)
            return service.register_file_info(file_info, context=self)
        payload = self._from_pdf_manager_info(file_info)
        try:
            return self._pdf_info_plugin.insert(payload)
        except DatabaseConstraintError:
            self._pdf_info_plugin.update(payload["uuid"], payload)
            return payload["uuid"]

    def add_pdf_from_file(self, filepath: str) -> Dict[str, Any]:
        # Delegate to registered service if available
        if self._services and self._services.has(SERVICE_PDF_HOME_ADD):
            service = self._services.get(SERVICE_PDF_HOME_ADD)
            return service.add_pdf_from_file(filepath, context=self)
        """
        从文件路径添加 PDF 到数据库

        Args:
            filepath: PDF 文件的绝对路径

        Returns:
            Dict[str, Any]: 包含新创建记录的信息
            {
                "success": bool,
                "uuid": str,  # 新记录的UUID
                "filename": str,
                "file_size": int,
                "error": str  # 如果失败
            }
        """
        try:
            if not filepath:
                return {
                    "success": False,
                    "error": "文件路径不能为空"
                }

            absolute_path = os.path.abspath(filepath)
            if not os.path.exists(absolute_path):
                return {
                    "success": False,
                    "error": f"文件不存在: {absolute_path}"
                }

            # Lazy import utilities to avoid hard dependency when unused
            from ..pdf_manager.utils import FileValidator  # type: ignore

            if not FileValidator.is_pdf_file(absolute_path):
                return {
                    "success": False,
                    "error": "仅支持添加 PDF 文件"
                }

            file_size = os.path.getsize(absolute_path)
            filename = os.path.basename(absolute_path)

            # 如果有 PDF 管理器，优先使用管理器添加文件
            if self._pdf_manager is not None:
                success, payload = self._pdf_manager.add_file(absolute_path)
                if not success:
                    error_message = ""
                    if isinstance(payload, dict):
                        error_message = payload.get("message") or payload.get("error") or ""
                    if not error_message:
                        error_message = "PDF文件添加失败"
                    return {
                        "success": False,
                        "error": error_message
                    }

                file_info = payload if isinstance(payload, dict) else {}

                # 同步到数据库
                try:
                    record_uuid = self.register_file_info(file_info)
                except Exception as exc:
                    self._logger.error("同步 PDF 信息到数据库失败: %s", exc, exc_info=True)
                    # 回滚 PDF 管理器中的文件
                    file_id = file_info.get("id")
                    if file_id:
                        try:
                            self._pdf_manager.remove_file(file_id)
                        except Exception as cleanup_exc:  # pragma: no cover - best effort cleanup
                            self._logger.warning("回滚 PDF 添加失败: %s", cleanup_exc)
                    return {
                        "success": False,
                        "error": "同步 PDF 信息到数据库失败"
                    }

                return {
                    "success": True,
                    "uuid": record_uuid,
                    "filename": file_info.get("filename", filename),
                    "file_size": file_info.get("file_size", file_size)
                }

            # 没有 PDF 管理器，直接添加到数据库
            from ..pdf_manager.pdf_metadata_extractor import PDFMetadataExtractor  # type: ignore

            metadata = PDFMetadataExtractor.extract_metadata(absolute_path)
            if "error" in metadata:
                return {
                    "success": False,
                    "error": metadata["error"]
                }

            record_uuid = uuid_module.uuid4().hex[:12]
            current_time_ms = int(time.time() * 1000)

            record_data = {
                "uuid": record_uuid,
                "title": metadata.get("title", filename),
                "author": metadata.get("author", ""),
                "page_count": metadata.get("page_count", 0),
                "file_size": file_size,
                "created_at": current_time_ms,
                "updated_at": current_time_ms,
                "visited_at": 0,
                "version": 1,
                "json_data": {
                    "filename": f"{record_uuid}.pdf",
                    "original_filename": filename,
                    "filepath": absolute_path,
                    "original_path": absolute_path,
                    "subject": metadata.get("subject", ""),
                    "keywords": metadata.get("keywords", ""),
                    "creator": metadata.get("creator", ""),
                    "producer": metadata.get("producer", ""),
                    "page_count": metadata.get("page_count", 0),
                    "tags": [],
                    "notes": "",
                    "rating": 0,
                    "is_visible": True,
                    "review_count": 0,
                    "total_reading_time": 0,
                    "due_date": 0,
                    "last_accessed_at": 0
                }
            }

            self.create_record(record_data)

            return {
                "success": True,
                "uuid": record_uuid,
                "filename": f"{record_uuid}.pdf",
                "file_size": file_size
            }

        except Exception as exc:
            self._logger.error("添加 PDF 文件失败: %s", exc, exc_info=True)
            return {
                "success": False,
                "error": f"添加 PDF 文件失败: {str(exc)}"
            }

    # ------------------------------------------------------------------
    # Service bootstrap
    # ------------------------------------------------------------------

    def _auto_register_default_services(self) -> None:
        """Register in-process default domain services if not provided.

        This keeps backward compatibility while enabling plugin-like
        customization by overriding the defaults via the registry.
        """
        # 独立 try/except，避免单个失败阻断其余服务注册
        if not self._services.has(SERVICE_PDF_HOME_SEARCH):
            try:
                svc = self._load_default_service(["pdf-home", "search", "service.py"], "DefaultSearchService")
                if svc:
                    self._services.register(SERVICE_PDF_HOME_SEARCH, svc)
            except Exception as exc:  # pragma: no cover
                self._logger.warning("auto-register search service failed: %s", exc)

        if not self._services.has(SERVICE_PDF_HOME_ADD):
            try:
                svc = self._load_default_service(["pdf-home", "add", "service.py"], "DefaultAddService")
                if svc:
                    self._services.register(SERVICE_PDF_HOME_ADD, svc)
            except Exception as exc:  # pragma: no cover
                self._logger.warning("auto-register add service failed: %s", exc)

        if not self._services.has(SERVICE_PDF_VIEWER_BOOKMARK):
            try:
                svc = self._load_default_service(["pdf-viewer", "bookmark", "service.py"], "DefaultBookmarkService")
                if svc:
                    self._services.register(SERVICE_PDF_VIEWER_BOOKMARK, svc)
            except Exception as exc:  # pragma: no cover
                self._logger.warning("auto-register bookmark service failed: %s", exc)

    def _load_default_service(self, relparts: List[str], class_name: str):
        base = Path(__file__).parent
        file_path = base.joinpath(*relparts)
        if not file_path.exists():
            return None
        module_name = "_api_" + "_" + "_".join([p.replace("-", "_") for p in relparts[:-1]])
        spec = importlib.util.spec_from_file_location(module_name, str(file_path))
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)  # type: ignore[attr-defined]
        svc_cls = getattr(module, class_name, None)
        return svc_cls() if svc_cls else None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _register_plugins(self) -> None:
        for plugin in (
            self._pdf_info_plugin,
            self._annotation_plugin,
            self._bookmark_plugin,
            self._bookanchor_plugin,
            self._search_condition_plugin,
        ):
            try:
                self._registry.register(plugin)
            except ValueError:
                # 已注册时跳过
                pass
        self._registry.enable_all()

    # -------------------- Anchor API --------------------
    def anchor_get(self, anchor_uuid: str) -> Optional[Dict[str, Any]]:
        row = self._bookanchor_plugin.query_by_id(anchor_uuid)
        return row

    def anchor_list(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        return self._bookanchor_plugin.query_by_pdf(pdf_uuid)

    def anchor_create(self, anchor: Dict[str, Any]) -> str:
        import secrets, time as _time
        data = dict(anchor or {})
        # 生成默认 uuid
        if not data.get('uuid'):
            suffix = secrets.token_hex(6)
            data['uuid'] = f"pdfanchor-{suffix}"
        now = int(_time.time() * 1000)
        data.setdefault('created_at', now)
        data.setdefault('updated_at', now)
        data.setdefault('visited_at', 0)
        data.setdefault('version', 1)
        # 包装 json_data/name 等
        name = data.get('name') or (data.get('json_data') or {}).get('name') or '未命名锚点'
        jd = data.get('json_data') or {}
        jd['name'] = name
        if 'is_active' in data:
            jd['is_active'] = bool(data['is_active'])
        data['json_data'] = jd
        return self._bookanchor_plugin.insert(data)

    def anchor_update(self, anchor_uuid: str, update: Dict[str, Any]) -> bool:
        # 支持更新 page_at/position/json_data.name/is_active/visited_at
        data: Dict[str, Any] = {}
        if 'page_at' in update:
            data['page_at'] = int(update['page_at'])
        if 'position' in update:
            # 允许传百分比或 0~1，统一处理
            pos = update['position']
            try:
                pos = float(pos)
            except Exception:
                pos = 0.0
            if pos > 1.0:
                pos = pos / 100.0
            data['position'] = pos
        jd = {}
        if 'name' in update:
            jd['name'] = str(update['name'])
        if 'is_active' in update:
            jd['is_active'] = bool(update['is_active'])
        if jd:
            data['json_data'] = jd
        if 'visited_at' in update:
            data['visited_at'] = int(update['visited_at'])
        return self._bookanchor_plugin.update(anchor_uuid, data)

    def anchor_delete(self, anchor_uuid: str) -> bool:
        return self._bookanchor_plugin.delete(anchor_uuid)

    @staticmethod
    def _ensure_ms(value: Optional[int]) -> int:
        if value is None:
            return 0
        if value == 0:
            return 0
        if value > 10 ** 12:
            return int(value)
        if value < 0:
            return 0
        return int(value * 1000)

    @staticmethod
    def _ensure_seconds(value: Optional[int]) -> int:
        if value is None:
            return 0
        if value >= 10 ** 12:
            return int(value // 1000)
        return int(value)

    def _calculate_match_info(
        self,
        record: Dict[str, Any],
        row: Dict[str, Any],
        tokens: List[str],
        query: str,
    ) -> Dict[str, Any]:
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
        field_sources = {
            "title": record.get("title", ""),
            "author": record.get("author", ""),
            "notes": record.get("notes", json_data.get("notes", "")),
            "subject": record.get("subject", json_data.get("subject", "")),
            "keywords": record.get("keywords", json_data.get("keywords", "")),
        }
        tags = record.get("tags", json_data.get("tags", [])) or []

        aggregate_parts = [value for value in field_sources.values() if isinstance(value, str)]
        aggregate_parts.extend(str(tag) for tag in tags if isinstance(tag, str))
        aggregate_text = " ".join(aggregate_parts).lower()
        if query and query not in aggregate_text:
            return {"matched": False, "score": 0, "fields": set()}

        matched_fields: set[str] = set()
        score = 0

        for token in tokens:
            token_matched = False
            for field_name, value in field_sources.items():
                if not isinstance(value, str):
                    continue
                if token in value.lower():
                    token_matched = True
                    matched_fields.add(field_name)
                    score += field_weights.get(field_name, 1)
            if any(isinstance(tag, str) and token in tag.lower() for tag in tags):
                token_matched = True
                matched_fields.add("tags")
                score += field_weights.get("tags", 2)
            if not token_matched:
                return {"matched": False, "score": 0, "fields": set()}

        return {"matched": True, "score": score, "fields": matched_fields}

    def _apply_search_filters(self, record: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        if not filters:
            return True
        filter_type = filters.get("type")
        if filter_type == "composite":
            operator = str(filters.get("operator", "AND")).upper()
            conditions = filters.get("conditions") or []
            results = [self._apply_search_filters(record, cond) for cond in conditions]
            if operator == "AND":
                return all(results)
            if operator == "OR":
                return any(results)
            if operator == "NOT":
                return not any(results)
            return all(results)
        if filter_type == "field":
            field = filters.get("field")
            operator = filters.get("operator")
            value = filters.get("value")
            if field == "rating" and operator == "gte":
                return record.get("rating", 0) >= value
            if field == "is_visible" and operator == "eq":
                return bool(record.get("is_visible", False)) == bool(value)
            if field == "tags" and operator == "has_any":
                target = {str(v).lower() for v in (value or [])}
                record_tags = {str(tag).lower() for tag in record.get("tags", [])}
                return bool(record_tags.intersection(target))
            if field == "total_reading_time" and operator == "gte":
                return record.get("total_reading_time", 0) >= value
            return True
        return True

    def _search_sort_value(self, item: Dict[str, Any], field: str) -> Any:
        field_lower = str(field).lower()
        record = item["record"]
        row = item["row"]
        if field_lower == "match_score":
            return item.get("score", 0)
        if field_lower in {"updated_at", "created_at"}:
            return row.get(field_lower, 0)
        value = record.get(field_lower)
        if value is None:
            value = record.get(field)
        if value is None:
            value = row.get(field_lower)
        if isinstance(value, str):
            return value.lower()
        if isinstance(value, (list, tuple)):
            return len(value)
        return value if value is not None else 0

    def _build_root_order(
        self,
        bookmarks: List[Dict[str, Any]],
        root_ids: Optional[List[str]],
    ) -> Dict[str, int]:
        order_map: Dict[str, int] = {}
        if root_ids:
            for idx, bookmark_id in enumerate(root_ids):
                if isinstance(bookmark_id, str):
                    order_map.setdefault(bookmark_id, idx)
        for idx, bookmark in enumerate(bookmarks):
            bookmark_id = bookmark.get('id') or bookmark.get('bookmark_id')
            if not isinstance(bookmark_id, str):
                continue
            explicit_order = bookmark.get('order')
            if isinstance(explicit_order, int) and explicit_order >= 0:
                order_map.setdefault(bookmark_id, explicit_order)
            else:
                order_map.setdefault(bookmark_id, idx)
        return order_map

    def _flatten_bookmark_tree(
        self,
        bookmark: Dict[str, Any],
        pdf_uuid: str,
        *,
        parent_id: Optional[str],
        order: Optional[int],
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        if not isinstance(bookmark, dict):
            raise DatabaseValidationError('bookmark must be an object')
        bookmark_id = bookmark.get('id') or bookmark.get('bookmark_id')
        if not isinstance(bookmark_id, str) or not bookmark_id:
            raise DatabaseValidationError('bookmark id is required')

        children = bookmark.get('children') or []
        rows: List[Dict[str, Any]] = []
        child_summaries: List[Dict[str, Any]] = []
        for idx, child in enumerate(children):
            child_rows, child_summary = self._flatten_bookmark_tree(
                child, pdf_uuid, parent_id=bookmark_id, order=idx
            )
            rows.extend(child_rows)
            child_summaries.append(child_summary)

        row = self._build_bookmark_row(
            bookmark, pdf_uuid, parent_id, order if isinstance(order, int) else 0, child_summaries
        )
        rows.insert(0, row)
        summary = {
            'bookmark_id': row['bookmark_id'],
            'name': row['json_data']['name'],
            'type': row['json_data']['type'],
            'pageNumber': row['json_data']['pageNumber'],
            'region': row['json_data']['region'],
            'children': child_summaries,
            'parentId': parent_id,
            'order': row['json_data']['order'],
        }
        return rows, summary

    def _build_bookmark_row(
        self,
        bookmark: Dict[str, Any],
        pdf_uuid: str,
        parent_id: Optional[str],
        order: int,
        child_summaries: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        bookmark_id = bookmark.get('id') or bookmark.get('bookmark_id')
        if not isinstance(bookmark_id, str) or not bookmark_id:
            raise DatabaseValidationError('bookmark id is required')
        name = bookmark.get('name')
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError('bookmark name is required')
        bookmark_type = bookmark.get('type', 'page')
        if bookmark_type not in {'page', 'region'}:
            raise DatabaseValidationError("bookmark type must be 'page' or 'region'")
        try:
            page_number = int(bookmark.get('pageNumber', 1))
        except (TypeError, ValueError):
            raise DatabaseValidationError('pageNumber must be an integer >= 1')
        if page_number < 1:
            raise DatabaseValidationError('pageNumber must be an integer >= 1')

        created_ms = self._iso_to_ms(bookmark.get('createdAt'))
        updated_ms = self._iso_to_ms(bookmark.get('updatedAt'))
        if created_ms == 0:
            created_ms = int(time.time() * 1000)
        if updated_ms == 0:
            updated_ms = created_ms

        json_data = {
            'name': name.strip(),
            'type': bookmark_type,
            'pageNumber': page_number,
            'region': self._normalize_region(bookmark.get('region'), bookmark_type),
            'children': child_summaries,
            'parentId': parent_id,
            'order': order if isinstance(order, int) and order >= 0 else 0,
        }

        return {
            'bookmark_id': bookmark_id,
            'pdf_uuid': pdf_uuid,
            'created_at': created_ms,
            'updated_at': updated_ms,
            'version': 1,
            'json_data': json_data,
        }

    @staticmethod
    def _normalize_region(region: Any, bookmark_type: str) -> Optional[Dict[str, Any]]:
        if bookmark_type != 'region':
            return None
        if not isinstance(region, dict):
            raise DatabaseValidationError('region bookmark requires region object')
        required_keys = ('scrollX', 'scrollY', 'zoom')
        normalized: Dict[str, Any] = {}
        for key in required_keys:
            value = region.get(key)
            if not isinstance(value, (int, float)):
                raise DatabaseValidationError('region requires numeric scrollX, scrollY, zoom')
            normalized[key] = float(value)
        if normalized['zoom'] <= 0:
            raise DatabaseValidationError('region.zoom must be greater than 0')
        return normalized

    @staticmethod
    def _iso_to_ms(value: Optional[str]) -> int:
        if not value:
            return 0
        try:
            iso_value = value.replace('Z', '+00:00')
            dt = datetime.fromisoformat(iso_value)
            return int(dt.timestamp() * 1000)
        except ValueError:
            return 0

    @staticmethod
    def _ms_to_iso(value: Optional[int]) -> str:
        if not value:
            return datetime.utcfromtimestamp(0).isoformat() + 'Z'
        try:
            seconds = value / 1000 if value >= 10 ** 12 else value
            return datetime.utcfromtimestamp(seconds).isoformat() + 'Z'
        except (OverflowError, OSError):
            return datetime.utcfromtimestamp(0).isoformat() + 'Z'

    @staticmethod
    def _parse_datetime_to_ms(value: Optional[str]) -> int:
        if not value:
            return 0
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            return int(parsed.timestamp() * 1000)
        except ValueError:
            return 0

    @staticmethod
    def _normalize_tags(tags: Any) -> List[str]:
        if tags is None:
            return []
        if isinstance(tags, list):
            return [str(tag) for tag in tags]
        if isinstance(tags, str):
            return [item.strip() for item in tags.split(",") if item.strip()]
        return [str(tag) for tag in list(tags)]

    def _normalize_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if "uuid" in data and "json_data" in data:
            payload = deepcopy(data)
        else:
            payload = self._from_frontend_record(data)

        payload.setdefault("created_at", int(time.time() * 1000))
        payload.setdefault("updated_at", payload["created_at"])
        payload.setdefault("visited_at", payload["json_data"].get("last_accessed_at", 0))
        payload.setdefault("version", 1)
        payload["json_data"]["tags"] = self._normalize_tags(payload["json_data"].get("tags", []))
        payload["json_data"].setdefault("filename", payload.get("title", ""))
        payload["json_data"].setdefault("filepath", payload["json_data"].get("filepath", ""))
        payload["json_data"].setdefault("is_visible", True)
        payload["json_data"].setdefault("review_count", 0)
        payload["json_data"].setdefault("total_reading_time", 0)
        payload["json_data"].setdefault("rating", 0)
        payload["json_data"].setdefault("due_date", 0)
        payload["json_data"]["last_accessed_at"] = self._ensure_ms(
            payload["json_data"].get("last_accessed_at", payload.get("visited_at", 0))
        )
        payload["created_at"] = self._ensure_ms(payload.get("created_at"))
        payload["updated_at"] = self._ensure_ms(payload.get("updated_at"))
        payload["visited_at"] = self._ensure_ms(payload.get("visited_at", 0))
        payload["json_data"]["due_date"] = self._ensure_ms(payload["json_data"].get("due_date", 0))
        return payload

    def _normalize_update(self, uuid: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if not updates:
            return {}

        if "json_data" in updates:
            payload = deepcopy(updates)
        else:
            payload: Dict[str, Any] = {}
            json_updates: Dict[str, Any] = {}

            for key, value in updates.items():
                if key in {"title", "author", "page_count", "file_size", "version"}:
                    payload[key] = value
                elif key == "created_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "updated_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "visited_at":
                    payload[key] = self._ensure_ms(value)
                elif key == "last_accessed_at":
                    ms_value = self._ensure_ms(value)
                    payload["visited_at"] = ms_value
                    json_updates["last_accessed_at"] = ms_value
                elif key == "filename":
                    json_updates["filename"] = value
                elif key == "file_path":
                    json_updates["filepath"] = value
                elif key == "tags":
                    json_updates["tags"] = self._normalize_tags(value)
                elif key == "rating":
                    json_updates["rating"] = value
                elif key == "is_visible":
                    json_updates["is_visible"] = bool(value)
                elif key == "total_reading_time":
                    json_updates["total_reading_time"] = int(value)
                elif key == "due_date":
                    json_updates["due_date"] = self._ensure_ms(value)
                elif key == "review_count":
                    json_updates["review_count"] = int(value)
                elif key == "notes":
                    json_updates["notes"] = value
                elif key == "subject":
                    json_updates["subject"] = value
                elif key == "keywords":
                    json_updates["keywords"] = value

            if json_updates:
                payload["json_data"] = json_updates

        if "json_data" in payload:
            json_data = payload["json_data"]
            if "tags" in json_data:
                json_data["tags"] = self._normalize_tags(json_data["tags"])
            if "last_accessed_at" in json_data:
                json_data["last_accessed_at"] = self._ensure_ms(json_data["last_accessed_at"])
            if "due_date" in json_data:
                json_data["due_date"] = self._ensure_ms(json_data["due_date"])

        for key in ("created_at", "updated_at", "visited_at"):
            if key in payload:
                payload[key] = self._ensure_ms(payload[key])
        return payload
    def _from_frontend_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        now_ms = int(time.time() * 1000)
        uuid = record.get("uuid") or record.get("id")
        if not uuid:
            raise DatabaseValidationError("uuid is required")

        created_at = record.get("created_at")
        updated_at = record.get("updated_at", created_at)
        last_accessed = record.get("last_accessed_at", 0)

        json_data = {
            "filename": record.get("filename", ""),
            "filepath": record.get("file_path", ""),
            "tags": self._normalize_tags(record.get("tags")),
            "rating": record.get("rating", 0),
            "is_visible": record.get("is_visible", True),
            "total_reading_time": record.get("total_reading_time", 0),
            "last_accessed_at": self._ensure_ms(last_accessed),
            "review_count": record.get("review_count", 0),
            "due_date": self._ensure_ms(record.get("due_date", 0)),
            "notes": record.get("notes", ""),
        }
        for extra_key in ("subject", "keywords", "thumbnail_path"):
            value = record.get(extra_key)
            if value is not None:
                json_data[extra_key] = value

        payload = {
            "uuid": uuid,
            "title": record.get("title") or record.get("filename", ""),
            "author": record.get("author", ""),
            "page_count": record.get("page_count", 0),
            "file_size": record.get("file_size", 0),
            "created_at": self._ensure_ms(created_at) if created_at is not None else now_ms,
            "updated_at": self._ensure_ms(updated_at) if updated_at is not None else now_ms,
            "visited_at": self._ensure_ms(last_accessed),
            "version": record.get("version", 1),
            "json_data": json_data,
        }
        return payload

    def _from_pdf_manager_info(self, file_info: Dict[str, Any]) -> Dict[str, Any]:
        uuid = file_info.get("id")
        if not uuid:
            raise DatabaseValidationError("file info missing id")

        created_at = self._parse_datetime_to_ms(file_info.get("created_time"))
        updated_at = self._parse_datetime_to_ms(file_info.get("modified_time")) or created_at
        last_accessed = file_info.get("last_accessed_at", 0)

        json_data = {
            "filename": file_info.get("filename", ""),
            "filepath": file_info.get("filepath", ""),
            "tags": self._normalize_tags(file_info.get("tags")),
            "rating": file_info.get("rating", 0),
            "is_visible": file_info.get("is_visible", True),
            "total_reading_time": file_info.get("total_reading_time", 0),
            "last_accessed_at": self._ensure_ms(last_accessed),
            "review_count": file_info.get("review_count", 0),
            "due_date": self._ensure_ms(file_info.get("due_date", 0)),
            "notes": file_info.get("notes", ""),
            "thumbnail_path": file_info.get("thumbnail_path"),
            "subject": file_info.get("subject", ""),
            "keywords": file_info.get("keywords", ""),
        }

        payload = {
            "uuid": uuid,
            "title": file_info.get("title") or file_info.get("filename", ""),
            "author": file_info.get("author", ""),
            "page_count": file_info.get("page_count", 0),
            "file_size": file_info.get("file_size", 0),
            "created_at": created_at or int(time.time() * 1000),
            "updated_at": updated_at or int(time.time() * 1000),
            "visited_at": self._ensure_ms(last_accessed),
            "version": 1,
            "json_data": json_data,
        }
        return payload

    def _map_to_frontend(self, row: Dict[str, Any]) -> Dict[str, Any]:
        json_data = deepcopy(row.get("json_data", {}))
        created_at = row.get("created_at", 0)
        last_accessed = json_data.get("last_accessed_at", row.get("visited_at", 0))
        due_date = json_data.get("due_date", 0)

        record = {
            "id": row["uuid"],
            "title": row.get("title", ""),
            "author": row.get("author", ""),
            "filename": json_data.get("filename", ""),
            "file_path": json_data.get("filepath", ""),
            "file_size": row.get("file_size", 0),
            "page_count": row.get("page_count", 0),
            "created_at": self._ensure_seconds(created_at),
            "updated_at": self._ensure_seconds(row.get("updated_at", created_at)),
            "last_accessed_at": self._ensure_seconds(last_accessed),
            "review_count": json_data.get("review_count", 0),
            "rating": json_data.get("rating", 0),
            "tags": self._normalize_tags(json_data.get("tags")),
            "is_visible": bool(json_data.get("is_visible", True)),
            "total_reading_time": json_data.get("total_reading_time", 0),
            "due_date": self._ensure_seconds(due_date),
            "notes": json_data.get("notes", ""),
            "subject": json_data.get("subject", ""),
            "keywords": json_data.get("keywords", ""),
        }
        return record




