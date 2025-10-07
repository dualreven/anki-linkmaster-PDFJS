"""
PDF文件管理器
负责管理PDF文件的添加、删除和列表展示
"""

import os
import json
import logging
import shutil
from typing import Dict, Any, List, Optional
from src.qt.compat import QObject, pyqtSignal

from .models import PDFFile, PDFFileList
from .utils import FileValidator, ErrorHandler
from .config import AppConfig
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
        
        # 副本存储目录
        self.pdfs_dir = os.path.join(data_dir, "pdfs")
        self.thumbnails_dir = os.path.join(data_dir, "thumbnails")
        
        # 确保数据目录存在
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.pdfs_dir, exist_ok=True)
        os.makedirs(self.thumbnails_dir, exist_ok=True)
        
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
            logger.debug(f"为文件生成ID: {filepath} -> {file_id}")
            logger.debug(f"当前文件列表中的ID数量: {self.file_list.count()}")

            if self.file_list.exists(file_id):
                existing = self.file_list.get_file(file_id)
                logger.warning(f"重复添加，同一ID已存在: {file_id}, 路径: {filepath}")
                if existing:
                    # 幂等：视为成功，发出 file_added 信号以便前端感知
                    info = existing.get_file_info()
                    try:
                        self.file_added.emit(info)
                        self.file_list_changed.emit()
                    except Exception:
                        pass
                    return True
                # 异常状态：记录存在但取不到，尝试移除并继续添加
                try:
                    self.file_list.remove_file(file_id)
                except Exception:
                    pass
                
            # 创建文件副本
            copy_path = self._create_file_copy(filepath, file_id)
            if not copy_path:
                self.error_occurred.emit("创建文件副本失败")
                return False
                
            # 创建PDF文件记录，使用副本路径
            pdf_file = PDFFile.from_file_path(copy_path, file_id)
            # 保存原始文件路径作为元数据
            pdf_file.original_path = filepath
            
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
                logger.info(f"文件添加成功: {filepath} -> {copy_path}")
                return True
            else:
                self.error_occurred.emit("文件已存在于列表中")
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
            # 获取文件信息以获取副本路径
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                self.error_occurred.emit("文件不存在")
                return False
                
            # 删除副本文件
            copy_path = pdf_file.filepath
            if os.path.exists(copy_path):
                os.remove(copy_path)
                logger.info(f"文件副本删除成功: {copy_path}")
            
            success = self.file_list.remove_file(file_id)
            if success:
                logger.debug(f"从file_list中移除成功: {file_id}")
                logger.debug(f"移除后文件列表中的ID数量: {self.file_list.count()}")
                logger.debug(f"准备保存文件列表到: {self.config_file}")

                save_result = self.save_files()
                if save_result:
                    logger.info(f"文件列表保存成功，文件移除成功: {file_id}")
                else:
                    logger.error(f"文件列表保存失败！文件: {file_id}")

                self.file_removed.emit(file_id)
                self.file_list_changed.emit()
                return True
            else:
                self.error_occurred.emit("文件移除失败")
                return False
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"移除文件失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return False

    def batch_remove_files(self, file_ids: List[str]) -> Dict[str, Any]:
        """
        批量删除PDF文件
        
        Args:
            file_ids: 文件ID列表
            
        Returns:
            Dict: 包含删除结果的字典
        """
        try:
            if not file_ids:
                self.error_occurred.emit("文件ID列表不能为空")
                return {"success": False, "message": "文件ID列表不能为空"}
            
            removed_files = []
            failed_files = {}
            
            for file_id in file_ids:
                success = self.remove_file(file_id)
                if success:
                    removed_files.append(file_id)
                else:
                    failed_files[file_id] = "删除失败"
            
            result = {
                "removed_files": removed_files,
                "failed_files": failed_files,
                "total_removed": len(removed_files),
                "total_failed": len(failed_files)
            }
            
            logger.info(f"批量删除完成：成功删除 {len(removed_files)} 个文件，失败 {len(failed_files)} 个文件")
            return {"success": True, **result}
            
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"批量删除文件失败: {error_msg}")
            self.error_occurred.emit(error_msg)
            return {"success": False, "message": error_msg}
            
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
        
    def get_file_detail(self, file_id: str) -> Optional[Dict[str, Any]]:
        """获取PDF文件详细信息
        
        Args:
            file_id: 文件ID
            
        Returns:
            Optional[Dict[str, Any]]: 文件详细信息字典
        """
        try:
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                return None
                
            # 获取基本文件信息
            file_info = pdf_file.get_file_info()
            
            # 添加原始文件路径
            if hasattr(pdf_file, 'original_path'):
                file_info["original_path"] = pdf_file.original_path
            
            # 添加文件统计信息（使用副本文件）
            stats = FileValidator.get_file_stats(pdf_file.filepath)
            file_info.update(stats)
            
            # 添加元数据
            file_info["metadata"] = pdf_file.get_metadata()
            
            return file_info
            
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"获取文件详情失败: {error_msg}")
            return None

    def update_file(self, file_id: str, updates: Dict[str, Any]) -> bool:
        """更新PDF文件元数据

        Args:
            file_id: 文件ID
            updates: 更新的字段字典

        Returns:
            bool: 更新成功返回True
        """
        try:
            # 获取文件对象
            pdf_file = self.file_list.get_file(file_id)
            if not pdf_file:
                self.error_occurred.emit(f"文件不存在: {file_id}")
                return False

            # 更新元数据
            pdf_file.update_metadata(updates)

            # 保存到文件
            self.save_files()

            # 触发列表变更信号
            self.file_list_changed.emit()

            logger.info(f"文件元数据更新成功: {file_id}")
            return True

        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"更新文件失败: {error_msg}")
            self.error_occurred.emit(f"更新文件失败: {error_msg}")
            return False

    def _create_file_copy(self, original_path: str, file_id: str) -> str:
        """创建PDF文件副本
        
        Args:
            original_path: 原始文件路径
            file_id: 文件ID
            
        Returns:
            str: 副本文件路径，失败返回None
        """
        try:
            # 生成副本文件路径
            copy_filename = f"{file_id}.pdf"
            copy_path = os.path.join(self.pdfs_dir, copy_filename)
            
            # 复制文件
            import shutil
            shutil.copy2(original_path, copy_path)
            
            # 验证副本是否创建成功
            if os.path.exists(copy_path):
                logger.info(f"文件副本创建成功: {original_path} -> {copy_path}")
                return copy_path
            else:
                logger.error(f"文件副本创建失败: {original_path}")
                return None
                
        except Exception as e:
            error_msg = ErrorHandler.get_error_message(e)
            logger.error(f"创建文件副本失败: {error_msg}")
            return None

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
        """提取PDF元数据"""
        from .utils import PDFMetadataExtractor
        
        # 使用PDFMetadataExtractor提取真实元数据
        metadata = PDFMetadataExtractor.extract_metadata(filepath)
        
        # 如果提取失败，返回默认值
        if "error" in metadata:
            logger.warning(f"提取PDF元数据失败: {metadata['error']}")
            return {
                "title": os.path.splitext(os.path.basename(filepath))[0],
                "author": "",
                "subject": "",
                "keywords": "",
                "page_count": 0
            }
        
        # 返回提取到的元数据，如果title为空则使用文件名
        filename_title = os.path.splitext(os.path.basename(filepath))[0]
        extracted_title = metadata.get("title", "")
        
        return {
            "title": extracted_title if extracted_title else filename_title,
            "author": metadata.get("author", ""),
            "subject": metadata.get("subject", ""),
            "keywords": metadata.get("keywords", ""),
            "page_count": metadata.get("page_count", 0)
        }
