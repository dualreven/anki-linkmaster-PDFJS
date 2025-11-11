"""
插件模块

提供数据表插件的基础设施：
- EventBus: 事件总线
- TablePlugin: 抽象基类
- TablePluginRegistry: 插件注册中心
- TableEventConstants: 事件常量（推荐使用）

创建日期: 2025-10-05
更新日期: 2025-11-10（新增事件常量）
版本: v1.1
"""

from .event_bus import EventBus, TableEvents, EventStatus
from .table_event_constants import TableEventConstants, TableEventHelper
from .base_table_plugin import TablePlugin
from .plugin_registry import TablePluginRegistry, PluginDependencyError

__all__ = [
    # 事件总线
    'EventBus',
    'TableEvents',  # 兼容别名，指向 TableEventHelper
    'EventStatus',
    # 事件常量（新增）
    'TableEventConstants',  # 推荐使用
    'TableEventHelper',
    # 插件基类
    'TablePlugin',
    # 注册中心
    'TablePluginRegistry',
    'PluginDependencyError',
]
