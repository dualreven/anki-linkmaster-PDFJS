"""
PDF文件管理器
负责管理PDF文件的添加、删除和列表展示
"""

import os
import json
import logging
from typing import List, Dict, Optional
from PyQt6.QtCore import QObject, pyqtSignal

from .models import PDFFile, PDFFileList
from .utils import FileValidator, FileScanner, ErrorHandler

logger = logging.getLogger(__name__)


class PDFManager(QObject):
    """PDF文件管理器 - 集成PyQt信号的高级管理器"""
    
    # 定义信号
    file_added = pyqtSignal(dict)      # 文件添加成功
    file_removed = pyqtSignal(str)     # 文件移除成功
    file_list_changed = pyqtSignal()   # 文件列表变更
    error_occurred = pyqtSignal(str)   # 错误发生
    
    def __init__(self, data_dir="data"):
        """初始化PDF管理器
        
        Args:
            data_dir: 数据存储目录
        """
        super().__init__()
        self.data_dir = data_dir
        self.file_list = PDFFileList()
        self.config_file = os.path.join(data_dir, "pdf_files.json")
        
        # 确保数据目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        # 加载现有数据
        self.load_files()
        
    def add_file(self, filepath: str) -> bool:
        """添加PDF文件
        
        Args:
            filepath: PDF文件完整路径
            
        Returns:
            bool: 添加成功返回True
        """
        try:
            filepath = os.path.abspath(filepath)
            
            # 验证文件
            is_valid, error_msg = FileValidator.validate_file_operation(filepath, "read")
            if not is_valid:
                self.error_occurred.emit(error_msg)
                return False
                
            if not FileValidator.is_pdf_file(filepath):
                self.error_occurred.emit("文件格式错误：请选择PDF文件")
                return False
                
            # 检查文件是否已存在
            file_id = PDFFile.generate_file_id(filepath)
            if self.file_list.exists(file_id):
                self.error_occurred.emit("文件已存在于列表中")
                return False
                
            # 创建PDF文件记录
            pdf_file = PDFFile.from_file_path(filepath, file_id)
            
            # 提取元数据（占位符，后续可扩展）
            metadata = self._extract_metadata(filepath)
            pdf_file.update_metadata(metadata)
            
            # 添加到列表
            success = self.file_list.add_file(pdf_file)
            if success:
                self.save_files()
                file_info = pdf_file.get_file_info()
                self.file_added.emit(file_info)
                self.file_list_changed.emit()
                logger.info(f"文件添加成功: {filepath}")
                return True
            else:
                self.error_occurred.emit("文件添加失败")
                return False
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"添加文件失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return False
            
    def remove_file(self, file_id: str) -> bool:
        """删除PDF文件
        
        Args:
            file_id: 文件ID
            
        Returns:
            bool: 删除成功返回True
        """
        try:
            if not self.file_list.exists(file_id):
                self.error_occurred.emit("文件不存在")
                return False
                
            success = self.file_list.remove_file(file_id)
            if success:
                self.save_files()
                self.file_removed.emit(file_id)
                self.file_list_changed.emit()
                logger.info(f"文件移除成功: {file_id}")
                return True
            else:
                self.error_occurred.emit("文件移除失败")
                return False
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"移除文件失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return False
            
    def get_files(self) -> List[Dict]:
        """获取所有PDF文件列表
        
        Returns:
            List[Dict]: PDF文件基本信息列表
        """
        return self.file_list.get_files_info()
        
    def get_file_by_id(self, file_id: str) -> Optional[Dict]:
        """根据ID获取PDF文件信息
        
        Args:
            file_id: 文件ID
            
        Returns:
            Optional[Dict]: PDF文件信息或None
        """
        pdf_file = self.file_list.get_file(file_id)
        return pdf_file.get_file_info() if pdf_file else None
        
    def get_file_detail(self, file_id: str) -> Optional[Dict]:
        """获取PDF文件详细信息
        
        Args:
            file_id: 文件ID
            
        Returns:
            Optional[Dict]: 包含元数据的详细信息
        """
        pdf_file = self.file_list.get_file(file_id)
        if not pdf_file:
            return None
            
        return {
            **pdf_file.get_file_info(),
            **pdf_file.get_metadata(),
            "exists": pdf_file.is_file_exists()
        }
        
    def add_files_from_directory(self, directory_path: str, recursive: bool = True) -> int:
        """
        从目录批量添加PDF文件
        
        Args:
            directory_path: 目录路径
            recursive: 是否递归扫描子目录
            
        Returns:
            int: 成功添加的文件数量
        """
        try:
            pdf_files = FileScanner.scan_directory(directory_path, recursive)
            added_count = 0
            
            for filepath in pdf_files:
                if self.add_file(filepath):
                    added_count += 1
                    
            logger.info(f"批量添加完成：成功添加 {added_count}/{len(pdf_files)} 个文件")
            return added_count
            
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"批量添加失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return 0
            
    def refresh_file_list(self) -> int:
        """刷新文件列表，移除不存在的文件
        
        Returns:
            int: 移除的文件数量
        """
        removed_count = 0
        
        for file_id in self.file_list.get_file_ids():
            pdf_file = self.file_list.get_file(file_id)
            if pdf_file and not pdf_file.is_file_exists():
                self.file_list.remove_file(file_id)
                removed_count += 1
                logger.info(f"移除不存在的文件: {pdf_file.filename}")
                
        if removed_count > 0:
            self.save_files()
            self.file_list_changed.emit()
            
        return removed_count
        
    def save_files(self) -> bool:
        """保存文件列表到磁盘"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.file_list.to_dict(), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"保存文件列表失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return False
            
    def load_files(self) -> bool:
        """从磁盘加载文件列表"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    loaded_list = PDFFileList.from_dict(data)
                    
                    # 验证文件是否仍然存在
                    valid_files = []
                    for file_id in loaded_list.get_file_ids():
                        pdf_file = loaded_list.get_file(file_id)
                        if pdf_file and pdf_file.is_file_exists():
                            valid_files.append(pdf_file)
                        else:
                            logger.warning(f"跳过不存在的文件: {file_id}")
                    
                    # 重建有效文件列表
                    self.file_list.clear()
                    for pdf_file in valid_files:
                        self.file_list.add_file(pdf_file)
                        
                    logger.info(f"加载文件列表完成：共 {len(valid_files)} 个有效文件")
                    return True
                    
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"加载文件列表失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            
        return False
        
    def clear_all(self) -> bool:
        """清空所有文件"""
        try:
            self.file_list.clear()
            self.save_files()
            self.file_list_changed.emit()
            logger.info("清空所有文件完成")
            return True
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"清空文件失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return False
            
    def get_file_count(self) -> int:
        """获取文件数量"""
        return self.file_list.count()
        
    def get_file_ids(self) -> List[str]:
        """获取所有文件ID列表"""
        return self.file_list.get_file_ids()
        
    def search_files(self, keyword: str) -> List[Dict]:
        """搜索文件
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            List[Dict]: 匹配的文件列表
        """
        keyword = keyword.lower()
        results = []
        
        for pdf_file in self.file_list.get_all_files():
            if (keyword in pdf_file.filename.lower() or
                keyword in pdf_file.title.lower() or
                keyword in str(pdf_file.tags).lower() or
                keyword in pdf_file.author.lower()):
                results.append(pdf_file.get_file_info())
                
        return results
        
    def _extract_metadata(self, filepath: str) -> Dict[str, str]:
        """提取PDF元数据（占位符实现）"""
        # TODO: 后续集成PyPDF2或pdfplumber提取真实元数据
        return {
            "title": os.path.splitext(os.path.basename(filepath))[0],
            "author": "",
            "subject": "",
            "keywords": "",
            "page_count": 0
        }