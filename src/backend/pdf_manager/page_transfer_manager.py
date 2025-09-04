"""
PDF分页传输管理器
负责PDF页面的按需加载、压缩、缓存和传输优化
"""
import logging
import zlib
import base64
import time
from typing import Dict, List, Optional, Tuple, BinaryIO
from enum import Enum
from dataclasses import dataclass
import io

logger = logging.getLogger(__name__)

class CompressionType(Enum):
    """压缩类型枚举"""
    NONE = "none"
    ZLIB = "zlib"
    BASE64 = "base64"
    ZLIB_BASE64 = "zlib_base64"

class PagePriority(Enum):
    """页面优先级枚举"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class PageTransferConfig:
    """页面传输配置"""
    max_page_size_mb: int = 5
    default_compression: CompressionType = CompressionType.ZLIB_BASE64
    cache_size_pages: int = 10
    preload_range: int = 2
    max_retries: int = 3
    retry_delay_ms: int = 1000

@dataclass
class PageData:
    """页面数据"""
    file_id: str
    page_number: int
    data: bytes
    size: int
    compression: CompressionType
    timestamp: float

class PageTransferManager:
    """PDF页面传输管理器"""
    
    def __init__(self, config: Optional[PageTransferConfig] = None):
        self.config = config or PageTransferConfig()
        self.page_cache: Dict[str, Dict[int, PageData]] = {}
        self.active_transfers: Dict[str, set] = {}
        self.error_counts: Dict[str, Dict[int, int]] = {}
        
    def extract_page_from_pdf(self, pdf_file: BinaryIO, page_number: int) -> bytes:
        """
        从PDF文件中提取指定页面
        
        Args:
            pdf_file: PDF文件对象
            page_number: 页面编号
            
        Returns:
            bytes: 页面数据
        """
        try:
            # 这里需要实现PDF页面提取逻辑
            # 实际实现应该使用PyPDF2或其他PDF处理库
            pdf_file.seek(0)
            
            # 模拟页面提取 - 实际实现需要替换为真实的PDF页面提取
            # 返回页面数据的模拟实现
            return f"Page {page_number} data from PDF".encode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to extract page {page_number}: {e}")
            raise
    
    def compress_data(self, data: bytes, compression: CompressionType) -> Tuple[bytes, int]:
        """
        压缩数据
        
        Args:
            data: 原始数据
            compression: 压缩类型
            
        Returns:
            Tuple[压缩后数据, 压缩前大小]
        """
        original_size = len(data)
        
        if compression == CompressionType.NONE:
            return data, original_size
            
        elif compression == CompressionType.ZLIB:
            compressed = zlib.compress(data)
            return compressed, original_size
            
        elif compression == CompressionType.BASE64:
            encoded = base64.b64encode(data)
            return encoded, original_size
            
        elif compression == CompressionType.ZLIB_BASE64:
            compressed = zlib.compress(data)
            encoded = base64.b64encode(compressed)
            return encoded, original_size
            
        else:
            return data, original_size
    
    def decompress_data(self, compressed_data: bytes, compression: CompressionType) -> bytes:
        """
        解压缩数据
        
        Args:
            compressed_data: 压缩后的数据
            compression: 压缩类型
            
        Returns:
            bytes: 解压缩后的数据
        """
        if compression == CompressionType.NONE:
            return compressed_data
            
        elif compression == CompressionType.ZLIB:
            return zlib.decompress(compressed_data)
            
        elif compression == CompressionType.BASE64:
            return base64.b64decode(compressed_data)
            
        elif compression == CompressionType.ZLIB_BASE64:
            decoded = base64.b64decode(compressed_data)
            return zlib.decompress(decoded)
            
        else:
            return compressed_data
    
    def get_page(self, file_id: str, page_number: int, 
                 compression: Optional[CompressionType] = None) -> Dict[str, any]:
        """
        获取指定页面数据
        
        Args:
            file_id: 文件ID
            page_number: 页面编号
            compression: 压缩类型
            
        Returns:
            Dict: 页面数据字典
        """
        compression = compression or self.config.default_compression
        
        # 检查缓存
        cached_page = self._get_from_cache(file_id, page_number)
        if cached_page and cached_page.compression == compression:
            return self._format_page_response(cached_page)
        
        try:
            # 从文件系统或存储中获取PDF文件
            # 这里需要实现实际的PDF文件获取逻辑
            pdf_content = self._load_pdf_file(file_id)
            
            # 提取页面
            page_data = self.extract_page_from_pdf(io.BytesIO(pdf_content), page_number)
            
            # 压缩数据
            compressed_data, original_size = self.compress_data(page_data, compression)
            
            # 创建页面数据对象
            page_obj = PageData(
                file_id=file_id,
                page_number=page_number,
                data=compressed_data,
                size=original_size,
                compression=compression,
                timestamp=time.time()
            )
            
            # 添加到缓存
            self._add_to_cache(file_id, page_number, page_obj)
            
            return self._format_page_response(page_obj)
            
        except Exception as e:
            logger.error(f"Failed to get page {page_number} from file {file_id}: {e}")
            raise
    
    def preload_pages(self, file_id: str, start_page: int, end_page: int, 
                      priority: PagePriority = PagePriority.LOW) -> int:
        """
        预加载页面范围
        
        Args:
            file_id: 文件ID
            start_page: 起始页面
            end_page: 结束页面
            priority: 优先级
            
        Returns:
            int: 预加载的页面数量
        """
        preloaded_count = 0
        
        for page_num in range(start_page, end_page + 1):
            try:
                # 检查是否已经在缓存中
                if self._get_from_cache(file_id, page_num):
                    continue
                
                # 获取页面数据（使用较低优先级压缩）
                self.get_page(file_id, page_num, CompressionType.ZLIB)
                preloaded_count += 1
                
                logger.debug(f"Preloaded page {page_num} for file {file_id}")
                
            except Exception as e:
                logger.warning(f"Failed to preload page {page_num}: {e}")
                continue
        
        return preloaded_count
    
    def clear_cache(self, file_id: str, keep_pages: Optional[List[int]] = None) -> int:
        """
        清理页面缓存
        
        Args:
            file_id: 文件ID
            keep_pages: 需要保留的页面列表
            
        Returns:
            int: 清理的页面数量
        """
        if file_id not in self.page_cache:
            return 0
        
        if keep_pages:
            # 只保留指定的页面
            pages_to_remove = [
                page_num for page_num in self.page_cache[file_id].keys()
                if page_num not in keep_pages
            ]
            for page_num in pages_to_remove:
                del self.page_cache[file_id][page_num]
            return len(pages_to_remove)
        else:
            # 清理所有页面
            removed_count = len(self.page_cache[file_id])
            del self.page_cache[file_id]
            return removed_count
    
    def optimize_memory(self, max_memory_mb: int = 100) -> int:
        """
        内存优化 - 清理最久未使用的页面
        
        Args:
            max_memory_mb: 最大内存限制(MB)
            
        Returns:
            int: 清理的页面数量
        """
        # 计算当前内存使用
        current_memory = self._calculate_memory_usage()
        
        if current_memory <= max_memory_mb * 1024 * 1024:
            return 0
        
        # 按时间排序并清理最久未使用的页面
        all_pages = []
        for file_id, pages in self.page_cache.items():
            for page_num, page_data in pages.items():
                all_pages.append((page_data.timestamp, file_id, page_num))
        
        # 按时间排序（最旧的在前）
        all_pages.sort()
        
        removed_count = 0
        target_memory = max_memory_mb * 1024 * 1024 * 0.8  # 保留20%缓冲
        
        while current_memory > target_memory and all_pages:
            timestamp, file_id, page_num = all_pages.pop(0)
            if file_id in self.page_cache and page_num in self.page_cache[file_id]:
                page_size = len(self.page_cache[file_id][page_num].data)
                del self.page_cache[file_id][page_num]
                current_memory -= page_size
                removed_count += 1
        
        return removed_count
    
    def _load_pdf_file(self, file_id: str) -> bytes:
        """
        加载PDF文件内容
        
        Args:
            file_id: 文件ID
            
        Returns:
            bytes: PDF文件内容
        """
        # 这里需要实现实际的PDF文件加载逻辑
        # 返回模拟的PDF内容
        return f"PDF content for file {file_id}".encode('utf-8')
    
    def _get_from_cache(self, file_id: str, page_number: int) -> Optional[PageData]:
        """从缓存中获取页面"""
        if file_id in self.page_cache and page_number in self.page_cache[file_id]:
            page_data = self.page_cache[file_id][page_number]
            # 更新访问时间
            page_data.timestamp = time.time()
            return page_data
        return None
    
    def _add_to_cache(self, file_id: str, page_number: int, page_data: PageData):
        """添加页面到缓存"""
        if file_id not in self.page_cache:
            self.page_cache[file_id] = {}
        
        self.page_cache[file_id][page_number] = page_data
        
        # 如果缓存超过限制，清理最旧的页面
        if len(self.page_cache[file_id]) > self.config.cache_size_pages:
            self._cleanup_cache(file_id)
    
    def _cleanup_cache(self, file_id: str):
        """清理文件缓存"""
        pages = self.page_cache[file_id]
        if len(pages) <= self.config.cache_size_pages:
            return
        
        # 按时间排序并清理最旧的页面
        sorted_pages = sorted(
            [(page_data.timestamp, page_num) for page_num, page_data in pages.items()]
        )
        
        # 保留最新的cache_size_pages个页面
        pages_to_keep = set()
        for i in range(len(sorted_pages) - self.config.cache_size_pages, len(sorted_pages)):
            if i >= 0:
                pages_to_keep.add(sorted_pages[i][1])
        
        # 删除不在保留列表中的页面
        for page_num in list(pages.keys()):
            if page_num not in pages_to_keep:
                del pages[page_num]
    
    def _format_page_response(self, page_data: PageData) -> Dict[str, any]:
        """格式化页面响应"""
        return {
            "file_id": page_data.file_id,
            "page_number": page_data.page_number,
            "data": page_data.data.decode('utf-8') if isinstance(page_data.data, bytes) else page_data.data,
            "size": page_data.size,
            "compression": page_data.compression.value,
            "timestamp": page_data.timestamp
        }
    
    def _calculate_memory_usage(self) -> int:
        """计算内存使用量"""
        total_size = 0
        for file_id, pages in self.page_cache.items():
            for page_data in pages.values():
                total_size += len(page_data.data)
        return total_size

# 单例实例
page_transfer_manager = PageTransferManager()