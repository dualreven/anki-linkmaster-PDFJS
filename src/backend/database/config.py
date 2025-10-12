"""
数据库配置模块

定义数据库连接配置、PRAGMA 优化设置等。

创建日期: 2025-10-05
版本: v1.0
"""

from pathlib import Path
from typing import Dict, Any, Optional
import os

# 项目根目录（向上3级：database -> backend -> src -> root）
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# 数据库配置
DATABASE_CONFIG: Dict[str, Any] = {
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


def _env_dist_root() -> Optional[Path]:
    """通过环境变量解析发行根目录。

    支持的环境变量（按优先级）：
    - LINKMASTER_BASE_DIR
    - LINKMASTER_DIST_ROOT
    - LINKMASTER_ROOT

    Returns:
        若存在有效目录则返回 Path，否则 None。
    """
    keys = ("LINKMASTER_BASE_DIR", "LINKMASTER_DIST_ROOT", "LINKMASTER_ROOT")
    for k in keys:
        val = os.environ.get(k)
        if not val:
            continue
        try:
            p = Path(val).resolve()
            if p.exists():
                return p
        except Exception:
            continue
    return None


def _find_dist_root_from_cwd(cwd: Optional[Path] = None) -> Optional[Path]:
    """在当前工作目录向上查找可用的发行/插件根目录。

    优先匹配：
    - .../dist/latest
    - .../pdf_sys
    - 父层存在子目录 lib/pdf_sys（Anki 插件打包常见结构）

    Args:
        cwd: 当前工作目录（可注入以便测试）；默认使用 Path.cwd()

    Returns:
        若找到匹配目录则返回 Path，否则 None。
    """
    current = (cwd or Path.cwd()).resolve()
    for p in [current] + list(current.parents):
        try:
            # 直接命中：dist/latest
            if p.name == 'latest' and p.parent.name == 'dist':
                return p
            # 直接命中：pdf_sys（Anki 插件布局）
            if p.name == 'pdf_sys':
                return p
            # 父层包含子目录 lib/pdf_sys → 选择该子目录为根
            candidate = p / 'lib' / 'pdf_sys'
            if candidate.exists():
                return candidate
        except Exception:
            # 防御性：路径遍历过程中保持健壮
            pass
    return None


def resolve_db_base_dir(this_file: Optional[Path] = None, cwd: Optional[Path] = None) -> Path:
    """解析数据库根目录（用于拼接 data/anki_linkmaster.db）。

    优先级：
    0) 若存在环境变量 LINKMASTER_BASE_DIR/LINKMASTER_DIST_ROOT/LINKMASTER_ROOT → 优先使用；
    1) 若当前模块文件路径位于 dist/latest/src/... 或 pdf_sys/src/... 下 → 使用其上层作为根；
    2) 否则，如当前工作目录向上可找到 dist/latest 或 lib/pdf_sys → 使用该目录；
    3) 否则，回退到基于源码位置推导的 PROJECT_ROOT。

    该设计确保：
    - 源码运行时，路径为 <repo>/data/...
    - dist 运行时（即便导入到了源码包），路径为 <repo>/dist/latest/data/...

    Args:
        this_file: 当前模块文件路径（可注入以便测试）；默认使用 __file__
        cwd: 当前工作目录（可注入以便测试）；默认使用 Path.cwd()

    Returns:
        数据库根目录（不包含 data/... 子目录）
    """
    # 情况 0：显式环境变量覆盖（最可靠，避免受 cwd 影响）
    env_root = _env_dist_root()
    if env_root is not None:
        return env_root

    fpath = (this_file or Path(__file__).resolve())
    # 情况 1：模块实际来自 dist 路径
    posix_path = fpath.as_posix()
    if (
        '/dist/latest/src/' in posix_path or
        '\\dist\\latest\\src\\' in str(fpath) or
        '/pdf_sys/src/' in posix_path or
        '\\pdf_sys\\src\\' in str(fpath)
    ):
        # four-level parents from .../dist/latest/src/backend/database/config.py → dist/latest
        try:
            return fpath.parent.parent.parent.parent
        except Exception:
            pass

    # 情况 2：通过 CWD 反推出 dist/latest 根
    dist_from_cwd = _find_dist_root_from_cwd(cwd=cwd)
    if dist_from_cwd is not None:
        return dist_from_cwd

    # 情况 3：回退源码根
    return PROJECT_ROOT


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
    base_dir = resolve_db_base_dir()
    return base_dir / DATABASE_CONFIG['db_path']


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
