"""
AI Launcher Package
模块化服务启动器
"""

__version__ = "2.0.0"
__author__ = "AI Assistant"

from .core.service_manager import ServiceManager
from .core.module_manager import ModuleManager

__all__ = ["ServiceManager", "ModuleManager"]