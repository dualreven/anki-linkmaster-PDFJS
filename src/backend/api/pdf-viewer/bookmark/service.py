from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import time

from src.backend.database.exceptions import DatabaseValidationError


class BookmarkService:
    """Interface-like base for bookmark service."""

    def list_bookmarks(self, pdf_uuid: str, *, context: Optional[Any] = None) -> Dict[str, Any]:
        raise NotImplementedError

    def save_bookmarks(
        self,
        pdf_uuid: str,
        bookmarks: List[Dict[str, Any]],
        *,
        root_ids: Optional[List[str]] = None,
        context: Optional[Any] = None,
    ) -> int:
        raise NotImplementedError


class DefaultBookmarkService(BookmarkService):
    def list_bookmarks(self, pdf_uuid: str, *, context: Optional[Any] = None) -> Dict[str, Any]:
        if context is None:
            raise ValueError("context is required for DefaultBookmarkService.list_bookmarks")
        if not pdf_uuid:
            # reuse validation exception
            raise context._annotation_plugin.ValidationError("pdf_uuid is required")  # type: ignore[attr-defined]
        rows = context._bookmark_plugin.query_by_pdf(pdf_uuid)  # type: ignore[attr-defined]
        if not rows:
            return {"bookmarks": [], "root_ids": []}

        node_map: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            bookmark_id = row['bookmark_id']
            page_at = row.get('pageAt')
            if not isinstance(page_at, int) or page_at < 1:
                # 严格模式：缺少或非法 pageAt 直接报错，不再回退任何旧字段
                raise DatabaseValidationError('pageAt is required and must be >= 1')
            position = row.get('position', None)
            if isinstance(position, (int, float)):
                position = int(round(position))
                if position < 0: position = 0
                if position > 100: position = 100
            else:
                position = None
            node_map[bookmark_id] = {
                "id": bookmark_id,
                "name": row.get('name', ''),
                "pageAt": page_at,
                "position": position,
                "children": [],
                "parentId": row.get('parentId'),
                "order": row.get('order', 0) or 0,
                "createdAt": context._ms_to_iso(row.get('created_at')),  # type: ignore[attr-defined]
                "updatedAt": context._ms_to_iso(row.get('updated_at')),  # type: ignore[attr-defined]
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
        bookmarks = list(node_map.values())
        return {"bookmarks": bookmarks, "root_ids": root_ids}

    def save_bookmarks(
        self,
        pdf_uuid: str,
        bookmarks: List[Dict[str, Any]],
        *,
        root_ids: Optional[List[str]] = None,
        context: Optional[Any] = None,
    ) -> int:
        if context is None:
            raise ValueError("context is required for DefaultBookmarkService.save_bookmarks")
        if not pdf_uuid:
            raise context._annotation_plugin.ValidationError("pdf_uuid is required")  # type: ignore[attr-defined]
        if bookmarks is None:
            raise context._annotation_plugin.ValidationError("bookmarks is required")  # type: ignore[attr-defined]
        if not isinstance(bookmarks, list):
            raise context._annotation_plugin.ValidationError("bookmarks must be a list")  # type: ignore[attr-defined]
        root_order = self._build_root_order(bookmarks, root_ids)

        rows: List[Dict[str, Any]] = []
        try:
            for bookmark in bookmarks:
                order = root_order.get(bookmark.get('id'))
                bookmark_rows, _ = self._flatten_bookmark_tree(bookmark, pdf_uuid, parent_id=None, order=order)
                rows.extend(bookmark_rows)
        except ValueError as exc:
            raise DatabaseValidationError(str(exc))

        context._bookmark_plugin.delete_by_pdf(pdf_uuid)  # type: ignore[attr-defined]
        for row in rows:
            context._bookmark_plugin.insert(row)  # type: ignore[attr-defined]
        return len(rows)

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
            raise ValueError('bookmark must be an object')
        bookmark_id = bookmark.get('id') or bookmark.get('bookmark_id')
        if not isinstance(bookmark_id, str) or not bookmark_id:
            raise ValueError('bookmark id is required')

        children = bookmark.get('children') or []
        rows: List[Dict[str, Any]] = []
        child_summaries: List[Dict[str, Any]] = []
        for idx, child in enumerate(children):
            child_rows, child_summary = self._flatten_bookmark_tree(child, pdf_uuid, parent_id=bookmark_id, order=idx)
            rows.extend(child_rows)
            child_summaries.append(child_summary)

        row = self._build_bookmark_row(bookmark, pdf_uuid, parent_id, order if isinstance(order, int) else 0, child_summaries)
        rows.insert(0, row)
        summary = {
            'bookmark_id': row['bookmark_id'],
            'name': row['json_data']['name'],
            'pageAt': row['json_data']['pageAt'],
            'position': row['json_data']['position'],
            'children': child_summaries,
            'parentId': row['json_data']['parentId'],
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
            raise ValueError('bookmark id is required')
        name = bookmark.get('name')
        if not isinstance(name, str) or not name.strip():
            raise ValueError('bookmark name is required')
        # 统一为 pageAt/position（严格模式：取消对 pageNumber/region 的任何回退）
        def _int_ge1(name_: str, v: Any) -> int:
            try:
                iv = int(v)
            except Exception:
                raise ValueError(f'{name_} must be an integer >= 1')
            if iv < 1:
                raise ValueError(f'{name_} must be an integer >= 1')
            return iv
        # 仅接受 pageAt，不再从 pageNumber 回退
        page_at = _int_ge1('pageAt', bookmark.get('pageAt', None))
        position = bookmark.get('position', None)
        if position is not None:
            try:
                fv = float(position)
                if fv < 0 or fv > 100:
                    raise ValueError('position must be between 0 and 100')
                position = int(round(fv))
            except Exception:
                raise ValueError('position must be a number between 0 and 100')

        created_ms = self._iso_to_ms(bookmark.get('createdAt'))
        updated_ms = self._iso_to_ms(bookmark.get('updatedAt'))
        if created_ms == 0:
            created_ms = int(time.time() * 1000)
        if updated_ms == 0:
            updated_ms = created_ms

        json_data = {
            'name': name.strip(),
            'pageAt': page_at,
            'position': position,
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

    # 不再使用 region/type；统一为 pageAt/position

    @staticmethod
    def _iso_to_ms(value: Optional[str]) -> int:
        if not value:
            return 0
        try:
            iso_value = value.replace('Z', '+00:00')
            from datetime import datetime
            dt = datetime.fromisoformat(iso_value)
            return int(dt.timestamp() * 1000)
        except ValueError:
            return 0

