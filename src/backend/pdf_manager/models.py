"""
PDF文件数据模型定义
"""
import os
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class PDFFile:
    """PDF文件数据模型"""
    
    id: str
    filename: str
    filepath: str
    file_size: int
    created_time: float
    modified_time: float
    title: str = ""
    author: str = ""
    subject: str = ""
    keywords: str = ""
    page_count: int = 0
    thumbnail_path: Optional[str] = None
    tags: list = None
    notes: str = ""
    
    def __post_init__(self):
        """初始化后的处理"""
        if self.tags is None:
            self.tags = []
    
    @classmethod
    def from_file_path(cls, file_path: str, file_id: str = None) -> 'PDFFile':
        """
        从文件路径创建PDFFile实例
        
        Args:
            file_path: PDF文件完整路径
            file_id: 文件ID（可选，不指定则自动生成）
            
        Returns:
            PDFFile实例
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
            
        file_stat = os.stat(file_path)
        
        return cls(
            id=file_id or cls.generate_file_id(file_path),
            filename=os.path.basename(file_path),
            filepath=os.path.abspath(file_path),
            file_size=file_stat.st_size,
            created_time=file_stat.st_ctime,
            modified_time=file_stat.st_mtime,
            title=os.path.splitext(os.path.basename(file_path))[0]
        )
    
    @staticmethod
    def generate_file_id(file_path: str) -> str:
        """
        生成文件唯一ID，基于规范化路径确保一致性
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: 文件唯一ID
        """
        import hashlib
        try:
            # 获取绝对路径并规范化，解决相对路径和绝对路径不一致问题
            normalized_path = os.path.abspath(os.path.normpath(file_path))
            # Windows系统统一转为小写处理大小写不敏感问题
            normalized_path = normalized_path.lower() if os.name == 'nt' else normalized_path
            return hashlib.md5(normalized_path.encode('utf-8')).hexdigest()[:12]
        except Exception as e:
            # 降级处理：使用原始路径作为备选方案
            return hashlib.md5(file_path.encode('utf-8')).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PDFFile':
        """从字典创建实例"""
        return cls(**data)
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'PDFFile':
        """从JSON字符串创建实例"""
        return cls.from_dict(json.loads(json_str))
    
    def get_file_info(self) -> Dict[str, Any]:
        """获取文件基本信息"""
        return {
            "id": self.id,
            "filename": self.filename,
            "filepath": self.filepath,
            "file_size": self.file_size,
            "file_size_formatted": self.format_file_size(self.file_size),
            "created_time": self.format_time(self.created_time),
            "modified_time": self.format_time(self.modified_time),
            "title": self.title,
            "author": self.author,
            "page_count": self.page_count
        }
    
    def get_metadata(self) -> Dict[str, Any]:
        """获取文件元数据"""
        return {
            "title": self.title,
            "author": self.author,
            "subject": self.subject,
            "keywords": self.keywords,
            "page_count": self.page_count,
            "tags": self.tags,
            "notes": self.notes
        }
    
    def update_metadata(self, metadata: Dict[str, Any]) -> None:
        """更新文件元数据"""
        for key, value in metadata.items():
            if hasattr(self, key):
                setattr(self, key, value)
    
    def is_file_exists(self) -> bool:
        """检查文件是否存在"""
        return os.path.exists(self.filepath)
    
    def get_relative_path(self, base_path: str) -> str:
        """获取相对于base_path的相对路径"""
        try:
            return os.path.relpath(self.filepath, base_path)
        except ValueError:
            return self.filepath
    
    @staticmethod
    def format_file_size(size_bytes: int) -> str:
        """格式化文件大小显示"""
        if size_bytes == 0:
            return "0 B"
            
        size_names = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1
            
        return f"{size_bytes:.1f} {size_names[i]}"
    
    @staticmethod
    def format_time(timestamp: float) -> str:
        """格式化时间戳显示"""
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
    
    def __str__(self) -> str:
        """字符串表示"""
        return f"PDFFile(id={self.id}, filename={self.filename}, size={self.format_file_size(self.file_size)})"
    
    def __repr__(self) -> str:
        """详细字符串表示"""
        return self.__str__()


class PDFFileList:
    """PDF文件列表管理"""
    
    def __init__(self):
        self.files: Dict[str, PDFFile] = {}
    
    def add_file(self, pdf_file: PDFFile) -> bool:
        """添加PDF文件到列表"""
        if pdf_file.id in self.files:
            return False
            
        self.files[pdf_file.id] = pdf_file
        return True
    
    def remove_file(self, file_id: str) -> bool:
        """从列表中移除PDF文件"""
        if file_id not in self.files:
            return False
            
        del self.files[file_id]
        return True
    
    def get_file(self, file_id: str) -> Optional[PDFFile]:
        """获取指定ID的PDF文件"""
        return self.files.get(file_id)
    
    def get_all_files(self) -> list:
        """
        获取所有PDF文件列表，按创建时间倒序排序（最新的在前）
        """
        files = list(self.files.values())
        # 按创建时间倒序排序，确保最新添加的文件显示在前面
        files.sort(key=lambda f: f.created_time if hasattr(f, 'created_time') and f.created_time else '', reverse=True)
        return files
    
    def get_file_ids(self) -> list:
        """获取所有文件ID列表"""
        return list(self.files.keys())
    
    def get_files_info(self) -> list:
        """
        获取所有文件的基本信息，按创建时间倒序排序（最新的在前）
        """
        files = list(self.files.values())
        # 按创建时间倒序排序
        files.sort(key=lambda f: f.created_time if hasattr(f, 'created_time') and f.created_time else '', reverse=True)
        return [file.get_file_info() for file in files]
    
    def clear(self) -> None:
        """清空文件列表"""
        self.files.clear()
    
    def count(self) -> int:
        """获取文件数量"""
        return len(self.files)
    
    def exists(self, file_id: str) -> bool:
        """检查文件是否存在"""
        return file_id in self.files
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "files": {fid: file.to_dict() for fid, file in self.files.items()}
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PDFFileList':
        """从字典创建实例"""
        file_list = cls()
        for file_id, file_data in data.get("files", {}).items():
            pdf_file = PDFFile.from_dict(file_data)
            file_list.add_file(pdf_file)
        return file_list
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'PDFFileList':
        """从JSON字符串创建实例"""
        return cls.from_dict(json.loads(json_str))