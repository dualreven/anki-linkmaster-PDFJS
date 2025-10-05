"""
事务管理器测试

测试 TransactionManager 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest
import sqlite3

from ..transaction import TransactionManager
from ..exceptions import DatabaseTransactionError


class TestTransactionManager:
    """事务管理器测试类"""

    def test_commit_transaction(self, db_connection):
        """测试：正常提交事务"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        # 创建表
        cursor.execute("CREATE TABLE test (id INTEGER)")

        # 开启事务并插入数据
        txn.begin()
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.commit()

        # 验证数据已提交
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 1
        assert result[0][0] == 1

    def test_rollback_transaction(self, db_connection):
        """测试：回滚事务"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        # 创建表
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 开启事务并插入数据
        txn.begin()
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.rollback()

        # 验证数据已回滚
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 0

    def test_context_manager_auto_commit(self, db_connection):
        """测试：上下文管理器自动提交"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 使用上下文管理器
        with TransactionManager(db_connection):
            cursor.execute("INSERT INTO test VALUES (1)")
            # 退出时自动 commit

        # 验证数据已提交
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 1

    def test_context_manager_auto_rollback(self, db_connection):
        """测试：上下文管理器异常时自动回滚"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 使用上下文管理器，故意抛异常
        try:
            with TransactionManager(db_connection):
                cursor.execute("INSERT INTO test VALUES (1)")
                raise ValueError("Test error")
        except ValueError:
            pass

        # 验证数据已回滚
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 0

    def test_nested_transaction_commit(self, db_connection):
        """测试：嵌套事务提交"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 主事务
        with TransactionManager(db_connection):
            cursor.execute("INSERT INTO test VALUES (1)")

            # 嵌套事务
            with TransactionManager(db_connection):
                cursor.execute("INSERT INTO test VALUES (2)")
                # 嵌套事务提交

            # 主事务提交

        # 验证所有数据已提交
        cursor.execute("SELECT * FROM test ORDER BY id")
        result = cursor.fetchall()
        assert len(result) == 2
        assert result[0][0] == 1
        assert result[1][0] == 2

    def test_nested_transaction_rollback_inner(self, db_connection):
        """测试：嵌套事务内层回滚，外层提交"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 主事务
        with TransactionManager(db_connection):
            cursor.execute("INSERT INTO test VALUES (1)")

            # 嵌套事务（回滚）
            try:
                with TransactionManager(db_connection):
                    cursor.execute("INSERT INTO test VALUES (2)")
                    raise ValueError("Test error")
            except ValueError:
                pass

            # 主事务继续
            cursor.execute("INSERT INTO test VALUES (3)")

        # 验证：外层提交，内层回滚
        cursor.execute("SELECT * FROM test ORDER BY id")
        result = cursor.fetchall()
        assert len(result) == 2
        assert result[0][0] == 1
        assert result[1][0] == 3

    def test_nested_transaction_rollback_outer(self, db_connection):
        """测试：嵌套事务外层回滚，全部回滚"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 主事务（回滚）
        try:
            with TransactionManager(db_connection):
                cursor.execute("INSERT INTO test VALUES (1)")

                # 嵌套事务（正常提交）
                with TransactionManager(db_connection):
                    cursor.execute("INSERT INTO test VALUES (2)")

                # 主事务抛异常
                raise ValueError("Test error")
        except ValueError:
            pass

        # 验证：全部回滚
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 0

    def test_multiple_commits(self, db_connection):
        """测试：多次提交"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        # 第一次事务
        txn.begin()
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.commit()

        # 第二次事务
        txn.begin()
        cursor.execute("INSERT INTO test VALUES (2)")
        txn.commit()

        # 验证数据
        cursor.execute("SELECT * FROM test ORDER BY id")
        result = cursor.fetchall()
        assert len(result) == 2

    def test_rollback_without_error(self, db_connection):
        """测试：主动调用回滚"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER)")
        db_connection.commit()

        txn.begin()
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.rollback()

        # 再次插入
        txn.begin()
        cursor.execute("INSERT INTO test VALUES (2)")
        txn.commit()

        # 验证：只有第二次插入成功
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 1
        assert result[0][0] == 2
