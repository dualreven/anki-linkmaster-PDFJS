"""
TablePlugin 抽象基类测试

测试 TablePlugin 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest
from unittest.mock import Mock, MagicMock, call

from ..base_table_plugin import TablePlugin
from ..event_bus import EventBus


# 测试用的具体插件实现
class ConcreteTablePlugin(TablePlugin):
    """具体的表插件实现（用于测试）"""

    @property
    def table_name(self) -> str:
        return 'test-table'

    @property
    def version(self) -> str:
        return '1.0.0'

    def create_table(self) -> None:
        """建表"""
        sql = '''
        CREATE TABLE IF NOT EXISTS test_table (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL
        )
        '''
        self._executor.execute_script(sql)
        self._emit_event('create', 'completed')

    def validate_data(self, data: dict) -> dict:
        """验证数据"""
        if 'id' not in data:
            raise ValueError("id is required")
        if not isinstance(data['id'], str):
            raise ValueError("id must be string")

        return {
            'id': data['id'],
            'name': data.get('name', '')
        }

    def insert(self, data: dict) -> str:
        """插入记录"""
        validated = self.validate_data(data)
        sql = "INSERT INTO test_table (id, name) VALUES (?, ?)"
        self._executor.execute_update(sql, (validated['id'], validated['name']))
        self._emit_event('create', 'completed', {'id': validated['id']})
        return validated['id']

    def update(self, primary_key: str, data: dict) -> bool:
        """更新记录"""
        validated = self.validate_data(data)
        sql = "UPDATE test_table SET name = ? WHERE id = ?"
        rows = self._executor.execute_update(sql, (validated['name'], primary_key))
        if rows > 0:
            self._emit_event('update', 'completed', {'id': primary_key})
        return rows > 0

    def delete(self, primary_key: str) -> bool:
        """删除记录"""
        sql = "DELETE FROM test_table WHERE id = ?"
        rows = self._executor.execute_update(sql, (primary_key,))
        if rows > 0:
            self._emit_event('delete', 'completed', {'id': primary_key})
        return rows > 0

    def query_by_id(self, primary_key: str) -> dict:
        """根据主键查询"""
        sql = "SELECT * FROM test_table WHERE id = ?"
        results = self._executor.execute_query(sql, (primary_key,))
        return results[0] if results else None

    def query_all(self, limit=None, offset=None):
        """查询所有记录"""
        sql = "SELECT * FROM test_table"
        params = []

        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        if offset is not None:
            sql += " OFFSET ?"
            params.append(offset)

        return self._executor.execute_query(sql, tuple(params) if params else ())


# 带依赖的插件
class PluginWithDependencies(ConcreteTablePlugin):
    """带依赖的插件（用于测试）"""

    @property
    def dependencies(self):
        return ['pdf-info', 'user-profile']


# 支持迁移的插件
class MigratablePlugin(ConcreteTablePlugin):
    """支持迁移的插件（用于测试）"""

    def migrate(self, from_version: str, to_version: str) -> None:
        """表结构迁移"""
        if from_version == '1.0.0' and to_version == '1.1.0':
            sql = "ALTER TABLE test_table ADD COLUMN email TEXT"
            self._executor.execute_script(sql)
        else:
            raise NotImplementedError(
                f"Migration from {from_version} to {to_version} not supported"
            )


class TestTablePlugin:
    """TablePlugin 测试类"""

    def test_cannot_instantiate_abstract_class(self):
        """测试：无法直接实例化抽象类"""
        executor = Mock()
        event_bus = EventBus()

        with pytest.raises(TypeError) as exc_info:
            TablePlugin(executor, event_bus)

        assert "Can't instantiate abstract class" in str(exc_info.value)

    def test_create_concrete_plugin(self):
        """测试：创建具体插件实例"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        assert plugin.table_name == 'test-table'
        assert plugin.version == '1.0.0'
        assert plugin.dependencies == []
        assert not plugin.is_enabled

    def test_plugin_with_dependencies(self):
        """测试：带依赖的插件"""
        executor = Mock()
        event_bus = EventBus()

        plugin = PluginWithDependencies(executor, event_bus)

        assert plugin.dependencies == ['pdf-info', 'user-profile']

    def test_enable_plugin(self):
        """测试：启用插件"""
        executor = Mock()
        event_bus = EventBus()
        logger = Mock()

        plugin = ConcreteTablePlugin(executor, event_bus, logger)

        # 启用插件
        plugin.enable()

        assert plugin.is_enabled
        # 验证建表方法被调用
        executor.execute_script.assert_called_once()
        # 验证日志记录
        logger.info.assert_called_once()
        assert "enabled" in logger.info.call_args[0][0].lower()

    def test_enable_plugin_only_once(self):
        """测试：重复启用插件只执行一次"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 第一次启用
        plugin.enable()
        call_count_1 = executor.execute_script.call_count

        # 第二次启用（不应该再次建表）
        plugin.enable()
        call_count_2 = executor.execute_script.call_count

        assert call_count_1 == call_count_2
        assert plugin.is_enabled

    def test_disable_plugin(self):
        """测试：禁用插件"""
        executor = Mock()
        event_bus = EventBus()
        logger = Mock()

        plugin = ConcreteTablePlugin(executor, event_bus, logger)

        # 启用后禁用
        plugin.enable()
        plugin.disable()

        assert not plugin.is_enabled
        # 验证日志记录
        assert logger.info.call_count == 2  # enable + disable
        assert "disabled" in logger.info.call_args[0][0].lower()

    def test_emit_event_success(self):
        """测试：成功发布事件"""
        executor = Mock()
        event_bus = EventBus()
        received_events = []

        def handler(data):
            received_events.append(data)

        # 订阅事件
        event_bus.on('table:test-table:create:completed', handler, 'test-subscriber')

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 触发事件
        plugin._emit_event('create', 'completed', {'id': 'abc123'})

        assert len(received_events) == 1
        assert received_events[0] == {'id': 'abc123'}

    def test_emit_event_with_error_handling(self):
        """测试：事件发布异常处理"""
        executor = Mock()
        event_bus = Mock()
        logger = Mock()

        # 模拟事件总线抛出异常
        event_bus.emit.side_effect = RuntimeError("EventBus error")

        plugin = ConcreteTablePlugin(executor, event_bus, logger)

        # 不应该抛出异常（应该被捕获并记录）
        plugin._emit_event('create', 'completed')

        # 验证日志记录了错误
        logger.error.assert_called_once()
        assert "Failed to emit event" in logger.error.call_args[0][0]

    def test_migrate_not_supported_by_default(self):
        """测试：默认不支持迁移"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        with pytest.raises(NotImplementedError) as exc_info:
            plugin.migrate('1.0.0', '2.0.0')

        assert "Migration not supported" in str(exc_info.value)

    def test_migrate_supported(self):
        """测试：支持迁移的插件"""
        executor = Mock()
        event_bus = EventBus()

        plugin = MigratablePlugin(executor, event_bus)

        # 支持的迁移路径
        plugin.migrate('1.0.0', '1.1.0')
        executor.execute_script.assert_called_once()

        # 不支持的迁移路径
        with pytest.raises(NotImplementedError):
            plugin.migrate('1.1.0', '2.0.0')

    def test_validate_data(self):
        """测试：数据验证"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 有效数据
        valid_data = {'id': 'abc123', 'name': 'Test'}
        result = plugin.validate_data(valid_data)
        assert result['id'] == 'abc123'
        assert result['name'] == 'Test'

        # 缺少必填字段
        with pytest.raises(ValueError) as exc_info:
            plugin.validate_data({'name': 'Test'})
        assert "id is required" in str(exc_info.value)

        # 字段类型错误
        with pytest.raises(ValueError) as exc_info:
            plugin.validate_data({'id': 123})
        assert "id must be string" in str(exc_info.value)

    def test_insert_with_event(self):
        """测试：插入记录并触发事件"""
        executor = Mock()
        executor.execute_update.return_value = 1
        event_bus = EventBus()
        received_events = []

        def handler(data):
            received_events.append(data)

        event_bus.on('table:test-table:create:completed', handler, 'test-subscriber')

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 插入数据
        result = plugin.insert({'id': 'abc123', 'name': 'Test'})

        assert result == 'abc123'
        executor.execute_update.assert_called_once()
        assert len(received_events) == 1
        assert received_events[0]['id'] == 'abc123'

    def test_update_with_event(self):
        """测试：更新记录并触发事件"""
        executor = Mock()
        executor.execute_update.return_value = 1  # 1行受影响
        event_bus = EventBus()
        received_events = []

        def handler(data):
            received_events.append(data)

        event_bus.on('table:test-table:update:completed', handler, 'test-subscriber')

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 更新数据
        result = plugin.update('abc123', {'id': 'abc123', 'name': 'Updated'})

        assert result is True
        executor.execute_update.assert_called_once()
        assert len(received_events) == 1

    def test_update_not_found(self):
        """测试：更新不存在的记录"""
        executor = Mock()
        executor.execute_update.return_value = 0  # 0行受影响
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        result = plugin.update('nonexistent', {'id': 'nonexistent', 'name': 'Test'})

        assert result is False

    def test_delete_with_event(self):
        """测试：删除记录并触发事件"""
        executor = Mock()
        executor.execute_update.return_value = 1
        event_bus = EventBus()
        received_events = []

        def handler(data):
            received_events.append(data)

        event_bus.on('table:test-table:delete:completed', handler, 'test-subscriber')

        plugin = ConcreteTablePlugin(executor, event_bus)

        # 删除数据
        result = plugin.delete('abc123')

        assert result is True
        executor.execute_update.assert_called_once()
        assert len(received_events) == 1

    def test_delete_not_found(self):
        """测试：删除不存在的记录"""
        executor = Mock()
        executor.execute_update.return_value = 0
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        result = plugin.delete('nonexistent')

        assert result is False

    def test_query_by_id(self):
        """测试：根据主键查询"""
        executor = Mock()
        executor.execute_query.return_value = [{'id': 'abc123', 'name': 'Test'}]
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        result = plugin.query_by_id('abc123')

        assert result == {'id': 'abc123', 'name': 'Test'}
        executor.execute_query.assert_called_once()

    def test_query_by_id_not_found(self):
        """测试：查询不存在的记录"""
        executor = Mock()
        executor.execute_query.return_value = []
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        result = plugin.query_by_id('nonexistent')

        assert result is None

    def test_query_all(self):
        """测试：查询所有记录"""
        executor = Mock()
        executor.execute_query.return_value = [
            {'id': 'abc1', 'name': 'Test1'},
            {'id': 'abc2', 'name': 'Test2'}
        ]
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        result = plugin.query_all()

        assert len(result) == 2
        executor.execute_query.assert_called_once()

    def test_query_all_with_limit(self):
        """测试：分页查询（limit）"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        plugin.query_all(limit=10)

        # 验证SQL包含LIMIT
        call_args = executor.execute_query.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        assert "LIMIT" in sql
        assert 10 in params

    def test_query_all_with_limit_and_offset(self):
        """测试：分页查询（limit + offset）"""
        executor = Mock()
        event_bus = EventBus()

        plugin = ConcreteTablePlugin(executor, event_bus)

        plugin.query_all(limit=10, offset=20)

        # 验证SQL包含LIMIT和OFFSET
        call_args = executor.execute_query.call_args
        sql = call_args[0][0]
        params = call_args[0][1]

        assert "LIMIT" in sql
        assert "OFFSET" in sql
        assert 10 in params
        assert 20 in params

    def test_plugin_logger_integration(self):
        """测试：插件日志集成"""
        executor = Mock()
        event_bus = EventBus()
        logger = Mock()

        plugin = ConcreteTablePlugin(executor, event_bus, logger)

        # 启用插件
        plugin.enable()

        # 验证日志记录
        logger.info.assert_called()
        assert "test-table" in logger.info.call_args[0][0]
        assert "1.0.0" in logger.info.call_args[0][0]
