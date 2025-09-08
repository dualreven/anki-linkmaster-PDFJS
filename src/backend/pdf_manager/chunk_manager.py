"""
PDF文件分片管理器
负责将PDF文件按照1MB标准进行分片处理
"""

import os
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

# 1MB分片标准大小（1048576字节）
CHUNK_SIZE = 1048576

# 导入并发控制相关的枚举
from .concurrency_manager import RequestPriority

class ChunkStatus(Enum):
    """分片状态枚举"""
    PENDING = "pending"      # 等待处理
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"   # 已完成
    ERROR = "error"          # 错误


@dataclass
class FileChunk:
    """文件分片数据类"""
    file_id: str
    chunk_index: int
    start_offset: int
    end_offset: int
    size: int
    data: Optional[bytes] = None
    status: ChunkStatus = ChunkStatus.PENDING
    checksum: Optional[str] = None
    timestamp: Optional[float] = None


class ChunkManager:
    """PDF文件分片管理器 - 集成并发控制"""
    
    def __init__(self, chunk_size: int = CHUNK_SIZE, max_concurrent: int = 3):
        """
        初始化分片管理器
        
        Args:
            chunk_size: 分片大小（字节），默认为1MB
            max_concurrent: 最大并发数，默认为3
        """
        self.chunk_size = chunk_size
        self.max_concurrent = max_concurrent
        self.chunk_cache: Dict[str, Dict[int, FileChunk]] = {}
        self.active_chunks: Dict[str, set] = {}
        
        # 导入并发管理器
        from .concurrency_manager import concurrency_manager
        self.concurrency_manager = concurrency_manager
        self.concurrency_manager.start()
        
    def calculate_chunks(self, file_size: int) -> List[Tuple[int, int]]:
        """
        计算文件的分片信息
        
        Args:
            file_size: 文件大小（字节）
            
        Returns:
            List[Tuple[int, int]]: 分片列表，每个元组包含(起始偏移量, 结束偏移量)
        """
        if file_size <= 0:
            return []
            
        chunks = []
        total_chunks = math.ceil(file_size / self.chunk_size)
        
        for i in range(total_chunks):
            start_offset = i * self.chunk_size
            end_offset = min((i + 1) * self.chunk_size, file_size)
            chunks.append((start_offset, end_offset))
            
        return chunks
    
    def create_chunks_for_file(self, file_id: str, file_size: int) -> List[FileChunk]:
        """
        为文件创建分片信息
        
        Args:
            file_id: 文件ID
            file_size: 文件大小（字节）
            
        Returns:
            List[FileChunk]: 分片对象列表
        """
        chunks_info = self.calculate_chunks(file_size)
        chunks = []
        
        for index, (start_offset, end_offset) in enumerate(chunks_info):
            chunk_size = end_offset - start_offset
            
            chunk = FileChunk(
                file_id=file_id,
                chunk_index=index,
                start_offset=start_offset,
                end_offset=end_offset,
                size=chunk_size,
                status=ChunkStatus.PENDING
            )
            chunks.append(chunk)
            
        # 初始化文件的分片缓存
        self.chunk_cache[file_id] = {chunk.chunk_index: chunk for chunk in chunks}
        
        logger.info(f"为文件 {file_id} 创建了 {len(chunks)} 个分片，文件大小: {file_size} 字节")
        return chunks
    
    def read_chunk_from_file(self, file_path: str, chunk: FileChunk,
                           priority: RequestPriority = RequestPriority.NORMAL) -> FileChunk:
        """
        从文件中读取指定分片的数据 - 支持并发控制和优先级调度
        
        Args:
            file_path: 文件路径
            chunk: 分片对象
            priority: 请求优先级
            
        Returns:
            FileChunk: 包含数据的更新后分片对象
        """
        try:
            # 如果有并发管理器，使用并发控制
            if self.concurrency_manager:
                # 创建回调函数
                def chunk_callback(success, file_id, chunk_index, metadata):
                    if success:
                        logger.debug(f"并发处理完成: {file_id}-{chunk_index}")
                    else:
                        logger.error(f"并发处理失败: {file_id}-{chunk_index}")
                
                # 提交到并发管理器
                submitted = self.concurrency_manager.submit_request(
                    file_path, chunk.chunk_index, priority, chunk_callback,
                    {"chunk": chunk}
                )
                
                if not submitted:
                    logger.warning(f"分片请求已在处理中: {file_path}-{chunk.chunk_index}")
                    return chunk
            
            # 直接处理（如果没有并发管理器或请求已在处理）
            return self._read_chunk_direct(file_path, chunk)
                
        except Exception as e:
            chunk.status = ChunkStatus.ERROR
            logger.error(f"读取分片失败: {e}")
            raise
    
    def _read_chunk_direct(self, file_path: str, chunk: FileChunk) -> FileChunk:
        """
        直接读取分片数据（内部方法）
        """
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件不存在: {file_path}")
                
            chunk.status = ChunkStatus.PROCESSING
            
            with open(file_path, 'rb') as f:
                f.seek(chunk.start_offset)
                chunk_data = f.read(chunk.size)
                
                if len(chunk_data) != chunk.size:
                    raise IOError(f"读取数据大小不匹配: 期望 {chunk.size}, 实际 {len(chunk_data)}")
                
                chunk.data = chunk_data
                chunk.status = ChunkStatus.COMPLETED
                chunk.timestamp = os.path.getmtime(file_path)
                
                # 计算校验和
                chunk.checksum = self._calculate_checksum(chunk_data)
                
                # 更新缓存
                if file_path not in self.chunk_cache:
                    self.chunk_cache[file_path] = {}
                self.chunk_cache[file_path][chunk.chunk_index] = chunk
                
                logger.debug(f"成功读取分片 {chunk.chunk_index}，大小: {chunk.size} 字节")
                return chunk
                
        except Exception as e:
            chunk.status = ChunkStatus.ERROR
            logger.error(f"直接读取分片失败: {e}")
            raise
    
    def read_all_chunks(self, file_path: str) -> List[FileChunk]:
        """
        读取文件的所有分片
        
        Args:
            file_path: 文件路径
            
        Returns:
            List[FileChunk]: 所有分片对象列表
        """
        try:
            file_size = os.path.getsize(file_path)
            chunks = self.create_chunks_for_file(file_path, file_size)
            
            results = []
            for chunk in chunks:
                try:
                    processed_chunk = self.read_chunk_from_file(file_path, chunk)
                    results.append(processed_chunk)
                except Exception as e:
                    logger.warning(f"读取分片 {chunk.chunk_index} 失败: {e}")
                    results.append(chunk)  # 保持错误状态的分片
                    
            return results
            
        except Exception as e:
            logger.error(f"读取所有分片失败: {e}")
            raise
    
    def get_chunk(self, file_path: str, chunk_index: int) -> Optional[FileChunk]:
        """
        获取指定分片
        
        Args:
            file_path: 文件路径
            chunk_index: 分片索引
            
        Returns:
            Optional[FileChunk]: 分片对象，如果不存在返回None
        """
        # 检查缓存
        if file_path in self.chunk_cache and chunk_index in self.chunk_cache[file_path]:
            return self.chunk_cache[file_path][chunk_index]
            
        # 如果不在缓存中，尝试读取
        try:
            file_size = os.path.getsize(file_path)
            chunks_info = self.calculate_chunks(file_size)
            
            if chunk_index < 0 or chunk_index >= len(chunks_info):
                return None
                
            start_offset, end_offset = chunks_info[chunk_index]
            chunk_size = end_offset - start_offset
            
            chunk = FileChunk(
                file_id=file_path,
                chunk_index=chunk_index,
                start_offset=start_offset,
                end_offset=end_offset,
                size=chunk_size,
                status=ChunkStatus.PENDING
            )
            
            return self.read_chunk_from_file(file_path, chunk)
            
        except Exception as e:
            logger.error(f"获取分片失败: {e}")
            return None
    
    def reassemble_file(self, chunks: List[FileChunk], output_path: str) -> bool:
        """
        重新组装分片为完整文件
        
        Args:
            chunks: 分片对象列表
            output_path: 输出文件路径
            
        Returns:
            bool: 组装成功返回True
        """
        try:
            # 按分片索引排序
            sorted_chunks = sorted(chunks, key=lambda x: x.chunk_index)
            
            # 验证分片连续性
            expected_start = 0
            for chunk in sorted_chunks:
                if chunk.start_offset != expected_start:
                    raise ValueError(f"分片不连续: 期望起始偏移 {expected_start}, 实际 {chunk.start_offset}")
                expected_start = chunk.end_offset
            
            # 写入文件
            with open(output_path, 'wb') as f:
                for chunk in sorted_chunks:
                    if chunk.data is None:
                        raise ValueError(f"分片 {chunk.chunk_index} 缺少数据")
                    f.write(chunk.data)
            
            # 验证文件大小
            expected_size = sum(chunk.size for chunk in sorted_chunks)
            actual_size = os.path.getsize(output_path)
            
            if expected_size != actual_size:
                raise ValueError(f"文件大小不匹配: 期望 {expected_size}, 实际 {actual_size}")
                
            logger.info(f"文件重组成功: {output_path}, 大小: {actual_size} 字节")
            return True
            
        except Exception as e:
            logger.error(f"文件重组失败: {e}")
            return False
    
    def validate_chunk_sequence(self, chunks: List[FileChunk]) -> bool:
        """
        验证分片序列的连续性
        
        Args:
            chunks: 分片对象列表
            
        Returns:
            bool: 序列连续返回True
        """
        if not chunks:
            return False
            
        sorted_chunks = sorted(chunks, key=lambda x: x.chunk_index)
        
        # 检查索引连续性
        for i in range(len(sorted_chunks)):
            if sorted_chunks[i].chunk_index != i:
                return False
                
        # 检查偏移量连续性
        expected_start = 0
        for chunk in sorted_chunks:
            if chunk.start_offset != expected_start:
                return False
            expected_start = chunk.end_offset
            
        return True
    
    def get_chunk_info(self, file_path: str) -> Dict[str, Any]:
        """
        获取文件的分片信息
        
        Args:
            file_path: 文件路径
            
        Returns:
            Dict[str, Any]: 分片信息字典
        """
        try:
            file_size = os.path.getsize(file_path)
            chunks_info = self.calculate_chunks(file_size)
            
            return {
                "file_path": file_path,
                "file_size": file_size,
                "chunk_size": self.chunk_size,
                "total_chunks": len(chunks_info),
                "chunks": [
                    {
                        "index": i,
                        "start_offset": start,
                        "end_offset": end,
                        "size": end - start
                    }
                    for i, (start, end) in enumerate(chunks_info)
                ]
            }
            
        except Exception as e:
            logger.error(f"获取分片信息失败: {e}")
            return {}
    
    def clear_cache(self, file_path: Optional[str] = None):
        """
        清理缓存
        
        Args:
            file_path: 文件路径，如果为None则清理所有缓存
        """
        if file_path:
            if file_path in self.chunk_cache:
                del self.chunk_cache[file_path]
        else:
            self.chunk_cache.clear()
            
        logger.debug("分片缓存已清理")
    
    def _calculate_checksum(self, data: bytes) -> str:
        """
        计算数据的校验和
        
        Args:
            data: 二进制数据
            
        Returns:
            str: 校验和字符串
        """
        import hashlib
        return hashlib.md5(data).hexdigest()
    
    def verify_chunk_integrity(self, chunk: FileChunk) -> bool:
        """
        验证分片完整性
        
        Args:
            chunk: 分片对象
            
        Returns:
            bool: 完整性验证通过返回True
        """
        if chunk.data is None:
            return False
            
        # 检查数据大小
        if len(chunk.data) != chunk.size:
            return False
            
        # 检查校验和
        if chunk.checksum:
            current_checksum = self._calculate_checksum(chunk.data)
            if current_checksum != chunk.checksum:
                return False
                
        return True
    
    def get_concurrency_stats(self) -> Dict[str, Any]:
        """
        获取并发统计信息
        
        Returns:
            Dict: 并发统计信息
        """
        if self.concurrency_manager:
            return {
                "max_concurrent": self.max_concurrent,
                "queue_size": self.concurrency_manager.get_queue_size(),
                "active_count": self.concurrency_manager.get_active_count(),
                "active_requests": self.concurrency_manager.get_active_requests()
            }
        else:
            return {
                "max_concurrent": self.max_concurrent,
                "concurrency_manager": "not_available"
            }
    
    def wait_all_chunks_completed(self, timeout: Optional[float] = None) -> bool:
        """
        等待所有分片处理完成
        
        Args:
            timeout: 超时时间（秒）
            
        Returns:
            bool: 是否所有分片都已完成处理
        """
        if self.concurrency_manager:
            return self.concurrency_manager.wait_all_completed(timeout)
        return True


# 单例实例
chunk_manager = ChunkManager(max_concurrent=3)