"""
PDF文件服务器全局配置和常量定义

此模块包含所有可配置的参数和系统常量，
便于统一管理和修改配置。
"""

from pathlib import Path

# 基础路径配置
# PROJECT_ROOT 计算：从 settings.py 向上5层到达模块根
# - 源码运行：src/backend/pdfFile_server/config/settings.py → <repo>
# - 打包运行：dist/latest/src/backend/pdfFile_server/config/settings.py → dist/latest
_SETTINGS_FILE = Path(__file__).resolve()
_CANDIDATE_PROJECT_ROOT = _SETTINGS_FILE.parent.parent.parent.parent.parent

# 数据目录探测：优先使用仓库根目录的 data/pdfs（即使从 dist 运行）
# 如果从 dist/latest 启动，向上两层回到仓库根
if (_CANDIDATE_PROJECT_ROOT / "dist" / "latest").exists():
    # 从 dist/latest 运行：向上回溯到仓库根
    REPO_ROOT = _CANDIDATE_PROJECT_ROOT
    PROJECT_ROOT = _CANDIDATE_PROJECT_ROOT
else:
    # 从源码运行：_CANDIDATE_PROJECT_ROOT 即为仓库根
    REPO_ROOT = _CANDIDATE_PROJECT_ROOT
    PROJECT_ROOT = _CANDIDATE_PROJECT_ROOT

# 数据目录始终指向仓库根的 data/pdfs
DEFAULT_DATA_DIR = REPO_ROOT / "data" / "pdfs"
DEFAULT_LOG_DIR = PROJECT_ROOT / "logs"  # 日志可以放在 dist/latest/logs 或 <repo>/logs

# 动态探测 dist 根目录（显式 UTF-8 无关，此处仅路径判断）：
# - 若当前运行于打包后的 dist 环境：settings.py 位于 dist/latest/src/backend/...，
#   此时 PROJECT_ROOT 即为 dist/latest，且该目录下应存在 /static
# - 若运行于源码仓库根：优先使用 <repo>/dist/latest 作为静态根，以匹配构建脚本输出
_DIST_CANDIDATE_A = PROJECT_ROOT  # 可能已经是 dist/latest（打包运行）
_DIST_CANDIDATE_B = PROJECT_ROOT / "dist" / "latest"  # 源码运行时的集中产物目录

if (_DIST_CANDIDATE_A / "static").is_dir():
    DEFAULT_DIST_DIR = _DIST_CANDIDATE_A
elif (_DIST_CANDIDATE_B / "static").is_dir():
    DEFAULT_DIST_DIR = _DIST_CANDIDATE_B
else:
    # 兜底：保持与历史一致为 PROJECT_ROOT，虽可能导致 /static 404，但便于日志定位
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
    "/static/",   # 集中静态目录
    "/pdf-home/",
    "/pdf-viewer/",
    "/assets/",
    "/vendor/",
    "/js/",
)
