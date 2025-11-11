"""
数据表事件名称常量

所有数据库插件的事件名称集中定义在此文件。

使用规范:
- 禁止在其他文件中使用字符串字面量定义事件名
- 使用 TableEventConstants.{TableName}.{ACTION}_{STATUS} 引用事件
- 新增表插件时，必须在此文件添加对应常量

命名格式: table:{table-name}:{action}:{status}
- table-name: 表名（kebab-case）
- action: 操作（create/update/delete/query/batch 等）
- status: 状态（requested/started/completed/success/failed/error 等）

创建日期: 2025-11-10
版本: v1.0
"""

from typing import Final


class TableEventConstants:
    """
    数据表事件名称常量（四段式命名）

    组织结构：按表名分组，每个表为一个嵌套类
    命名规则：{ACTION}_{STATUS} = 'table:{table-name}:{action}:{status}'
    """

    # ==================== PDF Info（PDF 基础信息表）====================

    class PDFInfo:
        """
        PDF 基础信息表事件常量
        表名: pdf_info
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:pdf-info:create:requested'
        CREATE_STARTED: Final[str] = 'table:pdf-info:create:started'
        CREATE_COMPLETED: Final[str] = 'table:pdf-info:create:completed'
        CREATE_SUCCESS: Final[str] = 'table:pdf-info:create:success'
        CREATE_FAILED: Final[str] = 'table:pdf-info:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:pdf-info:update:requested'
        UPDATE_STARTED: Final[str] = 'table:pdf-info:update:started'
        UPDATE_COMPLETED: Final[str] = 'table:pdf-info:update:completed'
        UPDATE_SUCCESS: Final[str] = 'table:pdf-info:update:success'
        UPDATE_FAILED: Final[str] = 'table:pdf-info:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:pdf-info:delete:requested'
        DELETE_STARTED: Final[str] = 'table:pdf-info:delete:started'
        DELETE_COMPLETED: Final[str] = 'table:pdf-info:delete:completed'
        DELETE_SUCCESS: Final[str] = 'table:pdf-info:delete:success'
        DELETE_FAILED: Final[str] = 'table:pdf-info:delete:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:pdf-info:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:pdf-info:query:completed'
        QUERY_FAILED: Final[str] = 'table:pdf-info:query:failed'

    # ==================== PDF Annotation（PDF 标注表）====================

    class PDFAnnotation:
        """
        PDF 标注表事件常量
        表名: pdf_annotation
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:pdf-annotation:create:requested'
        CREATE_COMPLETED: Final[str] = 'table:pdf-annotation:create:completed'
        CREATE_FAILED: Final[str] = 'table:pdf-annotation:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:pdf-annotation:update:requested'
        UPDATE_COMPLETED: Final[str] = 'table:pdf-annotation:update:completed'
        UPDATE_FAILED: Final[str] = 'table:pdf-annotation:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:pdf-annotation:delete:requested'
        DELETE_COMPLETED: Final[str] = 'table:pdf-annotation:delete:completed'
        DELETE_FAILED: Final[str] = 'table:pdf-annotation:delete:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:pdf-annotation:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:pdf-annotation:query:completed'
        QUERY_FAILED: Final[str] = 'table:pdf-annotation:query:failed'

    # ==================== PDF Outline（PDF 大纲表）====================

    class PDFOutline:
        """
        PDF 大纲表事件常量
        表名: pdf_outline
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:pdf-outline:create:requested'
        CREATE_COMPLETED: Final[str] = 'table:pdf-outline:create:completed'
        CREATE_FAILED: Final[str] = 'table:pdf-outline:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:pdf-outline:update:requested'
        UPDATE_COMPLETED: Final[str] = 'table:pdf-outline:update:completed'
        UPDATE_FAILED: Final[str] = 'table:pdf-outline:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:pdf-outline:delete:requested'
        DELETE_COMPLETED: Final[str] = 'table:pdf-outline:delete:completed'
        DELETE_FAILED: Final[str] = 'table:pdf-outline:delete:failed'

        # Reorder 事件
        REORDER_REQUESTED: Final[str] = 'table:pdf-outline:reorder:requested'
        REORDER_COMPLETED: Final[str] = 'table:pdf-outline:reorder:completed'
        REORDER_FAILED: Final[str] = 'table:pdf-outline:reorder:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:pdf-outline:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:pdf-outline:query:completed'
        QUERY_FAILED: Final[str] = 'table:pdf-outline:query:failed'

    # ==================== PDF Bookmark（PDF 书签表）====================

    class PDFBookmark:
        """
        PDF 书签表事件常量
        表名: pdf_bookmark
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:pdf-bookmark:create:requested'
        CREATE_COMPLETED: Final[str] = 'table:pdf-bookmark:create:completed'
        CREATE_FAILED: Final[str] = 'table:pdf-bookmark:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:pdf-bookmark:update:requested'
        UPDATE_COMPLETED: Final[str] = 'table:pdf-bookmark:update:completed'
        UPDATE_FAILED: Final[str] = 'table:pdf-bookmark:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:pdf-bookmark:delete:requested'
        DELETE_COMPLETED: Final[str] = 'table:pdf-bookmark:delete:completed'
        DELETE_FAILED: Final[str] = 'table:pdf-bookmark:delete:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:pdf-bookmark:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:pdf-bookmark:query:completed'
        QUERY_FAILED: Final[str] = 'table:pdf-bookmark:query:failed'

    # ==================== PDF Bookanchor（PDF 锚点表）====================

    class PDFBookanchor:
        """
        PDF 锚点表事件常量
        表名: pdf_bookanchor
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:pdf-bookanchor:create:requested'
        CREATE_COMPLETED: Final[str] = 'table:pdf-bookanchor:create:completed'
        CREATE_FAILED: Final[str] = 'table:pdf-bookanchor:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:pdf-bookanchor:update:requested'
        UPDATE_COMPLETED: Final[str] = 'table:pdf-bookanchor:update:completed'
        UPDATE_FAILED: Final[str] = 'table:pdf-bookanchor:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:pdf-bookanchor:delete:requested'
        DELETE_COMPLETED: Final[str] = 'table:pdf-bookanchor:delete:completed'
        DELETE_FAILED: Final[str] = 'table:pdf-bookanchor:delete:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:pdf-bookanchor:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:pdf-bookanchor:query:completed'
        QUERY_FAILED: Final[str] = 'table:pdf-bookanchor:query:failed'

    # ==================== Search Condition（搜索条件表）====================

    class SearchCondition:
        """
        搜索条件表事件常量
        表名: search_condition
        """

        # Create 事件
        CREATE_REQUESTED: Final[str] = 'table:search-condition:create:requested'
        CREATE_COMPLETED: Final[str] = 'table:search-condition:create:completed'
        CREATE_FAILED: Final[str] = 'table:search-condition:create:failed'

        # Update 事件
        UPDATE_REQUESTED: Final[str] = 'table:search-condition:update:requested'
        UPDATE_COMPLETED: Final[str] = 'table:search-condition:update:completed'
        UPDATE_FAILED: Final[str] = 'table:search-condition:update:failed'

        # Delete 事件
        DELETE_REQUESTED: Final[str] = 'table:search-condition:delete:requested'
        DELETE_COMPLETED: Final[str] = 'table:search-condition:delete:completed'
        DELETE_FAILED: Final[str] = 'table:search-condition:delete:failed'

        # Query 事件
        QUERY_REQUESTED: Final[str] = 'table:search-condition:query:requested'
        QUERY_COMPLETED: Final[str] = 'table:search-condition:query:completed'
        QUERY_FAILED: Final[str] = 'table:search-condition:query:failed'


# ==================== 辅助工具类（保持兼容） ====================

class TableEventHelper:
    """
    事件名称辅助工具类（兼容现有 TableEvents）

    提供动态生成事件名称的方法，用于特殊场景。
    普通场景请优先使用 TableEventConstants。
    """

    @staticmethod
    def create_event(table_name: str, status: str) -> str:
        """
        创建 create 事件名称

        Args:
            table_name: 表名（kebab-case）
            status: 状态（requested/completed/failed 等）

        Returns:
            事件名称字符串

        Example:
            >>> TableEventHelper.create_event('pdf-info', 'completed')
            'table:pdf-info:create:completed'
        """
        return f"table:{table_name}:create:{status}"

    @staticmethod
    def update_event(table_name: str, status: str) -> str:
        """创建 update 事件名称"""
        return f"table:{table_name}:update:{status}"

    @staticmethod
    def delete_event(table_name: str, status: str) -> str:
        """创建 delete 事件名称"""
        return f"table:{table_name}:delete:{status}"

    @staticmethod
    def query_event(table_name: str, status: str) -> str:
        """创建 query 事件名称"""
        return f"table:{table_name}:query:{status}"

    @staticmethod
    def custom_event(table_name: str, action: str, status: str) -> str:
        """
        创建自定义事件名称

        Args:
            table_name: 表名
            action: 操作（如 reorder, batch 等）
            status: 状态

        Returns:
            事件名称字符串
        """
        return f"table:{table_name}:{action}:{status}"


# ==================== 导出（向后兼容）====================

# 保持与 event_bus.py 的兼容性
TableEvents = TableEventHelper  # 别名
