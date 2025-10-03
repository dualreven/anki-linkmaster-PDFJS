"""
标准PDF管理器 - 支持JSON通信标准
"""
import os
import json
import logging
import shutil
import time
from typing import Dict, Any, List, Optional, Tuple
from src.qt.compat import QObject, pyqtSignal

from .models import PDFFile, PDFFileList
from .utils import FileValidator, ErrorHandler
from .config import AppConfig

logger = logging.getLogger(__name__)

class StandardPDFManager(QObject):
    """标准PDF管理器 - 支持标准JSON格式"""
    
    # 定义信号（使用标准格式）
    file_added = pyqtSignal(dict)      # 文件添加成功（标准格式）
    file_removed = pyqtSignal(dict)    # 文件移除成功（标准格式）
    file_list_changed = pyqtSignal()   # 文件列表变更
    error_occurred = pyqtSignal(dict)  # 错误发生（标准格式）
    
    def __init__(self, data_dir="data"):
        super().__init__()
        self.data_dir = data_dir
        self.file_list = PDFFileList()
        self.config_file = os.path.join(data_dir, "pdf_files.json")
        
        # 副本存储目录
        self.pdfs_dir = os.path.join(data_dir, "pdfs")
        self.thumbnails_dir = os.path.join(data_dir, "thumbnails")
        
        # 确保数据目录存在
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.pdfs_dir, exist_ok=True)
        os.makedirs(self.thumbnails_dir, exist_ok=True)
        
        # 加载现有数据
        self.load_files()
    
    def add_file(self, filepath: str) -> Tuple[bool, Dict[str, Any]]:
        """
        添加PDF文件（标准格式）
        
        Args:
            filepath: PDF文件完整路径
            
        Returns:
            Tuple[bool, Dict]: (是否成功, 标准格式的响应数据)
        """
        try:
            filepath = os.path.abspath(filepath)
            
            # 验证文件
            is_valid, error_msg = FileValidator.validate_file_operation(filepath, "read")
            if not is_valid:
                error_response = self._build_error_response("VALIDATION_ERROR", error_msg)
                self.error_occurred.emit(error_response)
                return False, error_response
            
            if not FileValidator.is_pdf_file(filepath):
                error_response = self._build_error_response("VALIDATION_ERROR", "文件格式错误：请选择PDF文件")
                self.error_occurred.emit(error_response)
                return False, error_response
            
            # 检查文件是否已存在
            file_id = PDFFile.generate_file_id(filepath)
            if self.file_list.exists(file_id):
                error_response = self._build_error_response("DUPLICATE_FILE", "文件已存在于列表中")
                self.error_occurred.emit(error_response)
                return False, error_response
            
            # 创建文件副本
            copy_path = self._create_file_copy(filepath, file_id)
            if not copy_path:
                error_response = self._build_error_response("COPY_ERROR", "创建文件副本失败")
                self.error_occurred.emit(error_response)
                return False, error_response
            
            # 创建PDF文件记录
            pdf_file = PDFFile.from_file_path(copy_path, file_id)
            pdf_file.original_path = filepath
            
            # 提取元数据
            metadata = self._extract_metadata(filepath)
            pdf_file.update_metadata(metadata)
            
            # 添加到列表
            success = self.file_list.add_file(pdf_file)
            if success:
                self.save_files()
                
                # 构建标准格式的文件信息
                file_info = self._build_standard_file_info(pdf_file)
                
                # 发出标准格式的信号
                self.file_added.emit(file_info)
                self.file_list_changed.emit()
                
                logger.info(f"文件添加成功: {filepath}")
                return True, file_info
            else:
                error_response = self._build_error_response("ADD_ERROR", "文件添加失败")
                self.error_occurred.emit(error_response)
                return False, error_response
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"添加文件失败: {error_msg}")
            error_response = self._build_error_response("PROCESSING_ERROR", error_msg)
            self.error_occurred.emit(error_response)
            return False, error_response
    
    def remove_file(self, file_id: str) -> Tuple[bool, Dict[str, Any]]:
        """
        删除PDF文件（标准格式）
        
        Args:
            file_id: 文件ID
            
        Returns:
            Tuple[bool, Dict]: (是否成功, 标准格式的响应数据)
        """
        try:
            # 获取文件信息
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                error_response = self._build_error_response("FILE_NOT_FOUND", "文件不存在")
                self.error_occurred.emit(error_response)
                return False, error_response
            
            # 删除副本文件
            copy_path = pdf_file.filepath
            if os.path.exists(copy_path):
                os.remove(copy_path)
                logger.info(f"文件副本删除成功: {copy_path}")
            
            # 从列表中移除
            success = self.file_list.remove_file(file_id)
            if success:
                self.save_files()
                
                # 构建标准格式的删除响应
                remove_response = {
                    "file_id": file_id,
                    "remove_time": int(time.time() * 1000),
                    "file_count": self.file_list.count()
                }
                
                # 发出标准格式的信号
                self.file_removed.emit(remove_response)
                self.file_list_changed.emit()
                
                logger.info(f"文件移除成功: {file_id}")
                return True, remove_response
            else:
                error_response = self._build_error_response("REMOVE_ERROR", "文件移除失败")
                self.error_occurred.emit(error_response)
                return False, error_response
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"移除文件失败: {error_msg}")
            error_response = self._build_error_response("PROCESSING_ERROR", error_msg)
            self.error_occurred.emit(error_response)
            return False, error_response

    def batch_remove_files(self, file_ids: List[str]) -> Tuple[bool, Dict[str, Any]]:
        """
        批量删除PDF文件（标准格式）
        
        Args:
            file_ids: 文件ID列表
            
        Returns:
            Tuple[bool, Dict]: (是否成功, 标准格式的响应数据)
        """
        try:
            if not file_ids:
                error_response = self._build_error_response("INVALID_REQUEST", "文件ID列表不能为空")
                self.error_occurred.emit(error_response)
                return False, error_response
            
            removed_files = []
            failed_files = {}
            
            for file_id in file_ids:
                # 尝试删除每个文件
                success, result = self.remove_file(file_id)
                if success:
                    removed_files.append(file_id)
                else:
                    failed_files[file_id] = result.get("message", "删除失败")
            
            # 构建批量删除响应
            batch_response = {
                "removed_files": removed_files,
                "failed_files": failed_files,
                "total_removed": len(removed_files),
                "total_failed": len(failed_files),
                "file_count": self.file_list.count()
            }
            
            logger.info(f"批量删除完成：成功删除 {len(removed_files)} 个文件，失败 {len(failed_files)} 个文件")
            return True, batch_response
            
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"批量删除文件失败: {error_msg}")
            error_response = self._build_error_response("PROCESSING_ERROR", error_msg)
            self.error_occurred.emit(error_response)
            return False, error_response
    
    def get_files(self) -> List[Dict[str, Any]]:
        """
        获取所有PDF文件列表（新标准格式）
        
        Returns:
            List[Dict[str, Any]]: PDF文件列表
        """
        try:
            files = []
            for pdf_file in self.file_list.get_all_files():
                files.append(self._build_standard_file_info(pdf_file))
            return files
            
        except Exception as e:
            logger.error(f"获取文件列表失败: {e}")
            return []
    
    def get_file_detail(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        获取PDF文件详细信息（标准格式）
        
        Args:
            file_id: 文件ID
            
        Returns:
            Optional[Dict[str, Any]]: 标准格式的文件详细信息
        """
        try:
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                return None
            
            # 获取基本文件信息
            file_info = self._build_standard_file_info(pdf_file)
            
            # 添加详细信息
            stats = self._get_file_stats(pdf_file.filepath)
            metadata = pdf_file.get_metadata()
            
            # 构建标准格式的详细信息
            detail_info = {
                **file_info,
                "stats": stats,
                "metadata": metadata,
                "original_path": getattr(pdf_file, 'original_path', None),
                "created_at": int(os.path.getctime(pdf_file.filepath) * 1000),
                "updated_at": int(os.path.getmtime(pdf_file.filepath) * 1000)
            }
            
            return detail_info
            
        except Exception as e:
            logger.error(f"获取文件详情失败: {e}")
            return None
    
    def search_files(self, keyword: str) -> Dict[str, Any]:
        """
        搜索文件（标准格式）
        
        Args:
            keyword: 搜索关键词
            
        Returns:
            Dict[str, Any]: 标准格式的搜索结果
        """
        try:
            keyword = keyword.lower()
            results = []
            
            for pdf_file in self.file_list.get_all_files():
                if self._matches_search(pdf_file, keyword):
                    results.append(self._build_standard_file_info(pdf_file))
            
            return {
                "success": True,
                "data": {
                    "files": results,
                    "total_count": len(results),
                    "keyword": keyword,
                    "timestamp": int(time.time() * 1000)
                }
            }
            
        except Exception as e:
            logger.error(f"搜索文件失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "files": [],
                    "total_count": 0,
                    "keyword": keyword,
                    "timestamp": int(time.time() * 1000)
                }
            }
    
    def _build_standard_file_info(self, pdf_file: PDFFile) -> Dict[str, Any]:
        """构建标准格式的文件信息"""
        base_info = pdf_file.get_file_info()

        return {
            "id": base_info["id"],
            "filename": base_info["filename"],
            "title": base_info["title"],
            "author": base_info["author"],
            "file_size": base_info.get("file_size", 0),
            "page_count": base_info.get("page_count", 0),
            "tags": base_info.get("tags", []),
            "upload_time": base_info.get("upload_time", int(time.time() * 1000)),
            "metadata": base_info.get("metadata", {}),
            # 学习管理字段 (扩展 - 2025-10-02)
            "last_accessed_at": base_info.get("last_accessed_at", 0),
            "review_count": base_info.get("review_count", 0),
            "rating": base_info.get("rating", 0),
            "is_visible": base_info.get("is_visible", True),
            "total_reading_time": base_info.get("total_reading_time", 0),
            "due_date": base_info.get("due_date", 0)
        }
    
    def _build_error_response(self, type: str, message: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """构建新标准格式的错误响应"""
        error_response = {
            "type": type,
            "message": message
        }
        
        if details:
            error_response["details"] = details
        
        return error_response
    
    def _get_file_stats(self, filepath: str) -> Dict[str, Any]:
        """获取文件统计信息"""
        try:
            stat = os.stat(filepath)
            return {
                "size": stat.st_size,
                "created_at": int(stat.st_ctime * 1000),
                "modified_at": int(stat.st_mtime * 1000),
                "accessed_at": int(stat.st_atime * 1000)
            }
        except Exception:
            return {
                "size": 0,
                "created_at": 0,
                "modified_at": 0,
                "accessed_at": 0
            }
    
    def _matches_search(self, pdf_file: PDFFile, keyword: str) -> bool:
        """检查文件是否匹配搜索关键词"""
        search_fields = [
            pdf_file.filename,
            pdf_file.title,
            str(pdf_file.tags),
            pdf_file.author
        ]
        
        return any(keyword in str(field).lower() for field in search_fields)
    
    def _create_file_copy(self, original_path: str, file_id: str) -> Optional[str]:
        """创建文件副本"""
        try:
            copy_filename = f"{file_id}.pdf"
            copy_path = os.path.join(self.pdfs_dir, copy_filename)
            
            shutil.copy2(original_path, copy_path)
            
            if os.path.exists(copy_path):
                return copy_path
            else:
                return None
                
        except Exception as e:
            logger.error(f"创建文件副本失败: {e}")
            return None
    
    def _extract_metadata(self, filepath: str) -> Dict[str, Any]:
        """提取PDF元数据"""
        return {
            "title": os.path.splitext(os.path.basename(filepath))[0],
            "author": "",
            "subject": "",
            "keywords": "",
            "page_count": 0,
            "creator": "",
            "producer": "",
            "creation_date": "",
            "modification_date": ""
        }
    
    # 向后兼容的方法
    def save_files(self) -> bool:
        """保存文件列表到磁盘"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.file_list.to_dict(), f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"保存文件列表失败: {e}")
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
            logger.error(f"加载文件列表失败: {e}")
            return False
        return False
    
    def get_file_count(self) -> int:
        """获取文件数量"""
        return self.file_list.count()
    
    def get_file_ids(self) -> List[str]:
        """获取所有文件ID列表"""
        return self.file_list.get_file_ids()

    def update_file(self, file_id: str, updates: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """
        更新PDF文件元数据（标准格式）

        Args:
            file_id: 文件ID
            updates: 要更新的字段字典

        Returns:
            Tuple[bool, Dict]: (是否成功, 标准格式的响应数据)
        """
        try:
            # 获取文件对象
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                error_response = self._build_error_response("FILE_NOT_FOUND", "文件不存在")
                self.error_occurred.emit(error_response)
                return False, error_response

            # 更新元数据
            pdf_file.update_metadata(updates)

            # 保存到磁盘
            success = self.save_files()
            if success:
                # 构建标准格式的更新响应
                file_info = self._build_standard_file_info(pdf_file)
                update_response = {
                    "file": file_info,
                    "updated_fields": list(updates.keys()),
                    "update_time": int(time.time() * 1000)
                }

                # 发出文件列表变更信号
                self.file_list_changed.emit()

                logger.info(f"文件更新成功: {file_id}, 更新字段: {list(updates.keys())}")
                return True, update_response
            else:
                error_response = self._build_error_response("SAVE_ERROR", "保存文件更新失败")
                self.error_occurred.emit(error_response)
                return False, error_response

        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"更新文件失败: {error_msg}")
            error_response = self._build_error_response("PROCESSING_ERROR", error_msg)
            self.error_occurred.emit(error_response)
            return False, error_response