"""
WebSocket连接状态管理器
提供完整的连接状态管理、自动重连机制和连接监控功能
"""
import asyncio
import logging
import time
from enum import Enum, auto
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ConnectionState(Enum):
    """连接状态枚举"""
    DISCONNECTED = auto()      # 断开连接
    CONNECTING = auto()        # 正在连接
    CONNECTED = auto()         # 已连接
    RECONNECTING = auto()      # 正在重连
    ERROR = auto()            # 错误状态


@dataclass
class ConnectionStats:
    """连接统计信息"""
    total_connections: int = 0
    successful_connections: int = 0
    failed_connections: int = 0
    total_reconnects: int = 0
    last_connection_time: Optional[datetime] = None
    last_disconnection_time: Optional[datetime] = None
    uptime: timedelta = timedelta(0)


class ConnectionManager:
    """
    WebSocket连接状态管理器
    提供连接状态管理、自动重连和监控功能
    """
    
    def __init__(self, max_reconnect_attempts: int = 10, 
                 initial_reconnect_delay: float = 1.0,
                 max_reconnect_delay: float = 60.0):
        """
        初始化连接管理器
        
        Args:
            max_reconnect_attempts: 最大重连尝试次数
            initial_reconnect_delay: 初始重连延迟(秒)
            max_reconnect_delay: 最大重连延迟(秒)
        """
        self.state = ConnectionState.DISCONNECTED
        self.stats = ConnectionStats()
        self.max_reconnect_attempts = max_reconnect_attempts
        self.initial_reconnect_delay = initial_reconnect_delay
        self.max_reconnect_delay = max_reconnect_delay
        self.reconnect_attempts = 0
        self.reconnect_delay = initial_reconnect_delay
        self.connection_start_time: Optional[datetime] = None
        self.state_change_callbacks: Dict[ConnectionState, list] = {}
        self._reconnect_task: Optional[asyncio.Task] = None
        self._stop_reconnect = False
        
    def register_state_callback(self, state: ConnectionState, callback: Callable):
        """
        注册状态变更回调函数
        
        Args:
            state: 要监听的状态
            callback: 回调函数
        """
        if state not in self.state_change_callbacks:
            self.state_change_callbacks[state] = []
        self.state_change_callbacks[state].append(callback)
        
    def _notify_state_change(self, old_state: ConnectionState, new_state: ConnectionState):
        """通知状态变更"""
        if new_state in self.state_change_callbacks:
            for callback in self.state_change_callbacks[new_state]:
                try:
                    callback(old_state, new_state)
                except Exception as e:
                    logger.error(f"State change callback error: {e}")
    
    def set_state(self, new_state: ConnectionState):
        """设置连接状态"""
        old_state = self.state
        self.state = new_state
        self._notify_state_change(old_state, new_state)
        
        # 更新统计信息
        if new_state == ConnectionState.CONNECTED:
            self.connection_start_time = datetime.now()
            self.stats.successful_connections += 1
            self.stats.last_connection_time = datetime.now()
            self.reconnect_attempts = 0
            self.reconnect_delay = self.initial_reconnect_delay
        elif new_state == ConnectionState.DISCONNECTED:
            if self.connection_start_time:
                self.stats.uptime += datetime.now() - self.connection_start_time
                self.connection_start_time = None
            self.stats.last_disconnection_time = datetime.now()
        elif new_state == ConnectionState.RECONNECTING:
            self.stats.total_reconnects += 1
    
    async def start_reconnect_loop(self, connect_func: Callable):
        """
        启动自动重连循环
        
        Args:
            connect_func: 连接函数，应该返回一个可等待对象
        """
        self._stop_reconnect = False
        self.reconnect_attempts = 0
        
        while not self._stop_reconnect and self.reconnect_attempts < self.max_reconnect_attempts:
            try:
                logger.info(f"Attempting reconnect {self.reconnect_attempts + 1}/{self.max_reconnect_attempts}")
                self.set_state(ConnectionState.RECONNECTING)
                
                await connect_func()
                logger.info("Reconnect successful")
                self.set_state(ConnectionState.CONNECTED)
                return True
                
            except Exception as e:
                logger.warning(f"Reconnect attempt {self.reconnect_attempts + 1} failed: {e}")
                self.reconnect_attempts += 1
                self.stats.failed_connections += 1
                
                # 指数退避策略
                delay = min(self.reconnect_delay * (2 ** (self.reconnect_attempts - 1)), 
                           self.max_reconnect_delay)
                logger.info(f"Waiting {delay:.2f}s before next reconnect attempt")
                await asyncio.sleep(delay)
        
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Max reconnect attempts reached")
            self.set_state(ConnectionState.ERROR)
            return False
        
        return True
    
    def stop_reconnect(self):
        """停止重连循环"""
        self._stop_reconnect = True
        if self._reconnect_task:
            self._reconnect_task.cancel()
    
    def get_connection_quality(self) -> float:
        """
        获取连接质量评分(0.0-1.0)
        基于连接成功率、重连次数等因素计算
        """
        if self.stats.total_connections == 0:
            return 1.0
            
        success_rate = self.stats.successful_connections / self.stats.total_connections
        reconnect_penalty = min(self.stats.total_reconnects / 10, 0.5)  # 最多扣0.5分
        
        quality = max(0.0, min(1.0, success_rate - reconnect_penalty))
        return round(quality, 2)
    
    def get_status_report(self) -> Dict[str, Any]:
        """获取连接状态报告"""
        return {
            "state": self.state.name,
            "reconnect_attempts": self.reconnect_attempts,
            "max_reconnect_attempts": self.max_reconnect_attempts,
            "total_connections": self.stats.total_connections,
            "successful_connections": self.stats.successful_connections,
            "failed_connections": self.stats.failed_connections,
            "total_reconnects": self.stats.total_reconnects,
            "connection_quality": self.get_connection_quality(),
            "last_connection_time": self.stats.last_connection_time.isoformat() if self.stats.last_connection_time else None,
            "last_disconnection_time": self.stats.last_disconnection_time.isoformat() if self.stats.last_disconnection_time else None,
            "uptime": str(self.stats.uptime),
            "current_reconnect_delay": self.reconnect_delay
        }


class ConnectionMonitor:
    """连接监控器，用于监控连接健康状况"""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.heartbeat_interval = 30  # 心跳间隔(秒)
        self.max_missed_heartbeats = 3
        self.missed_heartbeats = 0
        self._monitor_task: Optional[asyncio.Task] = None
        
    async def start_monitoring(self, heartbeat_func: Callable):
        """启动连接监控"""
        while True:
            try:
                # 发送心跳
                if await heartbeat_func():
                    self.missed_heartbeats = 0
                else:
                    self.missed_heartbeats += 1
                    logger.warning(f"Heartbeat missed ({self.missed_heartbeats}/{self.max_missed_heartbeats})")
                
                # 检查连接健康状况
                if self.missed_heartbeats >= self.max_missed_heartbeats:
                    logger.error("Connection appears to be dead")
                    self.connection_manager.set_state(ConnectionState.ERROR)
                    break
                    
                await asyncio.sleep(self.heartbeat_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(self.heartbeat_interval)
    
    def stop_monitoring(self):
        """停止监控"""
        if self._monitor_task:
            self._monitor_task.cancel()