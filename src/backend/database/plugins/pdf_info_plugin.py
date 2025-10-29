"""PDF 信息表插件实现（拆分版）"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

from ..plugin.base_table_plugin import TablePlugin
from ..plugin.event_bus import EventBus
from .pdf_info import ddl, validate, read_ops, write_ops
from .pdf_info.constants import UUID_PATTERN as _UUID_PATTERN, FILENAME_PATTERN as _FILENAME_PATTERN, ORDERABLE_COLUMNS as _ORDERABLE_COLUMNS

if TYPE_CHECKING:
    from ..executor import SQLExecutor


class PDFInfoTablePlugin(TablePlugin):
    """管理 pdf_info 表（委托到子模块，保证行为与接口不变）。"""

    _UUID_PATTERN = _UUID_PATTERN
    _FILENAME_PATTERN = _FILENAME_PATTERN
    _ORDERABLE_COLUMNS = _ORDERABLE_COLUMNS

    def __init__(
        self,
        executor: 'SQLExecutor',
        event_bus: EventBus,
        logger=None
    ) -> None:
        super().__init__(executor, event_bus, logger)

    # ==================== 元信息 ====================

    @property
    def table_name(self) -> str:
        return "pdf_info"

    @property
    def version(self) -> str:
        return "1.0.0"

    # ==================== 建表 ====================

    def create_table(self) -> None:
        script = ddl.get_create_table_script()
        self._executor.execute_script(script)
        self._emit_event("create", "completed")
        if self._logger:
            self._logger.info("pdf_info table ensured")

    # ==================== 验证 ====================

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return validate.validate_data(self, data)

    # ==================== CRUD ====================

    def insert(self, data: Dict[str, Any]) -> str:
        return write_ops.insert(self, data)

    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        return write_ops.update(self, primary_key, data)

    def delete(self, primary_key: str) -> bool:
        return write_ops.delete(self, primary_key)

    # ==================== 查询与搜索 ====================

    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        return read_ops.query_by_id(self, primary_key)

    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return read_ops.query_all(self, limit=limit, offset=offset)

    def query_all_by_visited(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return read_ops.query_all_by_visited(self, limit=limit, offset=offset)

    def query_all_by_created(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return read_ops.query_all_by_created(self, limit=limit, offset=offset)

    def count_all(self) -> int:
        return read_ops.count_all(self)

    def _parse_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        # 兼容旧调用
        return read_ops.parse_row(row)

    def query_by_filename(self, filename: str) -> Optional[Dict[str, Any]]:
        sql = """
        SELECT * FROM pdf_info
        WHERE json_extract(json_data, '$.filename') = ?
        """
        rows = self._executor.execute_query(sql, (filename,))
        if not rows:
            return None
        return self._parse_row(rows[0])

    def search(
        self,
        keyword: str,
        fields: Optional[List[str]] = None,
        limit: Optional[int] = 50
    ) -> List[Dict[str, Any]]:
        return read_ops.search(self, keyword, fields, limit)

    def search_records(
        self,
        keywords: List[str],
        search_fields: Optional[List[str]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return read_ops.search_records(self, keywords, search_fields, limit, offset)

    def search_with_filters(
        self,
        keywords: List[str],
        filters: Optional[Dict[str, Any]] = None,
        search_fields: Optional[List[str]] = None,
        sort_rules: Optional[List[Dict[str, Any]]] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        return read_ops.search_with_filters(self, keywords, filters, search_fields, sort_rules, limit, offset)

    # ==================== 过滤与统计 ====================

    def filter_by_tags(
        self,
        tags: List[str],
        match_mode: str = "any"
    ) -> List[Dict[str, Any]]:
        return read_ops.filter_by_tags(self, tags, match_mode)

    def filter_by_rating(self, min_rating: int = 0, max_rating: int = 5) -> List[Dict[str, Any]]:
        return read_ops.filter_by_rating(self, min_rating, max_rating)

    def get_visible_pdfs(self) -> List[Dict[str, Any]]:
        return read_ops.get_visible_pdfs(self)

    def get_statistics(self) -> Dict[str, Any]:
        return read_ops.get_statistics(self)

    def update_reading_stats(self, uuid: str, reading_time_delta: int) -> bool:
        return write_ops.update_reading_stats(self, uuid, reading_time_delta)

    def add_tag(self, uuid: str, tag: str) -> bool:
        return write_ops.add_tag(self, uuid, tag)

    def remove_tag(self, uuid: str, tag: str) -> bool:
        return write_ops.remove_tag(self, uuid, tag)

