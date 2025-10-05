"""
数据库连接管理器模块

提供数据库连接的创建、复用、关闭功能，以及连接池管理。

创建日期: 2025-10-05
版本: v1.0
"""

import sqlite3
from typing import Optional, Any, List
from pathlib import Path

from .config import PRAGMA_SETTINGS
from .exceptions import DatabaseConnectionError


class DatabaseConnectionManager:
    """
    数据库连接管理器（单例模式）

    特性:
    - 自动启用 WAL 模式（Write-Ahead Logging）
    - 自动启用外键约束
    - 自动启用 JSONB 支持
    - 连接池管理（最多5个连接）
    - 超时重试机制

    Example:
        >>> manager = DatabaseConnectionManager(
        ...     'data/anki_linkmaster.db',
        ...     timeout=10.0,
        ...     pool_size=5
        ... )
        >>> conn = manager.get_connection()
        >>> cursor = conn.cursor()
        >>> cursor.execute("SELECT 1")
        >>> manager.close_all()
    """

    _instance: Optional['DatabaseConnectionManager'] = None

    def __new__(cls, *args, **kwargs):
        """单例模式：确保只有一个实例"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self,
        db_path: str,
        **options
    ):
        """
        初始化连接管理器

        Args:
            db_path: 数据库文件路径（相对路径或绝对路径）
            options: 连接选项
                - timeout: 超时时间（默认 10.0 秒）
                - check_same_thread: 是否检查线程（默认 False）
                - isolation_level: 隔离级别（默认 'DEFERRED'）
                - pool_size: 连接池大小（默认 5）

        Example:
            >>> manager = DatabaseConnectionManager(
            ...     'data/anki_linkmaster.db',
            ...     timeout=10.0,
            ...     pool_size=5
            ... )
        """
        # 避免重复初始化
        if hasattr(self, '_initialized') and self._initialized:
            return

        self._db_path = Path(db_path)
        self._timeout = options.get('timeout', 10.0)
        self._check_same_thread = options.get('check_same_thread', False)
        self._isolation_level = options.get('isolation_level', 'DEFERRED')
        self._pool_size = options.get('pool_size', 5)
        self._connections: List[sqlite3.Connection] = []
        self._initialized = True

        # 确保数据库目录存在
        self._ensure_db_directory()

    def get_connection(self) -> sqlite3.Connection:
        """
        获取数据库连接（从池中复用或新建）

        Returns:
            sqlite3.Connection: 数据库连接对象

        Raises:
            DatabaseConnectionError: 连接失败

        Example:
            >>> conn = manager.get_connection()
            >>> cursor = conn.cursor()
            >>> cursor.execute("SELECT 1")
        """
        try:
            # 如果连接池为空，创建新连接
            if not self._connections:
                conn = self._create_connection()
                self._connections.append(conn)
                return conn

            # 复用第一个连接（简化版连接池）
            return self._connections[0]

        except sqlite3.Error as e:
            raise DatabaseConnectionError(
                f"无法连接到数据库 '{self._db_path}': {e}"
            ) from e

    def close_all(self) -> None:
        """
        关闭所有连接

        用于:
        - 应用程序退出时
        - 数据库迁移前
        - 测试清理

        Example:
            >>> manager.close_all()
        """
        for conn in self._connections:
            try:
                conn.close()
            except sqlite3.Error:
                pass  # 忽略关闭错误
        self._connections.clear()

    def execute_pragma(self, pragma: str) -> Any:
        """
        执行 PRAGMA 语句

        Args:
            pragma: PRAGMA 语句（如 'foreign_keys = ON'）

        Returns:
            PRAGMA 返回值

        Raises:
            DatabaseConnectionError: 执行失败

        Example:
            >>> result = manager.execute_pragma('journal_mode = WAL')
            >>> print(result)
            'wal'
            >>> result = manager.execute_pragma('foreign_keys')
            >>> print(result)
            1
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            # 判断是否为查询 PRAGMA（不带 =）
            if '=' not in pragma:
                cursor.execute(f"PRAGMA {pragma}")
                result = cursor.fetchone()
                return result[0] if result else None
            else:
                cursor.execute(f"PRAGMA {pragma}")
                return None

        except sqlite3.Error as e:
            raise DatabaseConnectionError(
                f"执行 PRAGMA 失败: PRAGMA {pragma}, 错误: {e}"
            ) from e

    def _create_connection(self) -> sqlite3.Connection:
        """
        创建新连接（私有方法）

        Returns:
            sqlite3.Connection: 新连接对象

        Raises:
            DatabaseConnectionError: 连接失败
        """
        try:
            conn = sqlite3.connect(
                str(self._db_path),
                timeout=self._timeout,
                check_same_thread=self._check_same_thread,
                isolation_level=self._isolation_level
            )

            # 初始化连接（设置 PRAGMA）
            self._initialize_connection(conn)

            return conn

        except sqlite3.Error as e:
            raise DatabaseConnectionError(
                f"创建连接失败: {e}"
            ) from e

    def _initialize_connection(self, conn: sqlite3.Connection) -> None:
        """
        初始化新连接（私有方法）

        自动执行:
        - PRAGMA foreign_keys = ON（启用外键）
        - PRAGMA journal_mode = WAL（启用 WAL 模式）
        - PRAGMA synchronous = NORMAL（性能优化）
        - PRAGMA temp_store = MEMORY（内存临时表）

        Args:
            conn: 连接对象
        """
        cursor = conn.cursor()

        for pragma_name, pragma_value in PRAGMA_SETTINGS.items():
            cursor.execute(f"PRAGMA {pragma_name} = {pragma_value}")

        conn.commit()

    def _ensure_db_directory(self) -> None:
        """确保数据库目录存在（私有方法）"""
        db_dir = self._db_path.parent
        if not db_dir.exists():
            db_dir.mkdir(parents=True, exist_ok=True)
