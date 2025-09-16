"""
WebSocket连接稳定性测试
测试连接管理器的稳定性和可靠性
"""
import pytest
import asyncio
import logging
import random
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta

from backend.websocket.connection_manager import ConnectionManager, ConnectionState
from backend.websocket.reconnect_strategy import ReconnectManager, ReconnectConfig
from backend.websocket.event_handler import EventHandler


class TestStability:
    """稳定性测试类"""
    
    @pytest.mark.asyncio
    async def test_long_running_connection_stability(self):
        """
        测试长时间运行的连接稳定性
        模拟24小时运行的连接，随机出现断开和重连
        """
        conn_manager = ConnectionManager(max_reconnect_attempts=10)
        event_handler = EventHandler()
        
        # 记录状态变更历史
        state_history = []
        conn_manager.register_state_callback(ConnectionState.CONNECTED, 
                                           lambda old, new: state_history.append(('connected', datetime.now())))
        conn_manager.register_state_callback(ConnectionState.DISCONNECTED, 
                                           lambda old, new: state_history.append(('disconnected', datetime.now())))
        
        # 模拟连接函数 - 90%成功率
        async def mock_connect():
            await asyncio.sleep(0.1)  # 模拟连接延迟
            if random.random() < 0.9:  # 90%成功率
                return True
            else:
                raise Exception("Random connection failure")
                
        # 运行测试一段时间（模拟24小时）
        test_duration = 5.0  # 实际测试中可以使用更长时间
        start_time = datetime.now()
        
        while (datetime.now() - start_time).total_seconds() < test_duration:
            try:
                # 随机决定是否断开连接
                if random.random() < 0.05:  # 5%的概率断开
                    conn_manager.set_state(ConnectionState.DISCONNECTED)
                    await asyncio.sleep(0.5)
                
                # 尝试连接或重连
                if conn_manager.state == ConnectionState.DISCONNECTED:
                    await conn_manager.start_reconnect_loop(mock_connect)
                    
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logging.warning(f"Stability test error: {e}")
                continue
        
        # 验证统计信息
        stats = conn_manager.get_status_report()
        assert stats['total_connections'] > 0
        assert stats['successful_connections'] > 0
        assert 0.0 <= stats['connection_quality'] <= 1.0
        
        # 验证状态历史记录
        assert len(state_history) >= 2  # 至少有一次状态变更
        
    @pytest.mark.asyncio
    async def test_high_failure_rate_recovery(self):
        """
        测试高失败率下的恢复能力
        模拟网络状况极差的情况
        """
        conn_manager = ConnectionManager(max_reconnect_attempts=20)
        
        # 模拟高失败率的连接函数
        failure_count = 0
        async def mock_connect():
            nonlocal failure_count
            failure_count += 1
            if failure_count < 15:  # 前15次都失败
                raise Exception("Network congestion")
            return True
            
        # 执行重连
        result = await conn_manager.start_reconnect_loop(mock_connect)
        
        # 验证最终成功连接
        assert result is True
        assert conn_manager.state == ConnectionState.CONNECTED
        assert conn_manager.reconnect_attempts == 0
        
    @pytest.mark.asyncio
    async def test_concurrent_reconnect_attempts(self):
        """
        测试并发重连尝试
        确保重连机制在并发场景下的稳定性
        """
        conn_manager = ConnectionManager(max_reconnect_attempts=5)
        
        connect_calls = 0
        async def mock_connect():
            nonlocal connect_calls
            connect_calls += 1
            await asyncio.sleep(0.1)
            return True
            
        # 并发执行多个重连任务
        tasks = []
        for _ in range(3):
            task = asyncio.create_task(conn_manager.start_reconnect_loop(mock_connect))
            tasks.append(task)
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 验证只有一个连接成功建立
        successful_connections = sum(1 for r in results if r is True)
        assert successful_connections == 1
        assert conn_manager.state == ConnectionState.CONNECTED
        
    @pytest.mark.asyncio
    async def test_memory_usage_stability(self):
        """
        测试内存使用稳定性
        长时间运行不应该有内存泄漏
        """
        event_handler = EventHandler()
        
        # 生成大量事件
        for i in range(1000):
            await event_handler.emit_event(
                'test_event',
                {'index': i, 'data': 'x' * 100}  # 添加一些数据量
            )
            
        # 验证历史记录大小限制
        recent_events = event_handler.get_recent_events(limit=2000)
        assert len(recent_events) <= 1000  # 不应该超过最大历史大小
        
    @pytest.mark.asyncio
    async def test_network_condition_changes(self):
        """
        测试网络状况变化时的适应性
        模拟网络状况从好变差再变好的情况
        """
        conn_manager = ConnectionManager()
        reconnect_manager = ReconnectManager()
        
        # 模拟变化的网络状况
        network_conditions = [
            (0.9, 10),   # 90%成功率，持续10次
            (0.3, 5),    # 30%成功率，持续5次  
            (0.8, 8),    # 80%成功率，持续8次
        ]
        
        current_condition = 0
        condition_count = 0
        
        async def mock_connect():
            nonlocal current_condition, condition_count
            success_rate, max_count = network_conditions[current_condition]
            
            condition_count += 1
            if condition_count >= max_count:
                current_condition = (current_condition + 1) % len(network_conditions)
                condition_count = 0
                
            if random.random() < success_rate:
                return True
            else:
                raise Exception("Connection failed")
                
        # 运行多个重连周期
        for _ in range(3):
            await reconnect_manager.execute_reconnect(mock_connect)
            await asyncio.sleep(0.1)
            
        # 验证自适应调整
        assert reconnect_manager.consecutive_successes > 0 or reconnect_manager.consecutive_failures > 0
        
    @pytest.mark.asyncio
    async def test_edge_cases(self):
        """
        测试边界情况
        """
        conn_manager = ConnectionManager(max_reconnect_attempts=0)
        
        # 测试最大重连次数为0的情况
        async def mock_connect():
            return True
            
        result = await conn_manager.start_reconnect_loop(mock_connect)
        assert result is False
        
        # 测试立即停止重连
        conn_manager = ConnectionManager(max_reconnect_attempts=10)
        conn_manager.stop_reconnect()
        result = await conn_manager.start_reconnect_loop(mock_connect)
        assert result is False


class TestPerformance:
    """性能测试类"""
    
    @pytest.mark.asyncio
    async def test_reconnect_performance(self):
        """
        测试重连性能
        测量重连操作的耗时
        """
        conn_manager = ConnectionManager()
        
        async def fast_connect():
            return True
            
        async def slow_connect():
            await asyncio.sleep(0.5)
            return True
            
        # 测试快速连接
        start_time = datetime.now()
        result = await conn_manager.start_reconnect_loop(fast_connect)
        fast_duration = (datetime.now() - start_time).total_seconds()
        
        assert result is True
        assert fast_duration < 1.0  # 应该很快完成
        
        # 测试慢速连接
        conn_manager.set_state(ConnectionState.DISCONNECTED)
        start_time = datetime.now()
        result = await conn_manager.start_reconnect_loop(slow_connect)
        slow_duration = (datetime.now() - start_time).total_seconds()
        
        assert result is True
        assert slow_duration >= 0.5  # 应该包含等待时间
        
    @pytest.mark.asyncio
    async def test_event_handling_performance(self):
        """
        测试事件处理性能
        测量大量事件的处理速度
        """
        event_handler = EventHandler()
        
        # 清空历史记录
        event_handler.clear_history()
        
        # 生成并处理大量事件
        start_time = datetime.now()
        
        for i in range(100):
            await event_handler.emit_event('test_event', {'index': i})
            
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # 验证处理速度
        assert duration < 1.0  # 100个事件应该在1秒内处理完
        assert len(event_handler.event_history) == 100


@pytest.mark.stress
class TestStress:
    """压力测试类"""
    
    @pytest.mark.asyncio
    async def test_stress_high_frequency_events(self):
        """
        压力测试：高频事件处理
        """
        event_handler = EventHandler()
        
        # 快速连续触发大量事件
        tasks = []
        for i in range(500):
            task = asyncio.create_task(
                event_handler.emit_event('stress_test', {'id': i})
            )
            tasks.append(task)
            
        await asyncio.gather(*tasks)
        
        # 验证所有事件都被处理
        recent_events = event_handler.get_recent_events(limit=1000)
        assert len(recent_events) == 500
        
    @pytest.mark.asyncio
    async def test_stress_concurrent_connections(self):
        """
        压力测试：并发连接管理
        """
        managers = []
        results = []
        
        # 创建多个连接管理器并发运行
        for i in range(10):
            manager = ConnectionManager(max_reconnect_attempts=3)
            managers.append(manager)
            
            async def mock_connect():
                await asyncio.sleep(0.1)
                return True
                
            task = asyncio.create_task(manager.start_reconnect_loop(mock_connect))
            results.append(task)
            
        # 等待所有任务完成
        await asyncio.gather(*results)
        
        # 验证所有管理器都达到连接状态
        for manager in managers:
            assert manager.state == ConnectionState.CONNECTED


if __name__ == "__main__":
    # 运行稳定性测试
    pytest.main([__file__, "-v", "-m", "not stress"])