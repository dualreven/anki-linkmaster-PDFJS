"""
WebSocket事件处理器
处理连接状态变更事件和监控事件
"""
import asyncio
import logging
import json
from typing import Dict, List, Callable, Any, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


class EventType(Enum):
    """事件类型枚举"""
    CONNECTION_STATE_CHANGE = "connection_state_change"
    RECONNECT_ATTEMPT = "reconnect_attempt"
    HEARTBEAT = "heartbeat"
    NETWORK_QUALITY_CHANGE = "network_quality_change"
    CONNECTION_ERROR = "connection_error"
    CONNECTION_STATS_UPDATE = "connection_stats_update"


@dataclass
class Event:
    """事件数据结构"""
    event_type: EventType
    timestamp: datetime
    data: Dict[str, Any]
    source: str = "websocket_connection"


class EventHandler:
    """
    事件处理器
    负责处理连接状态变更和监控事件
    """
    
    def __init__(self):
        self.event_handlers: Dict[EventType, List[Callable]] = {}
        self.event_history: List[Event] = []
        self.max_history_size = 1000
        
    def register_handler(self, event_type: EventType, handler: Callable):
        """
        注册事件处理器
        
        Args:
            event_type: 事件类型
            handler: 处理函数，应该接受一个Event对象作为参数
        """
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
        
    def unregister_handler(self, event_type: EventType, handler: Callable):
        """取消注册事件处理器"""
        if event_type in self.event_handlers:
            if handler in self.event_handlers[event_type]:
                self.event_handlers[event_type].remove(handler)
                
    async def emit_event(self, event_type: EventType, data: Dict[str, Any], source: str = "websocket_connection"):
        """
        触发事件
        
        Args:
            event_type: 事件类型
            data: 事件数据
            source: 事件来源
        """
        event = Event(
            event_type=event_type,
            timestamp=datetime.now(),
            data=data,
            source=source
        )
        
        # 保存到历史记录
        self.event_history.append(event)
        if len(self.event_history) > self.max_history_size:
            self.event_history.pop(0)
            
        # 异步调用所有注册的处理函数
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"Event handler error for {event_type}: {e}")
                    
    def get_recent_events(self, limit: int = 10, event_type: Optional[EventType] = None) -> List[Event]:
        """
        获取最近的事件
        
        Args:
            limit: 返回的事件数量
            event_type: 过滤的事件类型
            
        Returns:
            最近的事件列表
        """
        events = self.event_history[::-1]  # 反转以获取最新的事件
        
        if event_type:
            events = [e for e in events if e.event_type == event_type]
            
        return events[:limit]
    
    def clear_history(self):
        """清空事件历史"""
        self.event_history.clear()


class ConnectionStateMonitor:
    """
    连接状态监控器
    监控连接状态变化并触发相应事件
    """
    
    def __init__(self, event_handler: EventHandler):
        self.event_handler = event_handler
        self.current_state = None
        self.state_transitions = []
        
    async def on_state_change(self, old_state, new_state):
        """处理状态变更"""
        self.current_state = new_state
        self.state_transitions.append({
            'timestamp': datetime.now(),
            'from': str(old_state),
            'to': str(new_state)
        })
        
        await self.event_handler.emit_event(
            EventType.CONNECTION_STATE_CHANGE,
            {
                'old_state': str(old_state),
                'new_state': str(new_state),
                'transition_count': len(self.state_transitions)
            }
        )
        
    async def on_reconnect_attempt(self, attempt: int, total_attempts: int, delay: float):
        """处理重连尝试"""
        await self.event_handler.emit_event(
            EventType.RECONNECT_ATTEMPT,
            {
                'attempt': attempt,
                'total_attempts': total_attempts,
                'delay_seconds': delay,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def on_heartbeat(self, success: bool, latency_ms: Optional[float] = None):
        """处理心跳事件"""
        await self.event_handler.emit_event(
            EventType.HEARTBEAT,
            {
                'success': success,
                'latency_ms': latency_ms,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def on_network_quality_change(self, quality: float, reason: str = ""):
        """处理网络质量变化"""
        await self.event_handler.emit_event(
            EventType.NETWORK_QUALITY_CHANGE,
            {
                'quality': quality,
                'reason': reason,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def on_connection_error(self, error_type: str, error_message: str, details: Dict = None):
        """处理连接错误"""
        await self.event_handler.emit_event(
            EventType.CONNECTION_ERROR,
            {
                'error_type': error_type,
                'error_message': error_message,
                'details': details or {},
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def on_stats_update(self, stats: Dict[str, Any]):
        """处理统计信息更新"""
        await self.event_handler.emit_event(
            EventType.CONNECTION_STATS_UPDATE,
            {
                'stats': stats,
                'timestamp': datetime.now().isoformat()
            }
        )


class EventLogger:
    """事件日志记录器"""
    
    def __init__(self, log_level: int = logging.INFO):
        self.log_level = log_level
        
    async def log_event(self, event: Event):
        """记录事件到日志"""
        log_message = f"[{event.timestamp}] {event.event_type.value}: {json.dumps(event.data)}"
        
        if event.event_type == EventType.CONNECTION_ERROR:
            logger.error(log_message)
        elif event.event_type in [EventType.RECONNECT_ATTEMPT, EventType.HEARTBEAT]:
            logger.info(log_message)
        else:
            logger.debug(log_message)


class EventAnalytics:
    """事件分析器"""
    
    def __init__(self):
        self.analysis_data = {}
        
    async def analyze_events(self, events: List[Event]):
        """分析事件数据"""
        # 计算各种统计信息
        state_changes = [e for e in events if e.event_type == EventType.CONNECTION_STATE_CHANGE]
        reconnect_attempts = [e for e in events if e.event_type == EventType.RECONNECT_ATTEMPT]
        errors = [e for e in events if e.event_type == EventType.CONNECTION_ERROR]
        
        analysis = {
            'total_events': len(events),
            'state_changes': len(state_changes),
            'reconnect_attempts': len(reconnect_attempts),
            'errors': len(errors),
            'successful_reconnects': sum(1 for e in reconnect_attempts if e.data.get('success', False)),
            'error_types': {},
            'state_transition_patterns': []
        }
        
        # 统计错误类型
        for error in errors:
            error_type = error.data.get('error_type', 'unknown')
            analysis['error_types'][error_type] = analysis['error_types'].get(error_type, 0) + 1
            
        # 分析状态转换模式
        state_transitions = {}
        for i in range(1, len(state_changes)):
            prev_state = state_changes[i-1].data.get('new_state', 'unknown')
            current_state = state_changes[i].data.get('new_state', 'unknown')
            transition = f"{prev_state}->{current_state}"
            state_transitions[transition] = state_transitions.get(transition, 0) + 1
            
        analysis['state_transition_patterns'] = state_transitions
        
        return analysis


# 创建默认的事件处理器实例
default_event_handler = EventHandler()
default_monitor = ConnectionStateMonitor(default_event_handler)
default_logger = EventLogger()

# 注册默认的日志记录器
default_event_handler.register_handler(EventType.CONNECTION_STATE_CHANGE, default_logger.log_event)
default_event_handler.register_handler(EventType.RECONNECT_ATTEMPT, default_logger.log_event)
default_event_handler.register_handler(EventType.HEARTBEAT, default_logger.log_event)
default_event_handler.register_handler(EventType.CONNECTION_ERROR, default_logger.log_event)
default_event_handler.register_handler(EventType.NETWORK_QUALITY_CHANGE, default_logger.log_event)
default_event_handler.register_handler(EventType.CONNECTION_STATS_UPDATE, default_logger.log_event)