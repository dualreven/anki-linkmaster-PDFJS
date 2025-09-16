"""
并发控制管理器 - 实现最大并发3个分片的控制逻辑
集成到PDF管理器模块中
"""
import threading
import time
import logging
from typing import Dict, List, Optional, Set, Tuple, Callable, Any
from enum import Enum
from dataclasses import dataclass
from queue import PriorityQueue
import heapq

logger = logging.getLogger(__name__)

class RequestPriority(Enum):
    """请求优先级枚举"""
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3

@dataclass
class ChunkRequest:
    """分片请求数据结构"""
    file_id: str
    chunk_index: int
    priority: RequestPriority = RequestPriority.NORMAL
    timestamp: float = None
    callback: Optional[Callable] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
        if self.metadata is None:
            self.metadata = {}
    
    def __lt__(self, other):
        # 优先级比较：优先级高的先处理，同优先级按时间先后
        if self.priority.value != other.priority.value:
            return self.priority.value > other.priority.value
        return self.timestamp < other.timestamp

class ConcurrencyManager:
    """并发控制管理器 - 实现最大并发3个分片的控制"""
    
    def __init__(self, max_concurrent: int = 3):
        """
        初始化并发控制器
        
        Args:
            max_concurrent: 最大并发数，默认为3
        """
        self.max_concurrent = max_concurrent
        self.current_concurrent = 0
        self.request_queue = PriorityQueue()
        self.active_requests: Set[Tuple[str, int]] = set()  # (file_id, chunk_index)
        self.request_callbacks: Dict[Tuple[str, int], Callable] = {}
        self.lock = threading.RLock()
        self.processing_thread = None
        self.running = False
        
    def start(self):
        """启动并发控制器"""
        with self.lock:
            if not self.running:
                self.running = True
                self.processing_thread = threading.Thread(target=self._process_requests, daemon=True)
                self.processing_thread.start()
                logger.info("并发控制器已启动")
    
    def stop(self):
        """停止并发控制器"""
        with self.lock:
            self.running = False
            if self.processing_thread:
                self.processing_thread.join(timeout=5.0)
            logger.info("并发控制器已停止")
    
    def submit_request(self, file_id: str, chunk_index: int, 
                      priority: RequestPriority = RequestPriority.NORMAL,
                      callback: Optional[Callable] = None,
                      metadata: Optional[Dict] = None) -> bool:
        """
        提交分片处理请求
        
        Args:
            file_id: 文件ID
            chunk_index: 分片索引
            priority: 请求优先级
            callback: 处理完成后的回调函数
            metadata: 附加元数据
            
        Returns:
            bool: 提交是否成功
        """
        request = ChunkRequest(
            file_id=file_id,
            chunk_index=chunk_index,
            priority=priority,
            callback=callback,
            metadata=metadata or {}
        )
        
        with self.lock:
            request_key = (file_id, chunk_index)
            
            # 检查是否已经在处理或队列中
            if request_key in self.active_requests:
                logger.debug(f"请求已在处理中: {file_id}-{chunk_index}")
                return False
            
            # 添加到队列
            self.request_queue.put(request)
            self.request_callbacks[request_key] = callback
            logger.debug(f"请求已加入队列: {file_id}-{chunk_index}, 优先级: {priority.name}")
            
            return True
    
    def _process_requests(self):
        """处理请求的主循环"""
        while self.running:
            try:
                # 检查是否可以处理新请求
                with self.lock:
                    if self.current_concurrent >= self.max_concurrent:
                        time.sleep(0.1)  # 等待空闲槽位
                        continue
                
                # 获取下一个请求
                try:
                    request = self.request_queue.get_nowait()
                except:
                    time.sleep(0.1)
                    continue
                
                request_key = (request.file_id, request.chunk_index)
                
                with self.lock:
                    if request_key in self.active_requests:
                        self.request_queue.task_done()
                        continue
                    
                    # 开始处理
                    self.active_requests.add(request_key)
                    self.current_concurrent += 1
                
                # 异步处理请求
                threading.Thread(
                    target=self._process_single_request,
                    args=(request,),
                    daemon=True
                ).start()
                
            except Exception as e:
                logger.error(f"处理请求时发生错误: {e}")
                time.sleep(0.1)
    
    def _process_single_request(self, request: ChunkRequest):
        """处理单个分片请求"""
        request_key = (request.file_id, request.chunk_index)
        success = False
        
        try:
            logger.info(f"开始处理分片: {request.file_id}-{request.chunk_index}, 优先级: {request.priority.name}")
            
            # 模拟处理时间 - 实际应该调用chunk_manager的读取逻辑
            processing_time = 0.5 + (0.2 * (3 - request.priority.value))  # 优先级越高处理越快
            time.sleep(processing_time)
            
            # 这里应该调用实际的chunk处理逻辑
            # chunk_data = chunk_manager.read_chunk_from_file(file_path, chunk)
            
            success = True
            logger.info(f"分片处理完成: {request.file_id}-{request.chunk_index}")
            
        except Exception as e:
            logger.error(f"处理分片失败: {request.file_id}-{request.chunk_index}, 错误: {e}")
            success = False
        
        finally:
            # 清理状态
            with self.lock:
                self.active_requests.discard(request_key)
                self.current_concurrent -= 1
                self.request_queue.task_done()
            
            # 执行回调
            if request.callback:
                try:
                    request.callback(success, request.file_id, request.chunk_index, request.metadata)
                except Exception as e:
                    logger.error(f"回调函数执行失败: {e}")
    
    def get_queue_size(self) -> int:
        """获取队列大小"""
        return self.request_queue.qsize()
    
    def get_active_count(self) -> int:
        """获取当前活跃请求数"""
        with self.lock:
            return self.current_concurrent
    
    def get_active_requests(self) -> List[Tuple[str, int]]:
        """获取当前活跃的请求列表"""
        with self.lock:
            return list(self.active_requests)
    
    def clear_queue(self):
        """清空请求队列"""
        with self.lock:
            while not self.request_queue.empty():
                try:
                    self.request_queue.get_nowait()
                    self.request_queue.task_done()
                except:
                    break
            self.request_callbacks.clear()
            logger.info("请求队列已清空")
    
    def wait_all_completed(self, timeout: Optional[float] = None) -> bool:
        """
        等待所有请求完成
        
        Args:
            timeout: 超时时间（秒）
            
        Returns:
            bool: 是否所有请求都已完成
        """
        start_time = time.time()
        
        while True:
            with self.lock:
                queue_empty = self.request_queue.empty()
                no_active = self.current_concurrent == 0
            
            if queue_empty and no_active:
                return True
            
            if timeout and (time.time() - start_time) > timeout:
                return False
            
            time.sleep(0.1)

# 单例实例
concurrency_manager = ConcurrencyManager()