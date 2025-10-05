"""
插件模块

提供数据表插件的基础设施：
- EventBus: 事件总线
- TablePlugin: 抽象基类
- TablePluginRegistry: 插件注册中心

创建日期: 2025-10-05
版本: v1.0
"""

from .event_bus import EventBus, TableEvents, EventStatus
from .base_table_plugin import TablePlugin
from .plugin_registry import TablePluginRegistry, PluginDependencyError

__all__ = [
    # 事件总线
    'EventBus',
    'TableEvents',
    'EventStatus',
    # 插件基类
    'TablePlugin',
    # 注册中心
    'TablePluginRegistry',
    'PluginDependencyError',
]
