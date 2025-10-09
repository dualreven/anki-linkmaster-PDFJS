"""
PDF文件服务器全局配置和常量定义

此模块包含所有可配置的参数和系统常量，
便于统一管理和修改配置。
"""

from pathlib import Path

# 基础路径配置
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data" / "pdfs"
DEFAULT_LOG_DIR = PROJECT_ROOT / "logs"
# 在运行于 dist 环境下，PROJECT_ROOT 即为 dist/latest 根目录
DEFAULT_DIST_DIR = PROJECT_ROOT

# 服务器配置
DEFAULT_PORT = 8080
DEFAULT_HOST = "0.0.0.0"
SERVER_NAME = "PDF-File-Server"

# 日志配置
LOG_FILE_NAME = "pdf-server.log"
LOG_LEVEL = "INFO"
LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
LOG_ENCODING = 'utf-8'
LOG_FILE_MODE = 'w'  # 每次启动时覆盖日志文件

# HTTP配置
CORS_ENABLED = True
CORS_ORIGINS = ['*']
CORS_METHODS = ['GET', 'OPTIONS']
CORS_HEADERS = ['Content-Type', 'Range']

# 路由配置
HEALTH_CHECK_PATH = '/health'
PDF_BASE_PATH = '/pdfs/'

# MIME类型配置
PDF_MIME_TYPE = 'application/pdf'

# 安全配置
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {'.pdf'}

# 性能配置
THREAD_POOL_SIZE = 10
SOCKET_TIMEOUT = 30

# 调试配置
DEBUG_MODE = False
VERBOSE_LOGGING = False

# 前端静态资源路由（生产）：
# - /pdf-home/ → dist/latest/pdf-home/
# - /pdf-viewer/ → dist/latest/pdf-viewer/
# - /assets/ → dist/latest/assets/
# - /vendor/ → dist/latest/vendor/
STATIC_ROUTE_PREFIXES = (
    "/pdf-home/",
    "/pdf-viewer/",
    "/assets/",
    "/vendor/",
    "/js/",
)
