"""pdf_annotation_tags 表插件实现（标注标签）"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFAnnotationTagsTablePlugin(TablePlugin):
    """管理 pdf_annotation_tags 表的数据库插件。"""

    def __init__(
        self,
        executor: "SQLExecutor",
        event_bus: EventBus,
        logger=None,
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._subscriber_id = f"pdf-annotation-tags-plugin-{id(self)}"

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return "pdf_annotation_tags"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def dependencies(self) -> List[str]:
        # 依赖 pdf_annotation（外键引用）
        return ["pdf_annotation"]

    # ==================== 建表 ====================

    def create_table(self) -> None:
        script = """
        CREATE TABLE IF NOT EXISTS pdf_annotation_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ann_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (ann_id) REFERENCES pdf_annotation(ann_id) ON DELETE CASCADE,
            UNIQUE (ann_id, tag)
        );

        CREATE INDEX IF NOT EXISTS idx_ann_tag_ann_id
            ON pdf_annotation_tags(ann_id);

        CREATE INDEX IF NOT EXISTS idx_ann_tag_tag
            ON pdf_annotation_tags(tag);
        """
        self._executor.execute_script(script)
        self._emit_event("create", "completed")
        if self._logger:
            self._logger.info("pdf_annotation_tags table ensured")

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError("data is required")

        normalized: Dict[str, Any] = {}

        ann_id = data.get("ann_id")
        if not isinstance(ann_id, str) or not ann_id.strip():
            raise DatabaseValidationError("ann_id must be a non-empty string")
        normalized["ann_id"] = ann_id.strip()

        tag = data.get("tag")
        if not isinstance(tag, str):
            raise DatabaseValidationError("tag must be a string")
        tag_norm = tag.strip()
        if not tag_norm:
            raise DatabaseValidationError("tag must be a non-empty string")
        normalized["tag"] = tag_norm

        created_at_raw = data.get("created_at")
        if created_at_raw is None:
            created_at = int(time.time() * 1000)
        else:
            try:
                created_at = int(created_at_raw)
            except (TypeError, ValueError):
                raise DatabaseValidationError("created_at must be a non-negative integer")
            if created_at < 0:
                raise DatabaseValidationError("created_at must be a non-negative integer")
        normalized["created_at"] = created_at

        return normalized

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        validated = self.validate_data(data)
        sql = """
        INSERT INTO pdf_annotation_tags (ann_id, tag, created_at)
        VALUES (?, ?, ?)
        """
        params = (
            validated["ann_id"],
            validated["tag"],
            validated["created_at"],
        )
        self._executor.execute_update(sql, params)
        # 这里主键为自增 id，返回字符串形式便于统一
        row = self._executor.execute_query(
            "SELECT id FROM pdf_annotation_tags "
            "WHERE ann_id = ? AND tag = ? "
            "ORDER BY id DESC LIMIT 1",
            (validated["ann_id"], validated["tag"]),
        )
        tag_id = str(row[0]["id"]) if row else ""
        self._emit_event("create", "completed", {"id": tag_id, "ann_id": validated["ann_id"], "tag": validated["tag"]})
        return tag_id

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        # 目前标签只支持修改 tag / created_at，且使用较少，提供最小实现
        try:
            tag_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")

        rows = self._executor.execute_query(
            "SELECT * FROM pdf_annotation_tags WHERE id = ?", (tag_id,)
        )
        if not rows:
            return False
        existing = rows[0]
        merged: Dict[str, Any] = {
            "ann_id": existing["ann_id"],
            "tag": existing["tag"],
            "created_at": existing["created_at"],
        }
        if "ann_id" in data:
            merged["ann_id"] = data["ann_id"]
        if "tag" in data:
            merged["tag"] = data["tag"]
        if "created_at" in data:
            merged["created_at"] = data["created_at"]

        normalized = self.validate_data(merged)
        sql = """
        UPDATE pdf_annotation_tags
        SET ann_id = ?, tag = ?, created_at = ?
        WHERE id = ?
        """
        params = (
            normalized["ann_id"],
            normalized["tag"],
            normalized["created_at"],
            tag_id,
        )
        affected = self._executor.execute_update(sql, params)
        if affected > 0:
            self._emit_event("update", "completed", {"id": tag_id})
        return affected > 0

    def delete(self, primary_key: str) -> bool:
        try:
            tag_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")
        rows = self._executor.execute_update(
            "DELETE FROM pdf_annotation_tags WHERE id = ?", (tag_id,)
        )
        if rows > 0:
            self._emit_event("delete", "completed", {"id": tag_id})
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        try:
            tag_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")
        rows = self._executor.execute_query(
            "SELECT * FROM pdf_annotation_tags WHERE id = ?", (tag_id,)
        )
        return rows[0] if rows else None

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_annotation_tags ORDER BY created_at"
        params: List[Any] = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        if offset is not None:
            sql += " OFFSET ?"
            params.append(int(offset))
        return self._executor.execute_query(sql, tuple(params) if params else None)

    # ==================== 扩展方法 ====================

    def list_tags(self, ann_id: str) -> List[str]:
        sql = """
        SELECT tag FROM pdf_annotation_tags
        WHERE ann_id = ?
        ORDER BY created_at
        """
        rows = self._executor.execute_query(sql, (ann_id,))
        return [row["tag"] for row in rows]

    def list_annotations_by_tag(self, tag: str) -> List[str]:
        sql = """
        SELECT ann_id FROM pdf_annotation_tags
        WHERE tag = ?
        ORDER BY created_at
        """
        rows = self._executor.execute_query(sql, (tag,))
        return [row["ann_id"] for row in rows]
