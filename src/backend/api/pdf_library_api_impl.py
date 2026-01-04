"""PDF library API bridging database plugins and frontend requests.

精简实现：
- 数据访问统一委托给数据库插件（pdf_info / pdf_annotation / pdf_bookmark / pdf_bookanchor）。
- 领域能力通过可选的 ServiceRegistry 注入；未注入时回退到本地模块实现（pdf_library/*.py、pdf-viewer/*/service.py）。
- 所有对外返回遵循前端既有字段约束；严格输入校验，禁止“兜底回退”。

目标：将单文件体量控制在 500 行以内，便于长期维护与继续拆分。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING
from datetime import datetime
import logging
import time

from ..database.config import get_db_path, get_connection_options
from ..database.connection import DatabaseConnectionManager
from ..database.executor import SQLExecutor
from ..database.exceptions import DatabaseValidationError, DatabaseConstraintError
from ..database.plugin.event_bus import EventBus
from ..database.plugin.plugin_registry import TablePluginRegistry
from ..database.plugins.pdf_info_plugin import PDFInfoTablePlugin
from ..database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin
from ..database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin
from ..database.plugins.pdf_outline_plugin import PDFOutlineTablePlugin
from ..database.plugins.pdf_bookanchor_plugin import PDFBookanchorTablePlugin
from ..database.plugins.search_condition_plugin import SearchConditionTablePlugin
from ..database.plugins.pdf_annotation_tags_plugin import PDFAnnotationTagsTablePlugin
from ..database.plugins.pdf_annotation_relation_plugin import PDFAnnotationRelationTablePlugin

# Service registry（可选依赖）
try:  # pragma: no cover
    from .service_registry import (
        ServiceRegistry,
        SERVICE_PDF_HOME_SEARCH,
        SERVICE_PDF_HOME_ADD,
        SERVICE_PDF_VIEWER_BOOKMARK,
    )
except Exception:  # pragma: no cover
    class ServiceRegistry:  # type: ignore
        def __init__(self) -> None:
            self._services: Dict[str, Any] = {}
        def register(self, name: str, service: Any) -> None: self._services[name] = service
        def get(self, name: str) -> Optional[Any]: return self._services.get(name)
        def has(self, name: str) -> bool: return name in self._services
    SERVICE_PDF_HOME_SEARCH = "pdf-home.search"
    SERVICE_PDF_HOME_ADD = "pdf-home.add"
    SERVICE_PDF_VIEWER_BOOKMARK = "pdf-viewer.bookmark"

if TYPE_CHECKING:  # pragma: no cover
    from ..pdf_manager.standard_manager import StandardPDFManager


def _iso_to_ms(value: Optional[str]) -> int:
    if not value:
        return 0
    try:
        v = value.replace("Z", "+00:00")
        return int(datetime.fromisoformat(v).timestamp() * 1000)
    except Exception:
        return 0


def _ms_to_iso(value: Optional[int]) -> str:
    if not value:
        return datetime.utcfromtimestamp(0).isoformat() + "Z"
    try:
        sec = value / 1000 if value >= 10 ** 12 else value
        return datetime.utcfromtimestamp(sec).isoformat() + "Z"
    except Exception:
        return datetime.utcfromtimestamp(0).isoformat() + "Z"


class PDFLibraryAPI:
    """面向前端的 PDF 库接口门面。"""

    def __init__(
        self,
        db_path: Optional[str] = None,
        *,
        logger: Optional[logging.Logger] = None,
        event_bus: Optional[EventBus] = None,
        pdf_manager: Optional["StandardPDFManager"] = None,
        service_registry: Optional[ServiceRegistry] = None,
    ) -> None:
        self._logger = logger or logging.getLogger("pdf.library.api")
        self._db_path = db_path or str(get_db_path())
        options = get_connection_options()

        # 连接与执行器
        self._connection_manager = DatabaseConnectionManager(self._db_path, **options)
        self._executor = SQLExecutor(self._connection_manager.get_connection())
        self._event_bus = event_bus or EventBus()

        # 注册表（单例基于本连接）
        try:
            TablePluginRegistry.reset_instance()
        except Exception:
            pass
        self._registry = TablePluginRegistry.get_instance(self._executor, self._event_bus, self._logger)

        # 插件实例
        self._pdf_info_plugin = PDFInfoTablePlugin(self._executor, self._event_bus, self._logger)
        self._annotation_plugin = PDFAnnotationTablePlugin(self._executor, self._event_bus, self._logger)
        self._annotation_tags_plugin = PDFAnnotationTagsTablePlugin(self._executor, self._event_bus, self._logger)
        self._annotation_relation_plugin = PDFAnnotationRelationTablePlugin(
            self._executor, self._event_bus, self._logger
        )
        self._bookmark_plugin = PDFBookmarkTablePlugin(self._executor, self._event_bus, self._logger)
        self._outline_plugin = PDFOutlineTablePlugin(self._executor, self._event_bus, self._logger)
        self._bookanchor_plugin = PDFBookanchorTablePlugin(self._executor, self._event_bus, self._logger)
        self._search_condition_plugin = SearchConditionTablePlugin(self._executor, self._event_bus, self._logger)

        # 注册并启用
        for p in (
            self._pdf_info_plugin,
            self._annotation_plugin,
            self._annotation_tags_plugin,
            self._annotation_relation_plugin,
            self._bookmark_plugin,
            self._bookanchor_plugin,
            self._search_condition_plugin,
        ):
            self._registry.register(p)
        self._registry.enable_all()

        # 服务注册表与注入项
        self._services = service_registry or ServiceRegistry()
        self._pdf_manager = pdf_manager

    # ---------------------------- 生命周期 ----------------------------
    def shutdown(self) -> None:
        try:
            self._registry.disable_all()
        except Exception:
            pass
        try:
            self._connection_manager.close_all()
        except Exception:
            pass

    # ---------------------------- 记录 CRUD ----------------------------
    def create_record(self, data: Dict[str, Any]) -> str:
        from .pdf_library.utils import normalize_input  # lazy import
        payload = normalize_input(self, data)
        validated = self._pdf_info_plugin.validate_data(payload)
        return self._pdf_info_plugin.insert(validated)

    def update_record(self, uuid: str, updates: Dict[str, Any]) -> bool:
        from .pdf_library.utils import normalize_update
        if not uuid:
            raise DatabaseValidationError("uuid is required")
        payload = normalize_update(self, uuid, updates or {})
        return self._pdf_info_plugin.update(uuid, payload)

    def create_or_update_record(self, uuid: str, data: Dict[str, Any]) -> str:
        """
        兼容入口：按 uuid 幂等写入记录。

        - 若记录已存在：执行 update（部分字段更新）
        - 若记录不存在：执行 create（uuid 作为主键）
        """
        if not uuid:
            raise DatabaseValidationError("uuid is required")
        if self._pdf_info_plugin.query_by_id(uuid):
            self.update_record(uuid, data or {})
            return uuid
        payload = dict(data or {})
        payload["uuid"] = uuid
        return self.create_record(payload)

    def delete_record(self, uuid: str) -> bool:
        if not uuid:
            raise DatabaseValidationError("uuid is required")
        return self._pdf_info_plugin.delete(uuid)

    def get_record(self, uuid: str) -> Optional[Dict[str, Any]]:
        from .pdf_library.utils import map_to_frontend
        row = self._pdf_info_plugin.query_by_id(uuid)
        return map_to_frontend(self, row) if row else None

    def list_records(
        self, *, include_hidden: bool = True, limit: Optional[int] = None, offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        from .pdf_library.utils import map_to_frontend
        rows = self._pdf_info_plugin.query_all(limit=limit, offset=offset)
        records = [map_to_frontend(self, r) for r in rows]
        if not include_hidden:
            records = [rec for rec in records if bool(rec.get("is_visible", True))]
        return records

    def get_record_detail(self, uuid: str) -> Optional[Dict[str, Any]]:
        rec = self.get_record(uuid)
        if not rec:
            return None
        ann_count = self._annotation_plugin.count_by_pdf(uuid)
        bm_count = self._bookmark_plugin.count_by_pdf(uuid)
        rec = {**rec, "annotation_count": ann_count, "bookmark_count": bm_count}
        return rec

    # ---------------------------- 搜索 / 添加 ----------------------------
    def search_records(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self._services.has(SERVICE_PDF_HOME_SEARCH):
            svc = self._services.get(SERVICE_PDF_HOME_SEARCH)
            return svc.search_records(payload, context=self)  # type: ignore[attr-defined]
        from .pdf_library.search import search_records
        return search_records(self, payload)

    def register_file_info(self, file_info: Dict[str, Any]) -> str:
        if self._services.has(SERVICE_PDF_HOME_ADD):
            svc = self._services.get(SERVICE_PDF_HOME_ADD)
            return svc.register_file_info(file_info, context=self)  # type: ignore[attr-defined]
        from .pdf_library.utils import from_pdf_manager_info
        payload = from_pdf_manager_info(self, file_info)
        # idempotent: 若已存在则执行更新而非插入
        uuid = payload.get("uuid")
        if uuid and self._pdf_info_plugin.query_by_id(uuid):
            self._pdf_info_plugin.update(uuid, payload)
            return uuid
        try:
            return self.create_record(payload)
        except DatabaseConstraintError:
            # 并发或重复注册导致的主键冲突：按幂等处理为更新
            if uuid:
                self._pdf_info_plugin.update(uuid, payload)
                return uuid
            raise

    def add_pdf_from_file(self, filepath: str) -> Dict[str, Any]:
        if self._services.has(SERVICE_PDF_HOME_ADD):
            svc = self._services.get(SERVICE_PDF_HOME_ADD)
            return svc.add_pdf_from_file(filepath, context=self)  # type: ignore[attr-defined]
        from .pdf_library.add import add_pdf_from_file
        return add_pdf_from_file(self, filepath)

    # ---------------------------- 书签 ----------------------------
    def list_bookmarks(self, pdf_uuid: str) -> Dict[str, Any]:
        # 优先服务
        if self._services.has(SERVICE_PDF_VIEWER_BOOKMARK):
            svc = self._services.get(SERVICE_PDF_VIEWER_BOOKMARK)
            return svc.list_bookmarks(pdf_uuid, context=self)  # type: ignore[attr-defined]
        # 本地实现：DB->API 映射（对外仅输出 pageAt）
        rows = self._bookmark_plugin.query_by_pdf(pdf_uuid)
        if not rows:
            return {"bookmarks": [], "root_ids": []}
        nodes: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            bid = row["bookmark_id"]
            jd = row.get("json_data", {}) or {}
            # 兼容两种 parse_row 形态：字段可能被插件提升到顶层
            name = row.get("name", None)
            if name is None:
                name = jd.get("name", "")
            page_at = row.get("pageAt", None)
            if page_at is None:
                page_at = jd.get("pageAt", 1)
            position = row.get("position", None)
            if position is None:
                position = jd.get("position")
            parent_id = row.get("parentId", None)
            if parent_id is None:
                parent_id = jd.get("parentId")
            order = row.get("order", None)
            if order is None:
                order = jd.get("order", 0) or 0
            region_val = row.get("region", None)
            if region_val is None:
                region_val = jd.get("region")
            node = {
                "id": bid,
                "name": name or "",
                "type": "page",
                # 对外契约：统一提供 pageAt
                "pageAt": page_at if isinstance(page_at, int) and page_at >= 1 else 1,
                "region": region_val,
                "position": position,
                "children": [],
                "parentId": parent_id,
                "order": order,
                "createdAt": _ms_to_iso(row.get("created_at")),
                "updatedAt": _ms_to_iso(row.get("updated_at")),
            }
            nodes[bid] = node
        root_ids: List[str] = []
        for row in rows:
            bid = row["bookmark_id"]
            parent = row.get("parentId")
            if parent is None:
                parent = (row.get("json_data") or {}).get("parentId")
            if parent and parent in nodes:
                nodes[parent]["children"].append(nodes[bid])
            else:
                root_ids.append(bid)
        for n in nodes.values():
            n["children"].sort(key=lambda x: x["order"])
        root_ids.sort(key=lambda i: nodes[i]["order"])
        return {"bookmarks": list(nodes.values()), "root_ids": root_ids}

    def save_bookmarks(
        self, pdf_uuid: str, bookmarks: List[Dict[str, Any]], *, root_ids: Optional[List[str]] = None
    ) -> int:
        # 优先服务
        if self._services.has(SERVICE_PDF_VIEWER_BOOKMARK):
            svc = self._services.get(SERVICE_PDF_VIEWER_BOOKMARK)
            return svc.save_bookmarks(pdf_uuid, bookmarks, root_ids=root_ids, context=self)  # type: ignore[attr-defined]
        # 本地实现（严格校验）：仅接受 pageNumber/position（0~100）与树结构
        if not isinstance(bookmarks, list):
            raise DatabaseValidationError("bookmarks must be a list")
        order_map: Dict[str, int] = {}
        if root_ids:
            for idx, rid in enumerate(root_ids):
                if isinstance(rid, str):
                    order_map.setdefault(rid, idx)
        rows: List[Dict[str, Any]] = []

        def _int_ge1(name: str, v: Any) -> int:
            try:
                iv = int(v)
            except Exception:
                raise DatabaseValidationError(f"{name} must be an integer >= 1")
            if iv < 1:
                raise DatabaseValidationError(f"{name} must be an integer >= 1")
            return iv

        def _norm_pos(v: Any) -> Optional[int]:
            if v is None:
                return None
            try:
                fv = float(v)
            except Exception:
                raise DatabaseValidationError("position must be a number between 0 and 100")
            if fv < 0 or fv > 100:
                raise DatabaseValidationError("position must be between 0 and 100")
            return int(round(fv))

        def _flatten(node: Dict[str, Any], parent_id: Optional[str], order: int) -> Dict[str, Any]:
            bid = node.get("id") or node.get("bookmark_id")
            name = node.get("name")
            if not isinstance(bid, str) or not bid:
                raise DatabaseValidationError("bookmark id is required")
            if not isinstance(name, str) or not name.strip():
                raise DatabaseValidationError("bookmark name is required")
            # 接受 pageAt；兼容旧字段 pageNumber → pageAt
            page_at_value = node.get("pageAt") or node.get("pageNumber")
            page_at = _int_ge1("pageAt", page_at_value)
            pos = _norm_pos(node.get("position"))
            created_ms = _iso_to_ms(node.get("createdAt")) or int(time.time() * 1000)
            updated_ms = _iso_to_ms(node.get("updatedAt")) or created_ms
            jd = {
                "name": name.strip(),
                "pageAt": page_at,
                "position": pos,
                "children": [],  # 回填
                "parentId": parent_id,
                "order": order if order >= 0 else 0,
            }
            # 兼容区域书签：透传 region（若提供）
            if "region" in node:
                jd["region"] = node.get("region")
            row = {
                "bookmark_id": bid,
                "pdf_uuid": pdf_uuid,
                "created_at": created_ms,
                "updated_at": updated_ms,
                "version": 1,
                "json_data": jd,
            }
            return row

        def _walk(node: Dict[str, Any], parent_id: Optional[str], order: int) -> None:
            row = _flatten(node, parent_id, order)
            rows.append(row)
            children = node.get("children") or []
            for idx, child in enumerate(children):
                _walk(child, row["bookmark_id"], idx)

        for idx, root in enumerate(bookmarks):
            rid = (root.get("id") or root.get("bookmark_id"))
            root_order = order_map.get(rid, idx) if isinstance(rid, str) else idx
            _walk(root, None, root_order)

        self._bookmark_plugin.delete_by_pdf(pdf_uuid)
        for r in rows:
            self._bookmark_plugin.insert(r)
        return len(rows)

    # ---------------------------- 大纲（outline） ----------------------------
    def list_outline_items(self, pdf_uuid: str) -> Dict[str, Any]:
        """
        返回指定 PDF 的大纲树结构。
        输出字段对齐前端桥接器预期：data.outline_items = [{id,name,pageAt,position,children[]}]
        """
        try:
            self._logger.info("list_outline_items called: pdf_uuid=%s", pdf_uuid)
        except Exception:
            pass
        # 先判断 pdf 是否存在；不存在则返回 None（与“存在但为空[]”语义区分）
        try:
            info = self._pdf_info_plugin.query_by_id(pdf_uuid)
        except Exception:
            info = None
        if not info:
            try:
                self._logger.info("list_outline_items: pdf_info missing → return None")
            except Exception:
                pass
            return {"outline_items": None}

        rows = self._outline_plugin.query_by_pdf(pdf_uuid)
        if not rows:
            # 语义更新：即使 pdf_info 存在但无任何记录，也返回 None
            try:
                self._logger.info("list_outline_items: pdf_info exists, rows=0 → return None")
            except Exception:
                pass
            return {"outline_items": None}
        try:
            self._logger.info("list_outline_items: rows=%s → assemble tree", len(rows))
        except Exception:
            pass
        nodes: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            oid = row.get("outline_id") or row.get("bookmark_id")
            if not isinstance(oid, str):
                continue
            # 字段兼容：解析被插件提升的扁平字段
            name = row.get("name") if row.get("name") is not None else (row.get("json_data") or {}).get("name")
            page_at = row.get("pageAt") if row.get("pageAt") is not None else (row.get("json_data") or {}).get("pageAt")
            position = row.get("position") if "position" in row else (row.get("json_data") or {}).get("position")
            parent_id = row.get("parentId") if "parentId" in row else (row.get("json_data") or {}).get("parentId")
            order = row.get("order") if "order" in row else (row.get("json_data") or {}).get("order", 0)
            node = {
                "id": oid,
                "name": (name or "").strip(),
                "pageAt": int(page_at or 1),
                "position": position if (position is None or isinstance(position, (int, float))) else None,
                "parentId": parent_id,
                "order": int(order or 0),
                "children": [],
            }
            nodes[oid] = node
        # 组装树
        roots: list[str] = []
        for row in rows:
            oid = row.get("outline_id") or row.get("bookmark_id")
            if not isinstance(oid, str):
                continue
            parent_id = row.get("parentId") if "parentId" in row else (row.get("json_data") or {}).get("parentId")
            if parent_id and parent_id in nodes:
                nodes[parent_id]["children"].append(nodes[oid])
            else:
                roots.append(oid)
        # 排序
        def _sort_children(n):
            n["children"].sort(key=lambda x: x.get("order", 0))
            for c in n["children"]:
                _sort_children(c)
        for r in roots:
            _sort_children(nodes[r])
        roots.sort(key=lambda i: nodes[i].get("order", 0))
        return {"outline_items": [nodes[i] for i in roots]}

    def create_outline_item(
        self,
        *,
        pdf_uuid: str,
        name: str,
        page_at: int,
        position: Optional[int] = None,
        parent_id: Optional[str] = None,
        order: Optional[int] = None,
    ) -> str:
        """创建单个大纲节点，返回生成的 outline_id。"""
        # 生成与前端规范一致的 ID：outlineItem-XXXXXXXX（8位 0-9a-zA-Z）
        import random
        import string
        import json as _json

        def _gen_id() -> str:
            alphabet = string.ascii_letters + string.digits + "-_"
            return "outlineItem-" + "".join(random.choice(alphabet) for _ in range(8))

        outline_id = _gen_id()
        now = int(time.time() * 1000)
        jd = {
            "name": name,
            "pageAt": int(page_at),
            "position": (None if position is None else int(position)),
            "children": [],
            "parentId": parent_id if (isinstance(parent_id, str) and parent_id.strip()) else None,
            "order": int(order) if isinstance(order, int) else 0,
        }
        # 严格检查前置：pdf_info 必须已存在（禁止兜底）
        if not self._pdf_info_plugin.query_by_id(pdf_uuid):
            raise DatabaseValidationError(f"pdf_info not found for pdf_uuid={pdf_uuid}")
        payload = {
            "outline_id": outline_id,
            "pdf_uuid": pdf_uuid,
            "created_at": now,
            "updated_at": now,
            "version": 1,
            "json_data": jd,
        }
        try:
            self._logger.debug("[API] create_outline_item payload=%s", _json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass
        normalized = self._outline_plugin.validate_data(payload)
        self._outline_plugin.insert(normalized)
        return outline_id

    def update_outline_item(self, outline_id: str, update: Dict[str, Any]) -> bool:
        """
        更新单个大纲节点的属性：name/page_at/position/parent_id/order
        """
        if not isinstance(update, dict):
            return False
        # 映射字段到 outline 插件 update 形态（json_data 内）
        mapped: Dict[str, Any] = {}
        jd: Dict[str, Any] = {}
        if "name" in update:
            jd["name"] = update.get("name")
        if "page_at" in update:
            jd["pageAt"] = update.get("page_at")
        if "position" in update:
            jd["position"] = update.get("position")
        if "parent_id" in update:
            jd["parentId"] = update.get("parent_id")
        if "order" in update:
            jd["order"] = update.get("order")
        if jd:
            mapped["json_data"] = jd
        return self._outline_plugin.update(outline_id, mapped)

    def delete_outline_item(self, outline_id: str, *, cascade: bool = True) -> bool:
        """
        删除单个大纲节点；若 cascade=True，递归删除其所有子孙节点。
        """
        # 找到 pdf_uuid 及所有子孙
        row = self._outline_plugin.query_by_id(outline_id)
        if not row:
            return False
        pdf_uuid = row.get("pdf_uuid")
        if cascade:
            # 读取该 PDF 的所有项，构建子孙关系
            rows = self._outline_plugin.query_by_pdf(pdf_uuid)
            by_parent: Dict[Optional[str], list[str]] = {}
            for r in rows:
                pid = r.get("parentId")
                by_parent.setdefault(pid, []).append(r.get("outline_id") or r.get("bookmark_id"))
            # 递归收集
            to_delete: list[str] = []

            def _collect(nid: str):
                to_delete.append(nid)
                for cid in by_parent.get(nid, []):
                    _collect(cid)

            _collect(outline_id)
            ok_any = False
            for nid in to_delete:
                ok_any = self._outline_plugin.delete(nid) or ok_any
            return ok_any
        return self._outline_plugin.delete(outline_id)

    def reorder_outline_item(self, *, outline_id: str, new_parent_id: Optional[str], new_index: int) -> None:
        """
        将节点移动到新父节点下并设置顺序索引；随后规范化所有同级节点的 order。
        """
        # 查询节点，拿到 pdf_uuid
        row = self._outline_plugin.query_by_id(outline_id)
        if not row:
            raise DatabaseValidationError("outline not found")
        pdf_uuid = row.get("pdf_uuid")
        # 1) 更新自身 parentId
        self._outline_plugin.update(outline_id, {"parentId": new_parent_id})

        # 2) 读取目标父的所有子项
        if new_parent_id:
            # children of parent
            rows = self._executor.execute_query(
                "SELECT * FROM pdf_outline WHERE pdf_uuid = ? AND json_extract(json_data, '$.parentId') = ?",
                (pdf_uuid, new_parent_id),
            )
            parsed = [self._outline_plugin._parse_row(r) for r in rows]  # type: ignore[attr-defined]
        else:
            # 根级：按 order/created_at 排序
            rows = self._executor.execute_query(
                """
                SELECT * FROM pdf_outline
                WHERE pdf_uuid = ? AND json_extract(json_data, '$.parentId') IS NULL
                ORDER BY json_extract(json_data, '$.order') ASC, created_at ASC
                """,
                (pdf_uuid,),
            )
            parsed = [self._outline_plugin._parse_row(r) for r in rows]  # type: ignore[attr-defined]

        # 去掉自身（可能仍在结果里）
        parsed = [n for n in parsed if (n.get("outline_id") or n.get("bookmark_id")) != outline_id]
        # 插入到 new_index
        new_index = int(new_index or 0)
        new_index = max(0, min(new_index, len(parsed)))
        # 生成新顺序数组
        ordered = [p for p in parsed]
        stub = {"outline_id": outline_id}
        ordered.insert(new_index, stub)
        # 3) 逐一写入 order
        for idx, item in enumerate(ordered):
            bid = item.get("outline_id") or outline_id
            self._outline_plugin.update(bid, {"order": idx, "parentId": new_parent_id})

    def clear_bookmarks(self, pdf_uuid: str) -> int:
        # 兼容 API：按 PDF 清空大纲（实际删除 pdf_outline）
        return self._outline_plugin.delete_by_pdf(pdf_uuid)

    # ---------------------------- 锚点 ----------------------------

    # ---------------------------- 大纲批量导入（替换式） ----------------------------
    def bulk_replace_outline(self, *, pdf_uuid: str, items: List[Dict[str, Any]]) -> int:
        """
        用扁平列表一次性替换指定 PDF 的大纲数据。
        约束：
          - 必须已存在 pdf_info 记录（不兜底创建）；
          - items 为扁平数组，每项字段：
              outline_id, name, page_at, position? (0..100|null), parent_id? (str|null), order? (int>=0)
        行为：
          - 事务：先清空 pdf_uuid 的现有大纲，再批量 INSERT；
          - json_data.children 一律置空（树结构由 list_outline_items 动态组装）。
        返回：成功写入的行数。
        """
        if not isinstance(items, list):
            raise DatabaseValidationError("items must be a list")
        if not self._pdf_info_plugin.query_by_id(pdf_uuid):
            raise DatabaseValidationError(f"pdf_info not found for pdf_uuid={pdf_uuid}")
        now = int(time.time() * 1000)
        # 归一化并校验
        normalized_rows: List[tuple] = []
        for raw in items:
            name = raw.get("name")
            page_at = raw.get("page_at")
            position = raw.get("position", None)
            parent_id = raw.get("parent_id", None)
            order = raw.get("order", 0)
            outline_id = raw.get("outline_id")
            payload = {
                "outline_id": outline_id,
                "pdf_uuid": pdf_uuid,
                "created_at": now,
                "updated_at": now,
                "version": 1,
                "json_data": {
                    "name": name,
                    "pageAt": int(page_at or 1),
                    "position": (None if position is None else int(position)),
                    "children": [],
                    "parentId": parent_id if (isinstance(parent_id, str) and parent_id.strip()) else None,
                    "order": int(order or 0),
                },
            }
            norm = self._outline_plugin.validate_data(payload)
            # 准备批量参数（减少 Python→SQLite 往返）
            import json as _json
            normalized_rows.append((
                norm["outline_id"],
                norm["pdf_uuid"],
                norm["created_at"],
                norm["updated_at"],
                norm["version"],
                _json.dumps(norm["json_data"], ensure_ascii=False),
            ))
        # 执行事务：清空再批量写入
        self._outline_plugin.delete_by_pdf(pdf_uuid)
        sql = """
        INSERT INTO pdf_outline (outline_id, pdf_uuid, created_at, updated_at, version, json_data)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        return self._executor.execute_batch(sql, normalized_rows)
    def anchor_get(self, anchor_uuid: str) -> Optional[Dict[str, Any]]:
        return self._bookanchor_plugin.query_by_id(anchor_uuid)

    def anchor_list(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        return self._bookanchor_plugin.query_by_pdf(pdf_uuid)

    def anchor_create(self, anchor: Dict[str, Any]) -> str:
        """创建锚点（严格校验）。"""
        data = dict(anchor or {})
        # 生成/校验 uuid
        uuid = data.get("uuid")
        if not isinstance(uuid, str) or not uuid:
            import secrets
            uuid = f"pdfanchor-{secrets.token_hex(6)}"
        # 严格要求 name（存入 json_data）；兼容从 json_data.name 读取
        name = data.get("name") or ((data.get("json_data") or {}).get("name"))
        if not isinstance(name, str) or not name.strip():
            raise DatabaseValidationError("name must be a non-empty string")
        # 归一化字段
        now = int(time.time() * 1000)
        pos = data.get("position")
        try:
            posf = float(pos) if pos is not None else 0.0
        except Exception:
            posf = 0.0
        # 若误传百分比（>1），按 0..1 归一
        if posf > 1.0:
            posf = posf / 100.0
        normalized = {
            "uuid": uuid,
            "pdf_uuid": data.get("pdf_uuid"),
            "page_at": int(data.get("page_at") or 1),
            "position": posf,
            "visited_at": int(data.get("visited_at") or 0),
            "created_at": int(data.get("created_at") or now),
            "updated_at": int(data.get("updated_at") or now),
            "version": int(data.get("version") or 1),
            "json_data": {**(data.get("json_data") or {}), "name": name.strip()},
        }
        return self._bookanchor_plugin.insert(normalized)

    def anchor_update(self, anchor_uuid: str, update: Dict[str, Any]) -> bool:
        data: Dict[str, Any] = {}
        if "page_at" in update:
            data["page_at"] = int(update["page_at"])
        if "position" in update:
            pos = float(update["position"])
            if pos > 1.0:
                pos = pos / 100.0
            data["position"] = pos
        jd = {}
        if "name" in update:
            jd["name"] = str(update["name"])
        if jd:
            data["json_data"] = jd
        if "visited_at" in update:
            data["visited_at"] = int(update["visited_at"])
        return self._bookanchor_plugin.update(anchor_uuid, data)

    def anchor_delete(self, anchor_uuid: str) -> bool:
        return self._bookanchor_plugin.delete(anchor_uuid)

    def anchor_activate(self, anchor_uuid: str, active: bool = True) -> bool:
        """
        锚点激活接口（非持久化版）。

        设计约束（2025-12-02 更新）：
        - “激活状态”仅在前端会话内生效，不再写入 pdf_bookanchor.json_data.is_active；
        - 此方法仅用于校验锚点是否存在，并为 MsgCenter 提供一致的 completed/failed 回执；
        - page_at / position 等字段的持久化仍由 anchor_update/心跳逻辑负责。
        """
        row = self._bookanchor_plugin.query_by_id(anchor_uuid)
        if not row:
            return False
        # 仅校验存在性，不修改任何字段（包括 is_active / visited_at 等）。
        return True

