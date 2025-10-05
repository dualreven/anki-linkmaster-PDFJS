"""
事件总线模块

提供插件间通信的事件总线，支持三段式事件命名验证。

创建日期: 2025-10-05
版本: v1.0
"""

import re
from typing import Dict, List, Callable, Any, Optional
from collections import defaultdict


class EventBus:
    """
    事件总线（发布-订阅模式）

    特性:
    - 三段式事件命名验证（table:action:status）
    - 支持订阅和发布事件
    - 支持取消订阅
    - 支持一次性订阅（once）

    Example:
        >>> bus = EventBus()
        >>> def handler(data):
        ...     print(f"Received: {data}")
        >>> bus.on('table:pdf-info:create:completed', handler)
        >>> bus.emit('table:pdf-info:create:completed', {'uuid': 'abc123'})
        Received: {'uuid': 'abc123'}
    """

    # 事件名称正则（三段式：table:action:status，只允许小写字母、数字和连字符）
    EVENT_NAME_PATTERN = re.compile(
        r'^table:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$'
    )

    def __init__(self, logger: Optional[Any] = None):
        """
        初始化事件总线

        Args:
            logger: 日志记录器（可选）
        """
        self._logger = logger
        # 存储订阅者信息：{event_name: [(subscriber_id, handler), ...]}
        self._listeners: Dict[str, List[tuple]] = defaultdict(list)
        self._once_listeners: Dict[str, List[tuple]] = defaultdict(list)

    def on(self, event_name: str, handler: Callable, subscriber_id: str) -> None:
        """
        订阅事件

        Args:
            event_name: 事件名称（必须符合三段式格式）
            handler: 事件处理函数（接受一个参数：事件数据）
            subscriber_id: 订阅者ID（用于追踪和调试）

        Raises:
            ValueError: 事件名称格式不正确或订阅者ID为空

        Example:
            >>> def handler(data):
            ...     print(data)
            >>> bus.on('table:pdf-info:create:completed', handler, 'pdf-annotation-plugin')
        """
        self._validate_event_name(event_name)

        if not subscriber_id or not isinstance(subscriber_id, str):
            raise ValueError("subscriber_id must be a non-empty string")

        self._listeners[event_name].append((subscriber_id, handler))

        if self._logger:
            self._logger.debug(
                f"EventBus: [{subscriber_id}] subscribed to '{event_name}'"
            )

    def once(self, event_name: str, handler: Callable, subscriber_id: str) -> None:
        """
        订阅一次性事件（触发一次后自动取消订阅）

        Args:
            event_name: 事件名称
            handler: 事件处理函数
            subscriber_id: 订阅者ID

        Raises:
            ValueError: 事件名称格式不正确或订阅者ID为空

        Example:
            >>> def handler(data):
            ...     print(data)
            >>> bus.once('table:pdf-info:create:completed', handler, 'pdf-annotation-plugin')
        """
        self._validate_event_name(event_name)

        if not subscriber_id or not isinstance(subscriber_id, str):
            raise ValueError("subscriber_id must be a non-empty string")

        self._once_listeners[event_name].append((subscriber_id, handler))

        if self._logger:
            self._logger.debug(
                f"EventBus: [{subscriber_id}] subscribed (once) to '{event_name}'"
            )

    def off(self, event_name: str, handler: Callable, subscriber_id: str) -> None:
        """
        取消订阅

        Args:
            event_name: 事件名称
            handler: 要移除的处理函数
            subscriber_id: 订阅者ID

        Example:
            >>> bus.off('table:pdf-info:create:completed', handler, 'pdf-annotation-plugin')
        """
        if event_name in self._listeners:
            # 查找并移除匹配的订阅者
            self._listeners[event_name] = [
                (sid, h) for sid, h in self._listeners[event_name]
                if not (sid == subscriber_id and h == handler)
            ]

            if self._logger:
                self._logger.debug(
                    f"EventBus: [{subscriber_id}] unsubscribed from '{event_name}'"
                )

        if event_name in self._once_listeners:
            # 查找并移除匹配的订阅者
            self._once_listeners[event_name] = [
                (sid, h) for sid, h in self._once_listeners[event_name]
                if not (sid == subscriber_id and h == handler)
            ]

    def emit(self, event_name: str, data: Any = None) -> None:
        """
        发布事件

        Args:
            event_name: 事件名称
            data: 事件数据（可选）

        Raises:
            ValueError: 事件名称格式不正确

        Example:
            >>> bus.emit('table:pdf-info:create:completed', {'uuid': 'abc123'})
        """
        self._validate_event_name(event_name)

        if self._logger:
            self._logger.debug(
                f"EventBus: Emitting '{event_name}' with data: {data}"
            )

        # 触发常规监听器
        if event_name in self._listeners:
            for subscriber_id, handler in self._listeners[event_name]:
                try:
                    handler(data)
                except Exception as e:
                    if self._logger:
                        self._logger.error(
                            f"EventBus: Error in handler [{subscriber_id}] for '{event_name}': {e}"
                        )

        # 触发一次性监听器
        if event_name in self._once_listeners:
            once_handlers = self._once_listeners[event_name].copy()
            self._once_listeners[event_name].clear()

            for subscriber_id, handler in once_handlers:
                try:
                    handler(data)
                except Exception as e:
                    if self._logger:
                        self._logger.error(
                            f"EventBus: Error in once handler [{subscriber_id}] for '{event_name}': {e}"
                        )

    def clear(self, event_name: Optional[str] = None) -> None:
        """
        清除监听器

        Args:
            event_name: 事件名称（如果为 None，清除所有监听器）

        Example:
            >>> bus.clear('table:pdf-info:create:completed')  # 清除特定事件
            >>> bus.clear()  # 清除所有事件
        """
        if event_name is None:
            # 清除所有监听器
            self._listeners.clear()
            self._once_listeners.clear()

            if self._logger:
                self._logger.debug("EventBus: Cleared all listeners")
        else:
            # 清除特定事件的监听器
            if event_name in self._listeners:
                del self._listeners[event_name]
            if event_name in self._once_listeners:
                del self._once_listeners[event_name]

            if self._logger:
                self._logger.debug(
                    f"EventBus: Cleared listeners for '{event_name}'"
                )

    def _validate_event_name(self, event_name: str) -> None:
        """
        验证事件名称格式（私有方法）

        Args:
            event_name: 事件名称

        Raises:
            ValueError: 事件名称格式不正确

        正确格式示例:
        - table:pdf-info:create:completed
        - table:pdf-annotation:update:success
        - table:pdf-bookmark:delete:failed

        错误格式示例:
        - create:completed（缺少table前缀）
        - table:pdfInfo:create:completed（使用驼峰命名）
        - table:pdf-info:created（只有两段）
        - table:pdf-info:create:completed:extra（超过四段）
        """
        if not self.EVENT_NAME_PATTERN.match(event_name):
            raise ValueError(
                f"Invalid event name '{event_name}'. "
                f"Must match format: table:<table-name>:<action>:<status>\n"
                f"Examples:\n"
                f"  ✅ table:pdf-info:create:completed\n"
                f"  ✅ table:pdf-annotation:update:success\n"
                f"  ❌ create:completed (missing 'table:' prefix)\n"
                f"  ❌ table:pdfInfo:create:completed (camelCase not allowed)\n"
                f"  ❌ table:pdf-info:created (only 3 segments)\n"
                f"  ❌ table:pdf-info:create:completed:extra (5 segments)"
            )


# 标准事件名称常量
class TableEvents:
    """
    数据表标准事件名称

    所有事件名称遵循三段式格式：table:<table-name>:<action>:<status>
    """

    @staticmethod
    def create_event(table_name: str, status: str) -> str:
        """创建 create 事件名称"""
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
    def batch_event(table_name: str, action: str, status: str) -> str:
        """创建批量操作事件名称"""
        return f"table:{table_name}:{action}:{status}"


# 标准状态常量
class EventStatus:
    """事件状态常量"""
    REQUESTED = 'requested'      # 请求
    STARTED = 'started'          # 开始
    PROGRESS = 'progress'        # 进行中
    COMPLETED = 'completed'      # 完成
    SUCCESS = 'success'          # 成功
    FAILED = 'failed'            # 失败
    ERROR = 'error'              # 错误
