"""
WebSocket连接管理器测试用例
测试连接状态管理、自动重连和事件处理功能
"""
import pytest
import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from backend.websocket.connection_manager import (
    ConnectionManager, ConnectionState, ConnectionStats
)
from backend.websocket.reconnect_strategy import (
    ReconnectManager, ReconnectConfig, ReconnectStrategy
)
from backend.websocket.event_handler import (
    EventHandler, EventType, ConnectionStateMonitor
)


@pytest.fixture
def connection_manager():
    """创建连接管理器实例"""
    return ConnectionManager(max_reconnect_attempts=3)


@pytest.fixture
def reconnect_manager():
    """创建重连管理器实例"""
    return ReconnectManager(ReconnectConfig(max_attempts=3))


@pytest.fixture
def event_handler():
    """创建事件处理器实例"""
    return EventHandler()


@pytest.fixture
def state_monitor(event_handler):
    """创建状态监控器实例"""
    return ConnectionStateMonitor(event_handler)


class TestConnectionManager:
    """连接管理器测试类"""
    
    def test_initial_state(self, connection_manager):
        """测试初始状态"""
        assert connection_manager.state == ConnectionState.DISCONNECTED
        assert connection_manager.stats.total_connections == 0
        assert connection_manager.stats.successful_connections == 0
        
    def test_state_transition(self, connection_manager):
        """测试状态转换"""
        # 从断开连接到连接中
        connection_manager.set_state(ConnectionState.CONNECTING)
        assert connection_manager.state == ConnectionState.CONNECTING
        
        # 从连接中到已连接
        connection_manager.set_state(ConnectionState.CONNECTED)
        assert connection_manager.state == ConnectionState.CONNECTED
        assert connection_manager.stats.successful_connections == 1
        
        # 从已连接到断开连接
        connection_manager.set_state(ConnectionState.DISCONNECTED)
        assert connection_manager.state == ConnectionState.DISCONNECTED
        
    def test_state_callbacks(self, connection_manager):
        """测试状态变更回调"""
        callback_calls = []
        
        def test_callback(old_state, new_state):
            callback_calls.append((old_state, new_state))
            
        # 注册回调
        connection_manager.register_state_callback(ConnectionState.CONNECTED, test_callback)
        
        # 触发状态变更
        connection_manager.set_state(ConnectionState.CONNECTING)
        connection_manager.set_state(ConnectionState.CONNECTED)
        
        # 验证回调被调用
        assert len(callback_calls) == 1
        assert callback_calls[0][0] == ConnectionState.CONNECTING
        assert callback_calls[0][1] == ConnectionState.CONNECTED
        
    @pytest.mark.asyncio
    async def test_successful_reconnect(self, connection_manager):
        """测试成功的重连"""
        mock_connect = AsyncMock(return_value=True)
        
        # 模拟连接失败后的重连
        connection_manager.set_state(ConnectionState.DISCONNECTED)
        result = await connection_manager.start_reconnect_loop(mock_connect)
        
        assert result is True
        # 连接成功后状态应该是CONNECTED
        assert connection_manager.state == ConnectionState.CONNECTED
        assert connection_manager.stats.successful_connections == 1
        assert connection_manager.reconnect_attempts == 0
        
    @pytest.mark.asyncio
    async def test_failed_reconnect(self, connection_manager):
        """测试失败的重连"""
        mock_connect = AsyncMock(side_effect=Exception("Connection failed"))
        
        # 模拟多次重连失败
        result = await connection_manager.start_reconnect_loop(mock_connect)
        
        assert result is False
        assert connection_manager.state == ConnectionState.ERROR
        assert connection_manager.stats.failed_connections == 3
        assert connection_manager.reconnect_attempts == 3
        
    @pytest.mark.asyncio
    async def test_stop_reconnect(self, connection_manager):
        """测试停止重连"""
        mock_connect = AsyncMock(side_effect=Exception("Connection failed"))
        
        # 启动重连任务
        task = asyncio.create_task(connection_manager.start_reconnect_loop(mock_connect))
        
        # 立即停止重连
        await asyncio.sleep(0.1)
        connection_manager.stop_reconnect()
        
        # 等待任务完成
        result = await task
        
        assert result is False
        assert connection_manager._stop_reconnect is True
        
    def test_connection_quality_calculation(self, connection_manager):
        """测试连接质量计算"""
        # 初始状态
        assert connection_manager.get_connection_quality() == 1.0
        
        # 模拟一些连接统计
        connection_manager.stats.total_connections = 10
        connection_manager.stats.successful_connections = 8
        connection_manager.stats.total_reconnects = 2
        
        quality = connection_manager.get_connection_quality()
        assert 0.0 <= quality <= 1.0
        
    def test_status_report(self, connection_manager):
        """测试状态报告"""
        report = connection_manager.get_status_report()
        
        assert 'state' in report
        assert 'reconnect_attempts' in report
        assert 'connection_quality' in report
        assert isinstance(report['connection_quality'], float)


class TestReconnectManager:
    """重连管理器测试类"""
    
    def test_reconnect_config(self):
        """测试重连配置"""
        config = ReconnectConfig(
            strategy=ReconnectStrategy.EXPONENTIAL_BACKOFF,
            max_attempts=5,
            initial_delay=2.0,
            max_delay=30.0
        )
        
        assert config.strategy == ReconnectStrategy.EXPONENTIAL_BACKOFF
        assert config.max_attempts == 5
        assert config.initial_delay == 2.0
        
    def test_delay_calculation_exponential(self):
        """测试指数退避延迟计算"""
        config = ReconnectConfig(strategy=ReconnectStrategy.EXPONENTIAL_BACKOFF)
        manager = ReconnectManager(config)
        
        manager.attempts = 1
        delay = manager.calculate_delay()
        assert delay == config.initial_delay
        
        manager.attempts = 2
        delay = manager.calculate_delay()
        assert delay == config.initial_delay * 2
        
        manager.attempts = 10  # 超过最大延迟
        delay = manager.calculate_delay()
        assert delay == config.max_delay
        
    def test_delay_calculation_linear(self):
        """测试线性退避延迟计算"""
        config = ReconnectConfig(strategy=ReconnectStrategy.LINEAR_BACKOFF)
        manager = ReconnectManager(config)
        
        manager.attempts = 1
        delay = manager.calculate_delay()
        assert delay == config.initial_delay
        
        manager.attempts = 3
        delay = manager.calculate_delay()
        assert delay == config.initial_delay * 3
        
    def test_should_reconnect(self):
        """测试是否应该重连"""
        config = ReconnectConfig(max_attempts=3)
        manager = ReconnectManager(config)
        
        manager.attempts = 2
        assert manager.should_reconnect() is True
        
        manager.attempts = 3
        assert manager.should_reconnect() is False
        
    @pytest.mark.asyncio
    async def test_successful_reconnect_execution(self):
        """测试成功的重连执行"""
        mock_connect = AsyncMock(return_value=True)
        manager = ReconnectManager()
        
        result = await manager.execute_reconnect(mock_connect)
        
        assert result is True
        assert manager.attempts == 0
        assert manager.consecutive_successes == 1
        
    @pytest.mark.asyncio
    async def test_failed_reconnect_execution(self):
        """测试失败的重连执行"""
        mock_connect = AsyncMock(side_effect=Exception("Failed"))
        manager = ReconnectManager()
        
        result = await manager.execute_reconnect(mock_connect)
        
        assert result is False
        assert manager.attempts == 1
        assert manager.consecutive_failures == 1


class TestEventHandler:
    """事件处理器测试类"""
    
    @pytest.mark.asyncio
    async def test_event_emission(self, event_handler):
        """测试事件触发"""
        events_received = []
        
        async def test_handler(event):
            events_received.append(event)
            
        # 注册处理器
        event_handler.register_handler(EventType.CONNECTION_STATE_CHANGE, test_handler)
        
        # 触发事件
        test_data = {'old_state': 'DISCONNECTED', 'new_state': 'CONNECTING'}
        await event_handler.emit_event(EventType.CONNECTION_STATE_CHANGE, test_data)
        
        # 验证事件被处理
        assert len(events_received) == 1
        assert events_received[0].event_type == EventType.CONNECTION_STATE_CHANGE
        assert events_received[0].data == test_data
        
    @pytest.mark.asyncio
    async def test_multiple_handlers(self, event_handler):
        """测试多个事件处理器"""
        handler1_calls = []
        handler2_calls = []
        
        async def handler1(event):
            handler1_calls.append(event)
            
        async def handler2(event):
            handler2_calls.append(event)
            
        # 注册多个处理器
        event_handler.register_handler(EventType.HEARTBEAT, handler1)
        event_handler.register_handler(EventType.HEARTBEAT, handler2)
        
        # 触发事件
        await event_handler.emit_event(EventType.HEARTBEAT, {'success': True})
        
        # 验证所有处理器都被调用
        assert len(handler1_calls) == 1
        assert len(handler2_calls) == 1
        
    def test_event_history(self, event_handler):
        """测试事件历史记录"""
        # 清空历史
        event_handler.clear_history()
        
        # 触发几个事件
        asyncio.run(event_handler.emit_event(EventType.HEARTBEAT, {'success': True}))
        asyncio.run(event_handler.emit_event(EventType.CONNECTION_STATE_CHANGE, {'state': 'CONNECTED'}))
        
        # 获取最近事件
        recent_events = event_handler.get_recent_events(limit=5)
        assert len(recent_events) == 2
        
        # 按类型过滤
        heartbeat_events = event_handler.get_recent_events(event_type=EventType.HEARTBEAT)
        assert len(heartbeat_events) == 1
        assert heartbeat_events[0].event_type == EventType.HEARTBEAT


class TestIntegration:
    """集成测试类"""
    
    @pytest.mark.asyncio
    async def test_integration_connection_management(self):
        """测试连接管理集成"""
        # 创建管理器实例
        conn_manager = ConnectionManager(max_reconnect_attempts=2)
        event_handler = EventHandler()
        state_monitor = ConnectionStateMonitor(event_handler)
        
        # 注册状态变更回调 - 需要异步处理
        async def async_state_callback(old_state, new_state):
            await state_monitor.on_state_change(old_state, new_state)
        conn_manager.register_state_callback(ConnectionState.CONNECTED, async_state_callback)
        
        # 模拟连接函数
        async def mock_connect():
            return True
            
        # 测试连接过程
        conn_manager.set_state(ConnectionState.CONNECTING)
        conn_manager.set_state(ConnectionState.CONNECTED)
        
        # 给事件处理一些时间
        await asyncio.sleep(0.1)
        
        # 验证状态和事件
        assert conn_manager.state == ConnectionState.CONNECTED
        assert len(event_handler.event_history) > 0
        
    @pytest.mark.asyncio
    async def test_reconnect_integration(self):
        """测试重连集成"""
        reconnect_manager = ReconnectManager(ReconnectConfig(max_attempts=2))
        conn_manager = ConnectionManager()
        
        connect_results = [False, True]  # 第一次失败，第二次成功
        connect_call_count = 0
        
        async def mock_connect():
            nonlocal connect_call_count
            result = connect_results[connect_call_count]
            connect_call_count += 1
            if not result:
                raise Exception("Connection failed")
            return result
            
        # 执行重连
        success = await reconnect_manager.execute_reconnect(mock_connect)
        assert not success  # 第一次应该失败
        
        success = await reconnect_manager.execute_reconnect(mock_connect)
        assert success  # 第二次应该成功


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])