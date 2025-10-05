"""
事务管理器模块

提供事务的开启、提交、回滚能力，支持嵌套事务（Savepoint）。

创建日期: 2025-10-05
版本: v1.0
"""

import sqlite3
from typing import Optional, Any, List

from .exceptions import DatabaseTransactionError


class TransactionManager:
    """
    事务管理器（支持上下文管理器）

    特性:
    - 支持嵌套事务（使用 Savepoint）
    - 异常时自动回滚
    - 正常退出时自动提交
    - 记录事务日志（调试模式）

    Example:
        >>> txn = TransactionManager(conn)
        >>> txn.begin()
        >>> # ... 执行 SQL
        >>> txn.commit()

        >>> # 使用上下文管理器
        >>> with TransactionManager(conn) as txn:
        ...     cursor.execute("INSERT ...")
        ...     cursor.execute("UPDATE ...")
        ...     # 自动 commit；异常时自动 rollback
    """

    # 类级别的事务跟踪（每个连接一个）
    _transaction_depth = {}

    def __init__(
        self,
        connection: sqlite3.Connection,
        logger: Optional[Any] = None
    ):
        """
        初始化事务管理器

        Args:
            connection: SQLite 连接对象
            logger: 日志记录器（可选）

        Example:
            >>> txn = TransactionManager(conn)
            >>> txn = TransactionManager(conn, logger=my_logger)
        """
        self._conn = connection
        self._logger = logger
        self._savepoint_counter = 0
        self._savepoint_stack: List[str] = []

        # 初始化连接的事务深度
        conn_id = id(connection)
        if conn_id not in TransactionManager._transaction_depth:
            TransactionManager._transaction_depth[conn_id] = 0

    def begin(self) -> None:
        """
        开启事务

        - 第一次调用：开启主事务（BEGIN）
        - 嵌套调用：创建 Savepoint（SAVEPOINT sp_1）

        Example:
            >>> txn = TransactionManager(conn)
            >>> txn.begin()
            >>> # ... 执行 SQL
            >>> txn.commit()
        """
        try:
            conn_id = id(self._conn)
            depth = TransactionManager._transaction_depth[conn_id]

            if depth == 0:
                # 主事务：BEGIN
                self._conn.execute("BEGIN")
                if self._logger:
                    self._logger.debug("Transaction started (BEGIN)")
            else:
                # 嵌套事务：SAVEPOINT sp_N
                self._savepoint_counter += 1
                savepoint_name = f"sp_{self._savepoint_counter}"
                self._conn.execute(f"SAVEPOINT {savepoint_name}")
                self._savepoint_stack.append(savepoint_name)
                if self._logger:
                    self._logger.debug(f"Savepoint created: {savepoint_name}")

            # 增加事务深度
            TransactionManager._transaction_depth[conn_id] += 1

        except sqlite3.Error as e:
            raise DatabaseTransactionError(
                f"开启事务失败: {e}"
            ) from e

    def commit(self) -> None:
        """
        提交事务

        - 主事务：COMMIT
        - 嵌套事务：RELEASE SAVEPOINT

        Raises:
            DatabaseTransactionError: 提交失败

        Example:
            >>> txn.commit()
        """
        try:
            conn_id = id(self._conn)

            if not self._savepoint_stack:
                # 主事务：COMMIT
                self._conn.commit()
                if self._logger:
                    self._logger.debug("Transaction committed (COMMIT)")
            else:
                # 嵌套事务：RELEASE SAVEPOINT
                savepoint_name = self._savepoint_stack.pop()
                self._conn.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                if self._logger:
                    self._logger.debug(f"Savepoint released: {savepoint_name}")

            # 减少事务深度
            TransactionManager._transaction_depth[conn_id] -= 1

        except sqlite3.Error as e:
            raise DatabaseTransactionError(
                f"提交事务失败: {e}"
            ) from e

    def rollback(self) -> None:
        """
        回滚事务

        - 主事务：ROLLBACK
        - 嵌套事务：ROLLBACK TO SAVEPOINT

        Example:
            >>> txn.rollback()
        """
        try:
            conn_id = id(self._conn)

            if not self._savepoint_stack:
                # 主事务：ROLLBACK
                self._conn.rollback()
                if self._logger:
                    self._logger.debug("Transaction rolled back (ROLLBACK)")
            else:
                # 嵌套事务：ROLLBACK TO SAVEPOINT
                savepoint_name = self._savepoint_stack.pop()
                self._conn.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
                if self._logger:
                    self._logger.debug(
                        f"Savepoint rolled back: {savepoint_name}"
                    )

            # 减少事务深度
            TransactionManager._transaction_depth[conn_id] -= 1

        except sqlite3.Error as e:
            if self._logger:
                self._logger.error(f"回滚事务失败: {e}")
            # 回滚失败不抛异常，避免掩盖原始异常

    def __enter__(self):
        """
        进入上下文（自动 begin）

        Example:
            >>> with TransactionManager(conn) as txn:
            ...     cursor.execute("INSERT ...")
            ...     cursor.execute("UPDATE ...")
            ...     # 自动 commit；异常时自动 rollback
        """
        self.begin()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        退出上下文（自动 commit/rollback）

        Args:
            exc_type: 异常类型
            exc_val: 异常值
            exc_tb: 异常堆栈

        Returns:
            False: 不抑制异常（异常会向上抛出）
        """
        if exc_type is not None:
            # 有异常，回滚
            self.rollback()
            if self._logger:
                self._logger.error(f"Transaction rolled back: {exc_val}")
        else:
            # 无异常，提交
            self.commit()
            if self._logger:
                self._logger.debug("Transaction committed")

        return False  # 不抑制异常
