"""
WebSocket重连策略模块
提供多种重连策略和算法
"""
import asyncio
import logging
import random
from enum import Enum, auto
from typing import Callable, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


class ReconnectStrategy(Enum):
    """重连策略枚举"""
    EXPONENTIAL_BACKOFF = auto()      # 指数退避
    LINEAR_BACKOFF = auto()           # 线性退避  
    FIXED_INTERVAL = auto()           # 固定间隔
    RANDOM_JITTER = auto()            # 随机抖动
    ADAPTIVE = auto()                 # 自适应策略


@dataclass
class ReconnectConfig:
    """重连配置"""
    strategy: ReconnectStrategy = ReconnectStrategy.EXPONENTIAL_BACKOFF
    max_attempts: int = 10
    initial_delay: float = 1.0
    max_delay: float = 60.0
    jitter_factor: float = 0.1
    success_threshold: int = 3        # 连续成功次数阈值
    failure_threshold: int = 3         # 连续失败次数阈值


class ReconnectManager:
    """
    重连管理器
    实现多种重连策略和智能重连算法
    """
    
    def __init__(self, config: Optional[ReconnectConfig] = None):
        self.config = config or ReconnectConfig()
        self.attempts = 0
        self.consecutive_successes = 0
        self.consecutive_failures = 0
        self.last_attempt_time: Optional[datetime] = None
        self.current_delay = self.config.initial_delay
        
    def reset(self):
        """重置重连状态"""
        self.attempts = 0
        self.consecutive_successes = 0
        self.consecutive_failures = 0
        self.current_delay = self.config.initial_delay
        
    def record_success(self):
        """记录成功连接"""
        self.consecutive_successes += 1
        self.consecutive_failures = 0
        self.attempts = 0
        self.current_delay = self.config.initial_delay
        
        # 自适应调整：如果连续成功，可以适当减少初始延迟
        if self.consecutive_successes >= self.config.success_threshold:
            self.config.initial_delay = max(0.5, self.config.initial_delay * 0.8)
            
    def record_failure(self):
        """记录连接失败"""
        self.attempts += 1
        self.consecutive_failures += 1
        self.consecutive_successes = 0
        
        # 自适应调整：如果连续失败，可以适当增加初始延迟
        if self.consecutive_failures >= self.config.failure_threshold:
            self.config.initial_delay = min(self.config.max_delay, self.config.initial_delay * 1.2)
    
    def calculate_delay(self) -> float:
        """
        计算下一次重连的延迟时间
        基于选择的策略
        """
        if self.attempts == 0:
            return 0
            
        if self.config.strategy == ReconnectStrategy.EXPONENTIAL_BACKOFF:
            delay = min(self.config.initial_delay * (2 ** (self.attempts - 1)), 
                       self.config.max_delay)
            
        elif self.config.strategy == ReconnectStrategy.LINEAR_BACKOFF:
            delay = min(self.config.initial_delay * self.attempts, 
                       self.config.max_delay)
            
        elif self.config.strategy == ReconnectStrategy.FIXED_INTERVAL:
            delay = self.config.initial_delay
            
        elif self.config.strategy == ReconnectStrategy.RANDOM_JITTER:
            base_delay = min(self.config.initial_delay * (2 ** (self.attempts - 1)), 
                           self.config.max_delay)
            jitter = base_delay * self.config.jitter_factor * random.uniform(-1, 1)
            delay = max(0.1, base_delay + jitter)
            
        elif self.config.strategy == ReconnectStrategy.ADAPTIVE:
            # 自适应策略：基于网络状况动态调整
            if self.consecutive_failures > 0:
                # 失败越多，延迟越长
                delay = min(self.config.initial_delay * (2 ** (self.consecutive_failures - 1)),
                           self.config.max_delay)
            else:
                delay = self.config.initial_delay
                
        else:
            delay = self.config.initial_delay
            
        return round(delay, 2)
    
    def should_reconnect(self) -> bool:
        """判断是否应该继续重连"""
        return self.attempts < self.config.max_attempts
    
    async def execute_reconnect(self, connect_func: Callable) -> bool:
        """
        执行重连操作
        
        Args:
            connect_func: 连接函数，应该返回一个可等待对象
            
        Returns:
            bool: 重连是否成功
        """
        if not self.should_reconnect():
            return False
            
        delay = self.calculate_delay()
        if delay > 0:
            logger.info(f"Waiting {delay:.2f}s before reconnect attempt {self.attempts + 1}")
            await asyncio.sleep(delay)
            
        try:
            self.last_attempt_time = datetime.now()
            result = await connect_func()
            self.record_success()
            return True
            
        except Exception as e:
            logger.warning(f"Reconnect attempt {self.attempts + 1} failed: {e}")
            self.record_failure()
            return False


class SmartReconnectStrategy:
    """
    智能重连策略
    基于网络状况、历史成功率等因素动态调整重连参数
    """
    
    def __init__(self):
        self.history = []  # 存储连接历史记录
        self.network_quality = 1.0  # 网络质量评分(0.0-1.0)
        
    def analyze_network_conditions(self):
        """分析网络状况"""
        # 这里可以集成更多的网络检测逻辑
        # 例如：ping测试、带宽检测等
        pass
        
    def optimize_strategy(self):
        """优化重连策略"""
        # 基于历史数据优化重连参数
        if len(self.history) > 10:
            success_rate = sum(1 for h in self.history if h['success']) / len(self.history)
            
            # 根据成功率调整策略
            if success_rate < 0.3:
                # 网络状况差，使用更保守的策略
                return ReconnectStrategy.EXPONENTIAL_BACKOFF
            elif success_rate < 0.7:
                # 中等网络状况，使用自适应策略
                return ReconnectStrategy.ADAPTIVE
            else:
                # 网络状况好，使用激进策略
                return ReconnectStrategy.RANDOM_JITTER
        return ReconnectStrategy.EXPONENTIAL_BACKOFF


class ConnectionHealthMonitor:
    """连接健康度监控器"""
    
    def __init__(self):
        self.latency_history = []
        self.packet_loss_history = []
        self.health_score = 100  # 健康度评分(0-100)
        
    def update_latency(self, latency_ms: float):
        """更新延迟数据"""
        self.latency_history.append(latency_ms)
        if len(self.latency_history) > 100:
            self.latency_history.pop(0)
            
    def update_packet_loss(self, loss_rate: float):
        """更新丢包率数据"""
        self.packet_loss_history.append(loss_rate)
        if len(self.packet_loss_history) > 100:
            self.packet_loss_history.pop(0)
            
    def calculate_health_score(self) -> int:
        """计算连接健康度评分"""
        if not self.latency_history:
            return 100
            
        avg_latency = sum(self.latency_history) / len(self.latency_history)
        avg_loss = sum(self.packet_loss_history) / len(self.packet_loss_history) if self.packet_loss_history else 0
        
        # 简单的健康度计算逻辑
        latency_score = max(0, 100 - (avg_latency / 10))  # 每10ms延迟扣1分
        loss_score = max(0, 100 - (avg_loss * 100))       # 每1%丢包扣1分
        
        self.health_score = int((latency_score + loss_score) / 2)
        return self.health_score


# 工厂函数，用于创建重连管理器
def create_reconnect_manager(strategy: ReconnectStrategy = ReconnectStrategy.EXPONENTIAL_BACKOFF,
                           max_attempts: int = 10,
                           initial_delay: float = 1.0,
                           max_delay: float = 60.0) -> ReconnectManager:
    """
    创建重连管理器实例
    
    Args:
        strategy: 重连策略
        max_attempts: 最大尝试次数
        initial_delay: 初始延迟
        max_delay: 最大延迟
        
    Returns:
        ReconnectManager实例
    """
    config = ReconnectConfig(
        strategy=strategy,
        max_attempts=max_attempts,
        initial_delay=initial_delay,
        max_delay=max_delay
    )
    return ReconnectManager(config)