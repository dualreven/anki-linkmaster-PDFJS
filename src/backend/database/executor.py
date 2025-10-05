"""
SQL 执行器模块

提供 SQL 语句执行功能，包括查询、更新、批量、脚本执行。

创建日期: 2025-10-05
版本: v1.0
"""

import sqlite3
from typing import List, Dict, Optional, Union, Any

from .exceptions import DatabaseQueryError, DatabaseConstraintError


class SQLExecutor:
    """
    SQL 执行器

    特性:
    - 自动参数绑定（防止 SQL 注入）
    - Row Factory（将结果转为字典）
    - 异常转换（SQLite 异常 → 自定义异常）
    - 查询日志（DEBUG 模式）

    Example:
        >>> executor = SQLExecutor(conn)
        >>> results = executor.execute_query(
        ...     "SELECT * FROM pdf_info WHERE uuid = ?",
        ...     ('abc123',)
        ... )
        >>> print(results)
        [{'uuid': 'abc123', 'title': 'Test', ...}]
    """

    def __init__(
        self,
        connection: sqlite3.Connection,
        logger: Optional[Any] = None
    ):
        """
        初始化 SQL 执行器

        Args:
            connection: SQLite 连接对象
            logger: 日志记录器（可选）

        Example:
            >>> executor = SQLExecutor(conn)
            >>> executor = SQLExecutor(conn, logger=my_logger)
        """
        self._conn = connection
        self._logger = logger
        self._setup_row_factory()

    def execute_query(
        self,
        sql: str,
        params: Optional[Union[tuple, dict]] = None
    ) -> List[Dict[str, Any]]:
        """
        执行查询语句（SELECT）

        Args:
            sql: SQL 语句（可包含占位符 ? 或 :name）
            params: 参数（元组或字典）

        Returns:
            结果列表（每行为字典）

        Raises:
            DatabaseQueryError: 查询失败

        Example:
            >>> executor = SQLExecutor(conn)
            >>> results = executor.execute_query(
            ...     "SELECT * FROM pdf_info WHERE uuid = ?",
            ...     ('abc123',)
            ... )
            >>> print(results)
            [{'uuid': 'abc123', 'title': 'Test', ...}]
        """
        try:
            self._log_query(sql, params)

            cursor = self._conn.cursor()

            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)

            results = cursor.fetchall()

            return results

        except sqlite3.OperationalError as e:
            raise DatabaseQueryError(
                f"SQL 执行失败: {sql}, 错误: {e}"
            ) from e
        except sqlite3.Error as e:
            raise DatabaseQueryError(
                f"查询失败: {e}"
            ) from e

    def execute_update(
        self,
        sql: str,
        params: Optional[Union[tuple, dict]] = None
    ) -> int:
        """
        执行更新语句（INSERT/UPDATE/DELETE）

        Args:
            sql: SQL 语句
            params: 参数

        Returns:
            影响的行数

        Raises:
            DatabaseQueryError: 执行失败
            DatabaseConstraintError: 约束违反

        Example:
            >>> rows = executor.execute_update(
            ...     "INSERT INTO pdf_info (uuid, title) VALUES (?, ?)",
            ...     ('abc123', 'Test')
            ... )
            >>> print(rows)  # 1
        """
        try:
            self._log_query(sql, params)

            cursor = self._conn.cursor()

            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)

            self._conn.commit()

            return cursor.rowcount

        except sqlite3.IntegrityError as e:
            # 约束违反（主键冲突、外键违反等）
            if 'UNIQUE constraint failed' in str(e):
                raise DatabaseConstraintError(
                    f"主键冲突: {e}"
                ) from e
            elif 'FOREIGN KEY constraint failed' in str(e):
                raise DatabaseConstraintError(
                    f"外键违反: {e}"
                ) from e
            elif 'NOT NULL constraint failed' in str(e):
                raise DatabaseConstraintError(
                    f"非空约束违反: {e}"
                ) from e
            else:
                raise DatabaseConstraintError(
                    f"约束违反: {e}"
                ) from e

        except sqlite3.OperationalError as e:
            raise DatabaseQueryError(
                f"SQL 执行失败: {sql}, 错误: {e}"
            ) from e
        except sqlite3.Error as e:
            raise DatabaseQueryError(
                f"更新失败: {e}"
            ) from e

    def execute_batch(
        self,
        sql: str,
        params_list: List[Union[tuple, dict]]
    ) -> int:
        """
        批量执行（使用 executemany）

        Args:
            sql: SQL 语句
            params_list: 参数列表

        Returns:
            总影响行数

        Raises:
            DatabaseQueryError: 执行失败
            DatabaseConstraintError: 约束违反

        Example:
            >>> rows = executor.execute_batch(
            ...     "INSERT INTO pdf_info (uuid, title) VALUES (?, ?)",
            ...     [
            ...         ('abc123', 'Test1'),
            ...         ('def456', 'Test2'),
            ...         ('ghi789', 'Test3'),
            ...     ]
            ... )
            >>> print(rows)  # 3
        """
        try:
            self._log_query(sql, params_list)

            cursor = self._conn.cursor()
            cursor.executemany(sql, params_list)
            self._conn.commit()

            return cursor.rowcount

        except sqlite3.IntegrityError as e:
            # 约束违反
            raise DatabaseConstraintError(
                f"批量执行约束违反: {e}"
            ) from e

        except sqlite3.OperationalError as e:
            raise DatabaseQueryError(
                f"SQL 执行失败: {sql}, 错误: {e}"
            ) from e
        except sqlite3.Error as e:
            raise DatabaseQueryError(
                f"批量执行失败: {e}"
            ) from e

    def execute_script(self, script: str) -> None:
        """
        执行 SQL 脚本（建表、迁移等）

        Args:
            script: SQL 脚本（多条语句，用分号分隔）

        Raises:
            DatabaseQueryError: 执行失败

        Example:
            >>> script = '''
            ... CREATE TABLE IF NOT EXISTS test (id INTEGER);
            ... CREATE INDEX IF NOT EXISTS idx_test ON test(id);
            ... '''
            >>> executor.execute_script(script)
        """
        try:
            self._log_query(script, None)

            cursor = self._conn.cursor()
            cursor.executescript(script)
            self._conn.commit()

        except sqlite3.OperationalError as e:
            raise DatabaseQueryError(
                f"脚本执行失败: {e}"
            ) from e
        except sqlite3.Error as e:
            raise DatabaseQueryError(
                f"脚本执行失败: {e}"
            ) from e

    def _setup_row_factory(self) -> None:
        """
        设置 Row Factory（私有方法）

        将查询结果转为字典格式:
        - (value1, value2, ...) → {'col1': value1, 'col2': value2, ...}
        """
        def dict_factory(cursor, row):
            # 如果没有 description（UPDATE/INSERT/DELETE），返回原始行
            if cursor.description is None:
                return row

            return {
                col[0]: row[idx]
                for idx, col in enumerate(cursor.description)
            }

        self._conn.row_factory = dict_factory

    def _log_query(
        self,
        sql: str,
        params: Optional[Union[tuple, dict, List]]
    ) -> None:
        """记录查询日志（私有方法）"""
        if self._logger:
            self._logger.debug(f"SQL: {sql}")
            if params:
                # 限制日志长度
                if isinstance(params, list) and len(params) > 5:
                    self._logger.debug(
                        f"Params: {params[:5]} ... (共 {len(params)} 条)"
                    )
                else:
                    self._logger.debug(f"Params: {params}")
