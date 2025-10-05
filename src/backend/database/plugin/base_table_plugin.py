"""
数据表插件抽象基类

所有数据表插件必须继承此类。

创建日期: 2025-10-05
版本: v1.0
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any

from .event_bus import EventBus, TableEvents, EventStatus


class TablePlugin(ABC):
    """
    数据表插件抽象基类

    所有数据表插件必须实现此接口，确保：
    1. 统一的建表、增删查改接口
    2. 字段合规性检查
    3. 事件发布和监听
    4. 表结构变更（迁移）

    Example:
        >>> class PDFInfoTablePlugin(TablePlugin):
        ...     @property
        ...     def table_name(self) -> str:
        ...         return 'pdf_info'
        ...
        ...     @property
        ...     def version(self) -> str:
        ...         return '1.0.0'
        ...
        ...     def create_table(self) -> None:
        ...         # 实现建表逻辑
        ...         pass
    """

    # ==================== 必须实现的属性 ====================

    @property
    @abstractmethod
    def table_name(self) -> str:
        """
        表名（如 'pdf_info'）

        Returns:
            str: 表名（小写，下划线分隔）
        """
        pass

    @property
    @abstractmethod
    def version(self) -> str:
        """
        插件版本（遵循 SemVer，如 '1.0.0'）

        Returns:
            str: 版本号
        """
        pass

    @property
    def dependencies(self) -> List[str]:
        """
        依赖的其他表插件（可选，默认无依赖）

        Returns:
            List[str]: 依赖的表名列表

        Example:
            >>> @property
            >>> def dependencies(self) -> List[str]:
            ...     return ['pdf_info']  # pdf_annotation 依赖 pdf_info
        """
        return []

    # ==================== 构造函数 ====================

    def __init__(self, executor, event_bus: EventBus, logger=None):
        """
        初始化插件

        Args:
            executor: SQLExecutor 实例
            event_bus: EventBus 实例
            logger: 日志记录器

        Note:
            不要在 __init__ 中执行建表操作，应在 enable() 中执行
        """
        self._executor = executor
        self._event_bus = event_bus
        self._logger = logger
        self._enabled = False

    # ==================== 必须实现的方法（建表） ====================

    @abstractmethod
    def create_table(self) -> None:
        """
        建表（如果表不存在）

        职责:
        1. 执行 CREATE TABLE IF NOT EXISTS 语句
        2. 创建索引
        3. 触发 'table:{table_name}:create:completed' 事件

        Raises:
            DatabaseError: 建表失败

        Example:
            >>> def create_table(self) -> None:
            ...     sql = '''
            ...     CREATE TABLE IF NOT EXISTS pdf_info (
            ...         uuid TEXT PRIMARY KEY NOT NULL,
            ...         title TEXT NOT NULL DEFAULT ''
            ...     )
            ...     '''
            ...     self._executor.execute_script(sql)
            ...     self._emit_event('create', 'completed')
        """
        pass

    # ==================== 必须实现的方法（数据验证） ====================

    @abstractmethod
    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        字段合规性检查

        Args:
            data: 待验证的数据字典

        Returns:
            验证并清洗后的数据（设置默认值、类型转换）

        Raises:
            DatabaseValidationError: 数据不合规

        验证内容:
        1. 必填字段存在性
        2. 字段类型正确性
        3. 字段约束（长度、范围、枚举）
        4. JSON 字段格式正确性
        5. 外键存在性（可选）

        Example:
            >>> def validate_data(self, data: Dict) -> Dict:
            ...     if 'uuid' not in data:
            ...         raise DatabaseValidationError("uuid is required")
            ...
            ...     if not isinstance(data['uuid'], str):
            ...         raise DatabaseValidationError("uuid must be string")
            ...
            ...     return {
            ...         'uuid': data['uuid'],
            ...         'title': data.get('title', ''),
            ...         'created_at': data.get('created_at', int(time.time() * 1000))
            ...     }
        """
        pass

    # ==================== 必须实现的方法（CRUD） ====================

    @abstractmethod
    def insert(self, data: Dict[str, Any]) -> str:
        """
        插入一条记录

        Args:
            data: 数据字典（必须包含主键）

        Returns:
            插入记录的主键值

        Raises:
            DatabaseConstraintError: 主键冲突
            DatabaseValidationError: 数据验证失败

        流程:
        1. 验证数据（调用 validate_data）
        2. 执行 INSERT
        3. 触发 create:completed 事件

        Example:
            >>> def insert(self, data: Dict) -> str:
            ...     validated = self.validate_data(data)
            ...     sql = "INSERT INTO pdf_info (uuid, title) VALUES (?, ?)"
            ...     self._executor.execute_update(sql, (validated['uuid'], validated['title']))
            ...     self._emit_event('create', 'completed', {'uuid': validated['uuid']})
            ...     return validated['uuid']
        """
        pass

    @abstractmethod
    def update(self, primary_key: str, data: Dict[str, Any]) -> bool:
        """
        更新记录

        Args:
            primary_key: 主键值
            data: 要更新的字段（不包含主键）

        Returns:
            是否成功更新（True=找到并更新，False=未找到）

        Raises:
            DatabaseValidationError: 数据验证失败

        流程:
        1. 验证数据
        2. 执行 UPDATE
        3. 触发 update:completed 事件

        Example:
            >>> def update(self, uuid: str, data: Dict) -> bool:
            ...     validated = self.validate_data(data)
            ...     sql = "UPDATE pdf_info SET title = ? WHERE uuid = ?"
            ...     rows = self._executor.execute_update(sql, (validated['title'], uuid))
            ...     if rows > 0:
            ...         self._emit_event('update', 'completed', {'uuid': uuid})
            ...     return rows > 0
        """
        pass

    @abstractmethod
    def delete(self, primary_key: str) -> bool:
        """
        删除记录

        Args:
            primary_key: 主键值

        Returns:
            是否成功删除

        流程:
        1. 执行 DELETE
        2. 触发 delete:completed 事件

        Example:
            >>> def delete(self, uuid: str) -> bool:
            ...     sql = "DELETE FROM pdf_info WHERE uuid = ?"
            ...     rows = self._executor.execute_update(sql, (uuid,))
            ...     if rows > 0:
            ...         self._emit_event('delete', 'completed', {'uuid': uuid})
            ...     return rows > 0
        """
        pass

    @abstractmethod
    def query_by_id(self, primary_key: str) -> Optional[Dict[str, Any]]:
        """
        根据主键查询单条记录

        Args:
            primary_key: 主键值

        Returns:
            记录字典，不存在则返回 None

        Example:
            >>> def query_by_id(self, uuid: str) -> Optional[Dict]:
            ...     sql = "SELECT * FROM pdf_info WHERE uuid = ?"
            ...     results = self._executor.execute_query(sql, (uuid,))
            ...     return results[0] if results else None
        """
        pass

    @abstractmethod
    def query_all(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        查询所有记录（分页）

        Args:
            limit: 限制数量
            offset: 偏移量

        Returns:
            记录列表

        Example:
            >>> def query_all(self, limit=None, offset=None) -> List[Dict]:
            ...     sql = "SELECT * FROM pdf_info"
            ...     if limit is not None:
            ...         sql += f" LIMIT {limit}"
            ...     if offset is not None:
            ...         sql += f" OFFSET {offset}"
            ...     return self._executor.execute_query(sql)
        """
        pass

    # ==================== 可选实现的方法 ====================

    def migrate(self, from_version: str, to_version: str) -> None:
        """
        表结构迁移（可选）

        Args:
            from_version: 当前版本
            to_version: 目标版本

        Raises:
            NotImplementedError: 如果不支持迁移

        Example:
            >>> def migrate(self, from_version: str, to_version: str) -> None:
            ...     if from_version == '1.0.0' and to_version == '1.1.0':
            ...         sql = "ALTER TABLE pdf_info ADD COLUMN new_field TEXT"
            ...         self._executor.execute_script(sql)
            ...     else:
            ...         raise NotImplementedError(f"Migration from {from_version} to {to_version} not supported")
        """
        raise NotImplementedError(
            f"Migration not supported for {self.table_name}"
        )

    def enable(self) -> None:
        """
        启用插件（生命周期方法）

        职责:
        1. 建表（调用 create_table）
        2. 设置事件监听（可选）
        3. 标记为已启用

        Example:
            >>> def enable(self) -> None:
            ...     if not self._enabled:
            ...         self.create_table()
            ...         self._setup_event_listeners()
            ...         self._enabled = True
            ...         if self._logger:
            ...             self._logger.info(f"Plugin '{self.table_name}' enabled")
        """
        if not self._enabled:
            self.create_table()
            self._enabled = True

            if self._logger:
                self._logger.info(
                    f"TablePlugin '{self.table_name}' v{self.version} enabled"
                )

    def disable(self) -> None:
        """
        禁用插件（生命周期方法）

        职责:
        1. 取消事件监听
        2. 清理资源
        3. 标记为已禁用

        Note:
            不会删除表，只是禁用插件功能
        """
        if self._enabled:
            self._enabled = False

            if self._logger:
                self._logger.info(
                    f"TablePlugin '{self.table_name}' disabled"
                )

    # ==================== 辅助方法 ====================

    def _emit_event(
        self,
        action: str,
        status: str,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        发布事件（私有方法）

        Args:
            action: 动作（create/update/delete/query）
            status: 状态（completed/failed/success/error）
            data: 事件数据

        Example:
            >>> self._emit_event('create', 'completed', {'uuid': 'abc123'})
        """
        event_name = f"table:{self.table_name}:{action}:{status}"

        try:
            self._event_bus.emit(event_name, data)
        except Exception as e:
            if self._logger:
                self._logger.error(
                    f"Failed to emit event '{event_name}': {e}"
                )

    @property
    def is_enabled(self) -> bool:
        """
        检查插件是否已启用

        Returns:
            bool: 是否已启用
        """
        return self._enabled
