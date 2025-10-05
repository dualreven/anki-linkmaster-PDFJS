"""
插件注册中心测试

测试 TablePluginRegistry 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest
from unittest.mock import Mock

from ..plugin_registry import TablePluginRegistry, PluginDependencyError
from ..base_table_plugin import TablePlugin
from ..event_bus import EventBus


# 测试插件A（无依赖）
class PluginA(TablePlugin):
    """插件A（无依赖）"""

    @property
    def table_name(self) -> str:
        return 'plugin-a'

    @property
    def version(self) -> str:
        return '1.0.0'

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return data.get('id', '')

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


# 测试插件B（依赖A）
class PluginB(TablePlugin):
    """插件B（依赖A）"""

    @property
    def table_name(self) -> str:
        return 'plugin-b'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self):
        return ['plugin-a']

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return data.get('id', '')

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


# 测试插件C（依赖B）
class PluginC(TablePlugin):
    """插件C（依赖B）"""

    @property
    def table_name(self) -> str:
        return 'plugin-c'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self):
        return ['plugin-b']

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return data.get('id', '')

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


# 测试插件D（循环依赖：依赖C，而C最终依赖B依赖A）
class PluginD(TablePlugin):
    """插件D（多依赖：依赖A和B）"""

    @property
    def table_name(self) -> str:
        return 'plugin-d'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self):
        return ['plugin-a', 'plugin-b']

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return data.get('id', '')

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


# 循环依赖测试插件
class PluginCircular1(TablePlugin):
    """循环依赖插件1（依赖插件2）"""

    @property
    def table_name(self) -> str:
        return 'circular-1'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self):
        return ['circular-2']

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return ''

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


class PluginCircular2(TablePlugin):
    """循环依赖插件2（依赖插件1）"""

    @property
    def table_name(self) -> str:
        return 'circular-2'

    @property
    def version(self) -> str:
        return '1.0.0'

    @property
    def dependencies(self):
        return ['circular-1']

    def create_table(self) -> None:
        pass

    def validate_data(self, data: dict) -> dict:
        return data

    def insert(self, data: dict) -> str:
        return ''

    def update(self, primary_key: str, data: dict) -> bool:
        return True

    def delete(self, primary_key: str) -> bool:
        return True

    def query_by_id(self, primary_key: str) -> dict:
        return None

    def query_all(self, limit=None, offset=None):
        return []


class TestTablePluginRegistry:
    """TablePluginRegistry 测试类"""

    def setup_method(self):
        """每个测试前重置单例"""
        TablePluginRegistry.reset_instance()

    def test_create_registry(self):
        """测试：创建注册中心"""
        executor = Mock()
        event_bus = EventBus()

        registry = TablePluginRegistry(executor, event_bus)

        assert registry is not None
        assert registry.get_all() == {}

    def test_singleton_pattern(self):
        """测试：单例模式"""
        executor = Mock()
        event_bus = EventBus()

        registry1 = TablePluginRegistry.get_instance(executor, event_bus)
        registry2 = TablePluginRegistry.get_instance(executor, event_bus)

        assert registry1 is registry2

    def test_register_plugin(self):
        """测试：注册插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin = PluginA(executor, event_bus)
        registry.register(plugin)

        assert registry.has('plugin-a')
        assert registry.get('plugin-a') is plugin

    def test_register_duplicate_plugin(self):
        """测试：注册重复插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin1 = PluginA(executor, event_bus)
        registry.register(plugin1)

        plugin2 = PluginA(executor, event_bus)

        with pytest.raises(ValueError) as exc_info:
            registry.register(plugin2)

        assert "already registered" in str(exc_info.value)

    def test_register_with_dependencies(self):
        """测试：注册带依赖的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)

        assert registry.has('plugin-a')
        assert registry.has('plugin-b')

    def test_register_missing_dependency(self):
        """测试：注册缺失依赖的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_b = PluginB(executor, event_bus)

        # 允许注册（依赖验证延迟）
        registry.register(plugin_b)
        assert registry.has('plugin-b')

        # 启用时检测依赖缺失
        with pytest.raises(PluginDependencyError) as exc_info:
            registry.enable_all()

        assert "not registered" in str(exc_info.value)

    def test_unregister_plugin(self):
        """测试：注销插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin = PluginA(executor, event_bus)
        registry.register(plugin)
        registry.unregister('plugin-a')

        assert not registry.has('plugin-a')

    def test_unregister_with_dependents(self):
        """测试：注销被依赖的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)

        # 无法注销被依赖的插件
        with pytest.raises(ValueError) as exc_info:
            registry.unregister('plugin-a')

        assert "depend on it" in str(exc_info.value)

    def test_dependency_resolution_order(self):
        """测试：依赖解析顺序"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)
        plugin_c = PluginC(executor, event_bus)

        # 注册顺序：C -> A -> B（乱序）
        registry.register(plugin_a)
        registry.register(plugin_b)
        registry.register(plugin_c)

        order = registry.get_enable_order()

        # 正确顺序应该是：A -> B -> C
        assert order.index('plugin-a') < order.index('plugin-b')
        assert order.index('plugin-b') < order.index('plugin-c')

    def test_circular_dependency_detection(self):
        """测试：循环依赖检测"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin1 = PluginCircular1(executor, event_bus)
        plugin2 = PluginCircular2(executor, event_bus)

        # 允许注册（依赖验证延迟）
        registry.register(plugin1)
        registry.register(plugin2)

        # 启用时检测循环依赖
        with pytest.raises(PluginDependencyError) as exc_info:
            registry.enable_all()

        assert "Circular dependency" in str(exc_info.value)

    def test_enable_all_plugins(self):
        """测试：启用所有插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)

        # 启用所有插件
        registry.enable_all()

        assert plugin_a.is_enabled
        assert plugin_b.is_enabled

    def test_disable_all_plugins(self):
        """测试：禁用所有插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)
        registry.enable_all()

        # 禁用所有插件
        registry.disable_all()

        assert not plugin_a.is_enabled
        assert not plugin_b.is_enabled

    def test_enable_single_plugin(self):
        """测试：启用单个插件（自动启用依赖）"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)

        # 启用B，应该自动启用A
        registry.enable('plugin-b')

        assert plugin_a.is_enabled
        assert plugin_b.is_enabled

    def test_disable_single_plugin(self):
        """测试：禁用单个插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        registry.register(plugin_a)
        registry.enable_all()

        # 禁用插件
        registry.disable('plugin-a')

        assert not plugin_a.is_enabled

    def test_disable_plugin_with_dependents_error(self):
        """测试：禁用被依赖的插件（应该报错）"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)
        registry.enable_all()

        # 无法禁用被依赖的插件
        with pytest.raises(ValueError) as exc_info:
            registry.disable('plugin-a')

        assert "depend on it" in str(exc_info.value)

    def test_disable_plugin_with_force(self):
        """测试：强制禁用插件（级联禁用依赖者）"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)
        registry.enable_all()

        # 强制禁用A（应该同时禁用B）
        registry.disable('plugin-a', force=True)

        assert not plugin_a.is_enabled
        assert not plugin_b.is_enabled

    def test_get_enabled_plugins(self):
        """测试：获取已启用插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)

        registry.register(plugin_a)
        registry.register(plugin_b)

        # 只启用A
        registry.enable('plugin-a')

        enabled = registry.get_enabled()

        assert 'plugin-a' in enabled
        assert 'plugin-b' not in enabled

    def test_is_enabled(self):
        """测试：检查插件是否启用"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin = PluginA(executor, event_bus)
        registry.register(plugin)

        assert not registry.is_enabled('plugin-a')

        registry.enable('plugin-a')

        assert registry.is_enabled('plugin-a')

    def test_is_enabled_nonexistent_plugin(self):
        """测试：检查不存在的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        with pytest.raises(ValueError):
            registry.is_enabled('nonexistent')

    def test_complex_dependency_tree(self):
        """测试：复杂依赖树"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        plugin_a = PluginA(executor, event_bus)
        plugin_b = PluginB(executor, event_bus)  # 依赖A
        plugin_c = PluginC(executor, event_bus)  # 依赖B
        plugin_d = PluginD(executor, event_bus)  # 依赖A和B

        registry.register(plugin_a)
        registry.register(plugin_b)
        registry.register(plugin_c)
        registry.register(plugin_d)

        order = registry.get_enable_order()

        # A必须在最前面
        assert order[0] == 'plugin-a'
        # B必须在A之后，C和D之前
        assert order.index('plugin-b') > order.index('plugin-a')
        assert order.index('plugin-b') < order.index('plugin-c')
        assert order.index('plugin-b') < order.index('plugin-d')
        # C必须在B之后
        assert order.index('plugin-c') > order.index('plugin-b')

    def test_logger_integration(self):
        """测试：日志集成"""
        executor = Mock()
        event_bus = EventBus()
        logger = Mock()
        registry = TablePluginRegistry(executor, event_bus, logger)

        plugin = PluginA(executor, event_bus)
        registry.register(plugin)

        # 验证注册日志
        logger.info.assert_called()
        assert "Registered plugin" in logger.info.call_args[0][0]

    def test_get_nonexistent_plugin(self):
        """测试：获取不存在的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        result = registry.get('nonexistent')

        assert result is None

    def test_enable_nonexistent_plugin(self):
        """测试：启用不存在的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        with pytest.raises(ValueError):
            registry.enable('nonexistent')

    def test_disable_nonexistent_plugin(self):
        """测试：禁用不存在的插件"""
        executor = Mock()
        event_bus = EventBus()
        registry = TablePluginRegistry(executor, event_bus)

        with pytest.raises(ValueError):
            registry.disable('nonexistent')
