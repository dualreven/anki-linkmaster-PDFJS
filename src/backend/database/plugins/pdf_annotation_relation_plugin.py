"""pdf_annotation_relation 表插件实现（标注关系）"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..exceptions import DatabaseValidationError
from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFAnnotationRelationTablePlugin(TablePlugin):
    """管理 pdf_annotation_relation 表的数据库插件。"""

    def __init__(
        self,
        executor: "SQLExecutor",
        event_bus: EventBus,
        logger=None,
    ) -> None:
        super().__init__(executor, event_bus, logger)
        self._subscriber_id = f"pdf-annotation-relation-plugin-{id(self)}"

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return "pdf_annotation_relation"

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
        CREATE TABLE IF NOT EXISTS pdf_annotation_relation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_ann_id   TEXT NOT NULL,
            target_type     TEXT NOT NULL
                CHECK (target_type IN ('annotation', 'pdf', 'card')),
            target_ann_id   TEXT,
            target_pdf_uuid TEXT,
            target_card_id  TEXT,
            relation_type   TEXT NOT NULL,
            created_at      INTEGER NOT NULL,
            FOREIGN KEY (source_ann_id) REFERENCES pdf_annotation(ann_id) ON DELETE CASCADE,
            CHECK (
                (target_type = 'annotation' AND target_ann_id   IS NOT NULL AND target_pdf_uuid IS NULL AND target_card_id IS NULL) OR
                (target_type = 'pdf'        AND target_pdf_uuid IS NOT NULL AND target_ann_id   IS NULL AND target_card_id IS NULL) OR
                (target_type = 'card'       AND target_card_id  IS NOT NULL AND target_ann_id   IS NULL AND target_pdf_uuid IS NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS idx_ann_rel_source
            ON pdf_annotation_relation (source_ann_id);

        CREATE INDEX IF NOT EXISTS idx_ann_rel_target_ann
            ON pdf_annotation_relation (target_type, target_ann_id);

        CREATE INDEX IF NOT EXISTS idx_ann_rel_target_pdf
            ON pdf_annotation_relation (target_type, target_pdf_uuid);

        CREATE INDEX IF NOT EXISTS idx_ann_rel_target_card
            ON pdf_annotation_relation (target_type, target_card_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_ann_rel_unique
            ON pdf_annotation_relation (
                source_ann_id,
                target_type,
                COALESCE(target_ann_id,   ''),
                COALESCE(target_pdf_uuid, ''),
                COALESCE(target_card_id,  ''),
                relation_type
            );
        """
        self._executor.execute_script(script)
        self._emit_event("create", "completed")
        if self._logger:
            self._logger.info("pdf_annotation_relation table ensured")

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if data is None:
            raise DatabaseValidationError("data is required")

        normalized: Dict[str, Any] = {}

        source_ann_id = data.get("source_ann_id")
        if not isinstance(source_ann_id, str) or not source_ann_id.strip():
            raise DatabaseValidationError("source_ann_id must be a non-empty string")
        normalized["source_ann_id"] = source_ann_id.strip()

        target_type = data.get("target_type")
        if target_type not in ("annotation", "pdf", "card"):
            raise DatabaseValidationError("target_type must be 'annotation', 'pdf' or 'card'")
        normalized["target_type"] = target_type

        target_ann_id = data.get("target_ann_id")
        target_pdf_uuid = data.get("target_pdf_uuid")
        target_card_id = data.get("target_card_id")

        if target_type == "annotation":
            if not isinstance(target_ann_id, str) or not target_ann_id.strip():
                raise DatabaseValidationError("target_ann_id must be a non-empty string when target_type='annotation'")
            normalized["target_ann_id"] = target_ann_id.strip()
            normalized["target_pdf_uuid"] = None
            normalized["target_card_id"] = None
        elif target_type == "pdf":
            if not isinstance(target_pdf_uuid, str) or not target_pdf_uuid.strip():
                raise DatabaseValidationError("target_pdf_uuid must be a non-empty string when target_type='pdf'")
            normalized["target_ann_id"] = None
            normalized["target_pdf_uuid"] = target_pdf_uuid.strip()
            normalized["target_card_id"] = None
        else:
            # card
            if not isinstance(target_card_id, str) or not target_card_id.strip():
                raise DatabaseValidationError("target_card_id must be a non-empty string when target_type='card'")
            normalized["target_ann_id"] = None
            normalized["target_pdf_uuid"] = None
            normalized["target_card_id"] = target_card_id.strip()

        relation_type = data.get("relation_type")
        if not isinstance(relation_type, str) or not relation_type.strip():
            raise DatabaseValidationError("relation_type must be a non-empty string")
        normalized["relation_type"] = relation_type.strip()

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
        normalized = self.validate_data(data)
        sql = """
        INSERT INTO pdf_annotation_relation (
            source_ann_id, target_type,
            target_ann_id, target_pdf_uuid, target_card_id,
            relation_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            normalized["source_ann_id"],
            normalized["target_type"],
            normalized["target_ann_id"],
            normalized["target_pdf_uuid"],
            normalized["target_card_id"],
            normalized["relation_type"],
            normalized["created_at"],
        )
        self._executor.execute_update(sql, params)
        row = self._executor.execute_query(
            "SELECT id FROM pdf_annotation_relation "
            "WHERE source_ann_id = ? AND target_type = ? "
            "  AND COALESCE(target_ann_id,   '') = COALESCE(?, '') "
            "  AND COALESCE(target_pdf_uuid, '') = COALESCE(?, '') "
            "  AND COALESCE(target_card_id,  '') = COALESCE(?, '') "
            "  AND relation_type = ? "
            "ORDER BY id DESC LIMIT 1",
            (
                normalized["source_ann_id"],
                normalized["target_type"],
                normalized["target_ann_id"],
                normalized["target_pdf_uuid"],
                normalized["target_card_id"],
                normalized["relation_type"],
            ),
        )
        rel_id = str(row[0]["id"]) if row else ""
        self._emit_event("create", "completed", {"id": rel_id})
        return rel_id

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        # 关系记录通常是 append-only，本方法只提供最小实现：允许更新 relation_type / created_at。
        try:
            rel_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")

        rows = self._executor.execute_query(
            "SELECT * FROM pdf_annotation_relation WHERE id = ?", (rel_id,)
        )
        if not rows:
            return False
        existing = rows[0]
        merged: Dict[str, Any] = {
            "source_ann_id": existing["source_ann_id"],
            "target_type": existing["target_type"],
            "target_ann_id": existing["target_ann_id"],
            "target_pdf_uuid": existing["target_pdf_uuid"],
            "target_card_id": existing["target_card_id"],
            "relation_type": existing["relation_type"],
            "created_at": existing["created_at"],
        }
        for key in ("relation_type", "created_at"):
            if key in data:
                merged[key] = data[key]

        normalized = self.validate_data(merged)
        sql = """
        UPDATE pdf_annotation_relation
        SET relation_type = ?, created_at = ?
        WHERE id = ?
        """
        params = (
            normalized["relation_type"],
            normalized["created_at"],
            rel_id,
        )
        affected = self._executor.execute_update(sql, params)
        if affected > 0:
            self._emit_event("update", "completed", {"id": rel_id})
        return affected > 0

    def delete(self, primary_key: str) -> bool:
        try:
            rel_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")
        rows = self._executor.execute_update(
            "DELETE FROM pdf_annotation_relation WHERE id = ?", (rel_id,)
        )
        if rows > 0:
            self._emit_event("delete", "completed", {"id": rel_id})
        return rows > 0

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        try:
            rel_id = int(primary_key)
        except (TypeError, ValueError):
            raise DatabaseValidationError("primary_key must be an integer string")
        rows = self._executor.execute_query(
            "SELECT * FROM pdf_annotation_relation WHERE id = ?", (rel_id,)
        )
        return rows[0] if rows else None

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pdf_annotation_relation ORDER BY created_at"
        params: List[Any] = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        if offset is not None:
            sql += " OFFSET ?"
            params.append(int(offset))
        return self._executor.execute_query(sql, tuple(params) if params else None)

    # ==================== 扩展查询 ====================

    def get_outgoing(self, ann_id: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation_relation
        WHERE source_ann_id = ?
        ORDER BY created_at
        """
        return self._executor.execute_query(sql, (ann_id,))

    def get_incoming_for_annotation(self, ann_id: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation_relation
        WHERE target_type = 'annotation' AND target_ann_id = ?
        ORDER BY created_at
        """
        return self._executor.execute_query(sql, (ann_id,))

    def get_relations_for_pdf(self, pdf_uuid: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation_relation
        WHERE target_type = 'pdf' AND target_pdf_uuid = ?
        ORDER BY created_at
        """
        return self._executor.execute_query(sql, (pdf_uuid,))

    def get_relations_for_card(self, card_id: str) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_annotation_relation
        WHERE target_type = 'card' AND target_card_id = ?
        ORDER BY created_at
        """
        return self._executor.execute_query(sql, (card_id,))
