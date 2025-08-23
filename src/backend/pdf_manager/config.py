"""
PDF管理器配置模块
"""

import os

class AppConfig:
    """应用程序配置类"""
    
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.pdfs_dir = os.path.join(data_dir, "pdfs")
        self.thumbnails_dir = os.path.join(data_dir, "thumbnails")
        
    @classmethod
    def get_default(cls):
        """获取默认配置实例"""
        return cls()