"""
PDF文件管理工具函数
"""
import os
import logging
from typing import List, Tuple, Optional
from .models import PDFFile

logger = logging.getLogger(__name__)


class FileValidator:
    """文件验证工具类"""
    
    @staticmethod
    def is_pdf_file(file_path: str) -> bool:
        """
        检查文件是否为PDF格式
        
        Args:
            file_path: 文件路径
            
        Returns:
            bool: 是PDF文件返回True
        """
        if not file_path:
            return False
            
        # 检查文件扩展名
        if not file_path.lower().endswith('.pdf'):
            return False
            
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return False
            
        # 检查是否为文件
        if not os.path.isfile(file_path):
            return False
            
        return True
    
    @staticmethod
    def can_access_file(file_path: str) -> Tuple[bool, str]:
        """
        检查文件是否可访问
        
        Args:
            file_path: 文件路径
            
        Returns:
            Tuple[bool, str]: (是否可访问, 错误信息)
        """
        if not os.path.exists(file_path):
            return False, f"文件不存在: {file_path}"
            
        if not os.access(file_path, os.R_OK):
            return False, f"没有读取权限: {file_path}"
            
        return True, ""
    
    @staticmethod
    def get_file_info(file_path: str) -> Optional[dict]:
        """
        获取文件详细信息
        
        Args:
            file_path: 文件路径
            
        Returns:
            dict: 文件信息或None
        """
        try:
            stat = os.stat(file_path)
            return {
                'size': stat.st_size,
                'created_time': stat.st_ctime,
                'modified_time': stat.st_mtime,
                'is_readable': os.access(file_path, os.R_OK)
            }
        except (OSError, IOError) as e:
            logger.error(f"获取文件信息失败: {e}")
            return None
    
    @staticmethod
    def validate_file_operation(file_path: str, operation: str = "read") -> Tuple[bool, str]:
        """
        验证文件操作
        
        Args:
            file_path: 文件路径
            operation: 操作类型 (read, write, delete)
            
        Returns:
            Tuple[bool, str]: (是否有效, 错误信息)
        """
        if not file_path:
            return False, "文件路径不能为空"
        
        if not os.path.exists(file_path):
            return False, f"文件不存在: {file_path}"
        
        if operation == "read":
            if not os.access(file_path, os.R_OK):
                return False, f"没有读取权限: {file_path}"
        elif operation == "write":
            if not os.access(file_path, os.W_OK):
                return False, f"没有写入权限: {file_path}"
        elif operation == "delete":
            if not os.access(os.path.dirname(file_path), os.W_OK):
                return False, f"没有删除权限: {file_path}"
        
        return True, ""


class FileScanner:
    """文件扫描工具类"""
    
    @staticmethod
    def scan_directory(directory_path: str, recursive: bool = True) -> List[str]:
        """
        扫描目录中的PDF文件
        
        Args:
            directory_path: 目录路径
            recursive: 是否递归扫描子目录
            
        Returns:
            List[str]: PDF文件路径列表
        """
        pdf_files = []
        
        if not os.path.exists(directory_path):
            logger.warning(f"目录不存在: {directory_path}")
            return pdf_files
            
        if not os.path.isdir(directory_path):
            logger.warning(f"路径不是目录: {directory_path}")
            return pdf_files
            
        try:
            if recursive:
                for root, dirs, files in os.walk(directory_path):
                    for file in files:
                        if file.lower().endswith('.pdf'):
                            pdf_files.append(os.path.join(root, file))
            else:
                for file in os.listdir(directory_path):
                    file_path = os.path.join(directory_path, file)
                    if os.path.isfile(file_path) and file.lower().endswith('.pdf'):
                        pdf_files.append(file_path)
                        
        except (OSError, IOError) as e:
            logger.error(f"扫描目录失败: {e}")
            
        return sorted(pdf_files)
    
    @staticmethod
    def scan_multiple_directories(directories: List[str], recursive: bool = True) -> List[str]:
        """
        扫描多个目录中的PDF文件
        
        Args:
            directories: 目录路径列表
            recursive: 是否递归扫描子目录
            
        Returns:
            List[str]: PDF文件路径列表
        """
        all_files = []
        for directory in directories:
            files = FileScanner.scan_directory(directory, recursive)
            all_files.extend(files)
        return sorted(set(all_files))  # 去重并排序


class PathUtils:
    """路径处理工具类"""
    
    @staticmethod
    def normalize_path(file_path: str) -> str:
        """
        标准化文件路径
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: 标准化后的路径
        """
        return os.path.normpath(os.path.abspath(file_path))
    
    @staticmethod
    def get_relative_path(full_path: str, base_path: str) -> str:
        """
        获取相对路径
        
        Args:
            full_path: 完整路径
            base_path: 基础路径
            
        Returns:
            str: 相对路径
        """
        try:
            return os.path.relpath(full_path, base_path)
        except ValueError:
            # 不同盘符的情况
            return full_path
    
    @staticmethod
    def is_subpath(path: str, base_path: str) -> bool:
        """
        检查路径是否为base_path的子路径
        
        Args:
            path: 要检查的路径
            base_path: 基础路径
            
        Returns:
            bool: 是子路径返回True
        """
        try:
            path = os.path.abspath(path)
            base_path = os.path.abspath(base_path)
            return path.startswith(base_path)
        except Exception:
            return False


class ErrorHandler:
    """错误处理工具类"""
    
    @staticmethod
    def get_error_message(exception: Exception) -> str:
        """获取友好的错误信息"""
        if isinstance(exception, FileNotFoundError):
            return "文件不存在"
        elif isinstance(exception, PermissionError):
            return "没有文件访问权限"
        elif isinstance(exception, OSError):
            return "文件操作失败"
        else:
            return str(exception)


class PDFMetadataExtractor:
    """PDF元数据提取工具类（占位符，后续可扩展）"""
    
    @staticmethod
    def extract_metadata(file_path: str) -> dict:
        """
        提取PDF元数据
        
        Args:
            file_path: PDF文件路径
            
        Returns:
            dict: 元数据字典
        """
        # 这里是占位符实现，后续可以集成PyPDF2或pdfplumber
        return {
            "title": "",
            "author": "",
            "subject": "",
            "keywords": "",
            "page_count": 0,
            "creator": "",
            "producer": "",
            "creation_date": None,
            "modification_date": None
        }
    
    @staticmethod
    def get_page_count(file_path: str) -> int:
        """
        获取PDF页数
        
        Args:
            file_path: PDF文件路径
            
        Returns:
            int: 页数，失败返回0
        """
        try:
            # 这里是占位符实现
            return 0
        except Exception as e:
            logger.error(f"获取页数失败: {e}")
            return 0