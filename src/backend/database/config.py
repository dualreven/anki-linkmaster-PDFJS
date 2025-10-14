"""
数据库配置模块（简化版）

目标：
- 路径解析尽量简单稳定；默认相对当前模块的项目根，使用 <root>/data 作为数据目录；
- 若目录不存在则直接创建；
- 提供可选的全局数据目录覆盖（set_data_dir），以支持特殊部署场景；
- get_db_path 始终返回 <data_dir>/anki_linkmaster.db。

创建日期: 2025-10-05
版本: v2.0（简化路径解析）
"""

from pathlib import Path
from typing import Dict, Any, Optional
import logging

# 项目根目录（向上3级：database -> backend -> src -> root）
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# 允许外部设置数据目录（可选）；未设置时使用默认：<PROJECT_ROOT>/data
_DATA_DIR: Optional[Path] = None
_DB_PATH: Optional[Path] = None

# 数据库配置
DATABASE_CONFIG: Dict[str, Any] = {
    # 兼容保留：支持原先的键名，但实际只取文件名部分
    'db_path': 'data/anki_linkmaster.db',
    'timeout': 10.0,
    'check_same_thread': False,
    'isolation_level': 'DEFERRED',
    'pool_size': 5,
}

# PRAGMA 优化配置
PRAGMA_SETTINGS: Dict[str, str] = {
    'foreign_keys': 'ON',           # 启用外键约束
    'journal_mode': 'WAL',          # 启用 WAL 模式（Write-Ahead Logging）
    'synchronous': 'NORMAL',        # 同步模式（平衡性能和安全）
    'temp_store': 'MEMORY',         # 临时表存储在内存
    'cache_size': '-64000',         # 缓存大小（-64000 = 64MB）
}
def set_data_dir(data_dir: Optional[str]) -> None:
    """可选：设置自定义数据目录（形如 "/path/to/data"）。

    说明：
    - 若不调用此函数，将使用默认目录：<PROJECT_ROOT>/data；
    - 若传入 None，将恢复为默认目录；
    - 该函数不会立即创建目录，创建逻辑在 get_data_dir()/get_db_path() 中。
    """
    global _DATA_DIR
    _DATA_DIR = Path(data_dir).resolve() if data_dir else None


def set_db_path(db_path: Optional[str]) -> None:
    """可选：设置自定义数据库文件绝对路径。"""
    global _DB_PATH
    _DB_PATH = Path(db_path).resolve() if db_path else None


def compute_component_root(runtime_mode: str, *, ankiaddon_root_path: Optional[str] = None, project_root: Optional[Path] = None) -> Path:
    """基于运行模式计算组件根目录（参数式，无环境变量）。

    Args:
        runtime_mode: 'anki' | 'single'
        ankiaddon_root_path: 当 runtime_mode='anki' 时必须提供插件根目录
        project_root: 可选，默认使用模块推导的 PROJECT_ROOT

    Returns:
        组件根目录 Path
    """
    mode = (runtime_mode or '').lower()
    prj = project_root or PROJECT_ROOT
    if mode == 'anki':
        if not ankiaddon_root_path:
            raise RuntimeError("Anki 模式需要提供 ankiaddon_root_path")
        return Path(ankiaddon_root_path).resolve() / 'lib' / 'pdf_sys'
    elif mode == 'single':
        return prj
    else:
        raise RuntimeError("未知的 runtime_mode，期望 'anki' 或 'single'")


def get_data_dir() -> Path:
    """获取数据目录（默认单机模式）。

    优先级：
    1) `set_data_dir(dir)` 显式设置；
    2) `set_db_path(file)` 显式设置（返回其父目录）；
    3) 兜底：`<PROJECT_ROOT>/data`。
    """
    if _DATA_DIR is not None:
        base = _DATA_DIR
    elif _DB_PATH is not None:
        base = _DB_PATH.parent
    else:
        base = PROJECT_ROOT / 'data'

    if not base.exists():
        try:
            base.mkdir(parents=True, exist_ok=True)
            try:
                logging.getLogger('database.config').info('created data directory: %s', str(base))
            except Exception:
                pass
        except Exception:
            pass
    return base


def resolve_db_base_dir(this_file: Optional[Path] = None, cwd: Optional[Path] = None) -> Path:
    """兼容接口：返回默认项目根（单机模式）。"""
    return PROJECT_ROOT


def compute_data_dir(runtime_mode: str, *, ankiaddon_root_path: Optional[str] = None, project_root: Optional[Path] = None) -> Path:
    """基于运行模式计算数据目录（参数式）。"""
    return compute_component_root(runtime_mode, ankiaddon_root_path=ankiaddon_root_path, project_root=project_root) / 'data'


def compute_db_path(runtime_mode: str, *, ankiaddon_root_path: Optional[str] = None, project_root: Optional[Path] = None,
                    db_file_name: str = 'anki_linkmaster.db') -> Path:
    """基于运行模式计算数据库文件路径（参数式）。"""
    return compute_data_dir(runtime_mode, ankiaddon_root_path=ankiaddon_root_path, project_root=project_root) / db_file_name


def get_db_path() -> Path:
    """
    获取数据库文件路径（绝对路径）

    Returns:
        Path: 数据库文件的绝对路径

    Example:
        >>> db_path = get_db_path()
        >>> print(db_path)
        C:/Users/napretep/PycharmProjects/anki-linkmaster-PDFJS/data/anki_linkmaster.db
    """
    # 兼容：从配置项提取文件名部分
    rel = Path(DATABASE_CONFIG.get('db_path', 'anki_linkmaster.db'))
    db_name = rel.name or 'anki_linkmaster.db'
    path = get_data_dir() / db_name
    if not path.parent.exists():
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            try:
                logging.getLogger('database.config').info('created db directory: %s', str(path.parent))
            except Exception:
                pass
        except Exception:
            pass
    return path


def get_connection_options() -> Dict[str, Any]:
    """
    获取连接选项（排除 db_path）

    Returns:
        Dict[str, Any]: 连接选项字典

    Example:
        >>> options = get_connection_options()
        >>> print(options)
        {'timeout': 10.0, 'check_same_thread': False, ...}
    """
    return {
        'timeout': DATABASE_CONFIG['timeout'],
        'check_same_thread': DATABASE_CONFIG['check_same_thread'],
        'isolation_level': DATABASE_CONFIG['isolation_level'],
        'pool_size': DATABASE_CONFIG['pool_size'],
    }
