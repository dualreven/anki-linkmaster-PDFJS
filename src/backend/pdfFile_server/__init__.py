"""
PDF文件服务器模块

提供PDF文件的HTTP访问服务，支持CORS、Range请求、健康检查等功能。
此模块可以独立运行，也可以作为其他系统的组件使用。

主要组件:
- HttpFileServer: 面向对象的服务器管理类
- PDFFileHandler: HTTP请求处理器
- run_server: 阻塞式服务器启动函数
- setup_logging: 日志配置工具

版本: 1.0.0
作者: AI Assistant
"""

__version__ = '1.0.0'
__author__ = 'AI Assistant'

# 导出主要接口
from .server.http_server import HttpFileServer, run_server
from .handlers.pdf_handler import PDFFileHandler
from .utils.logging_config import setup_logging, get_logger
from .cli.main import main as cli_main

# 导出配置常量
from .config.settings import (
    DEFAULT_PORT,
    DEFAULT_DATA_DIR,
    SERVER_NAME,
    HEALTH_CHECK_PATH,
    PDF_BASE_PATH
)

__all__ = [
    'HttpFileServer',
    'PDFFileHandler',
    'run_server',
    'setup_logging',
    'get_logger',
    'cli_main',
    'DEFAULT_PORT',
    'DEFAULT_DATA_DIR',
    'SERVER_NAME',
    'HEALTH_CHECK_PATH',
    'PDF_BASE_PATH'
]