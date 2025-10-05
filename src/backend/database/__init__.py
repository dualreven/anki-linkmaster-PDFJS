"""
数据库模块

提供统一、安全、高效的数据库访问接口。

主要组件:
- DatabaseConnectionManager: 连接池管理器
- TransactionManager: 事务管理器
- SQLExecutor: SQL 执行器
- 异常类: DatabaseError 及其子类

创建日期: 2025-10-05
版本: v1.0
"""

from .config import (
    DATABASE_CONFIG,
    PRAGMA_SETTINGS,
    get_db_path,
    get_connection_options
)

from .exceptions import (
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTransactionError,
    DatabaseConstraintError,
    DatabaseValidationError
)

from .connection import DatabaseConnectionManager
from .transaction import TransactionManager
from .executor import SQLExecutor

__all__ = [
    # 配置
    'DATABASE_CONFIG',
    'PRAGMA_SETTINGS',
    'get_db_path',
    'get_connection_options',

    # 异常
    'DatabaseError',
    'DatabaseConnectionError',
    'DatabaseQueryError',
    'DatabaseTransactionError',
    'DatabaseConstraintError',
    'DatabaseValidationError',

    # 核心类
    'DatabaseConnectionManager',
    'TransactionManager',
    'SQLExecutor',
]
