from __future__ import annotations

from typing import Any, Dict, List, Optional
import time
import secrets


class DefaultAnchorService:
    def get(self, anchor_uuid: str, *, context) -> Optional[Dict[str, Any]]:
        return context._bookanchor_plugin.query_by_id(anchor_uuid)

    def list(self, pdf_uuid: str, *, context) -> List[Dict[str, Any]]:
        return context._bookanchor_plugin.query_by_pdf(pdf_uuid)

    def create(self, anchor: Dict[str, Any], *, context) -> str:
        data = dict(anchor or {})
        if not data.get("uuid"):
            suffix = secrets.token_hex(6)
            data["uuid"] = f"pdfanchor-{suffix}"
        now = int(time.time() * 1000)
        data.setdefault("created_at", now)
        data.setdefault("updated_at", now)
        data.setdefault("visited_at", 0)
        data.setdefault("version", 1)
        name = data.get("name") or (data.get("json_data") or {}).get("name") or "未命名锚点"
        jd = data.get("json_data") or {}
        jd["name"] = name
        data["json_data"] = jd
        return context._bookanchor_plugin.insert(data)

    def update(self, anchor_uuid: str, update: Dict[str, Any], *, context) -> bool:
        data: Dict[str, Any] = {}
        if "page_at" in update:
            data["page_at"] = int(update["page_at"])
        if "position" in update:
            pos = update["position"]
            try:
                pos = float(pos)
            except Exception:
                pos = 0.0
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
        return context._bookanchor_plugin.update(anchor_uuid, data)

    def delete(self, anchor_uuid: str, *, context) -> bool:
        return context._bookanchor_plugin.delete(anchor_uuid)

    def activate(self, anchor_uuid: str, active: bool = True, *, context) -> bool:
        row = context._bookanchor_plugin.query_by_id(anchor_uuid)
        if not row:
            return False
        pdf_uuid = row.get("pdf_uuid")
        if not pdf_uuid:
            return False
        now = int(time.time() * 1000)
        try:
            if active:
                sql1 = (
                    "UPDATE pdf_bookanchor "
                    "SET json_data = json_set(json_data, '$.is_active', 0), updated_at = ?, version = version + 1 "
                    "WHERE pdf_uuid = ? AND uuid <> ? AND json_extract(json_data, '$.is_active') = 1"
                )
                context._executor.execute_update(sql1, (now, pdf_uuid, anchor_uuid))
                sql2 = (
                    "UPDATE pdf_bookanchor "
                    "SET json_data = json_set(json_data, '$.is_active', 1), visited_at = ?, updated_at = ?, version = version + 1 "
                    "WHERE uuid = ?"
                )
                rows2 = context._executor.execute_update(sql2, (now, now, anchor_uuid))
                return rows2 > 0
            else:
                sql = (
                    "UPDATE pdf_bookanchor "
                    "SET json_data = json_set(json_data, '$.is_active', 0), updated_at = ?, version = version + 1 "
                    "WHERE uuid = ?"
                )
                rows = context._executor.execute_update(sql, (now, anchor_uuid))
                return rows > 0
        except Exception:
            raise

