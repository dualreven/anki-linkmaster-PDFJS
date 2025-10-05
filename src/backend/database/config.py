"""
数据库配置模块

定义数据库连接配置、PRAGMA 优化设置等。

创建日期: 2025-10-05
版本: v1.0
"""

from pathlib import Path
from typing import Dict, Any

# 项目根目录（向上3级：database -> backend -> src -> root）
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

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
    return PROJECT_ROOT / DATABASE_CONFIG['db_path']


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
