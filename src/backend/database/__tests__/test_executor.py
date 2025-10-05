"""
SQL 执行器测试

测试 SQLExecutor 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest
import sqlite3

from ..executor import SQLExecutor
from ..exceptions import DatabaseQueryError, DatabaseConstraintError


class TestSQLExecutor:
    """SQL 执行器测试类"""

    def test_execute_query_returns_dict_list(self, db_connection):
        """测试：查询返回字典列表"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        db_connection.commit()

        result = executor.execute_query("SELECT * FROM test")

        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], dict)
        assert result[0]['id'] == 1
        assert result[0]['name'] == 'Alice'

    def test_execute_query_with_params_tuple(self, db_connection):
        """测试：参数绑定（元组）"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        cursor.execute("INSERT INTO test VALUES (2, 'Bob')")
        db_connection.commit()

        result = executor.execute_query(
            "SELECT * FROM test WHERE id = ?",
            (1,)
        )

        assert len(result) == 1
        assert result[0]['name'] == 'Alice'

    def test_execute_query_with_named_params(self, db_connection):
        """测试：参数绑定（字典）"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        db_connection.commit()

        result = executor.execute_query(
            "SELECT * FROM test WHERE id = :id",
            {'id': 1}
        )

        assert len(result) == 1
        assert result[0]['name'] == 'Alice'

    def test_execute_query_empty_result(self, db_connection):
        """测试：查询返回空结果"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        db_connection.commit()

        result = executor.execute_query("SELECT * FROM test")

        assert result == []

    def test_execute_update_insert(self, db_connection):
        """测试：插入操作返回影响行数"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        db_connection.commit()

        rows = executor.execute_update(
            "INSERT INTO test VALUES (?, ?)",
            (1, 'Alice')
        )

        assert rows == 1

        # 验证插入成功
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 1

    def test_execute_update_update(self, db_connection):
        """测试：更新操作返回影响行数"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        cursor.execute("INSERT INTO test VALUES (2, 'Bob')")
        db_connection.commit()

        rows = executor.execute_update(
            "UPDATE test SET name = ? WHERE id = ?",
            ('Charlie', 1)
        )

        assert rows == 1

        # 验证更新成功（使用 executor.execute_query）
        result = executor.execute_query("SELECT name FROM test WHERE id = 1")
        assert result[0]['name'] == 'Charlie'

    def test_execute_update_delete(self, db_connection):
        """测试：删除操作返回影响行数"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        cursor.execute("INSERT INTO test VALUES (2, 'Bob')")
        db_connection.commit()

        rows = executor.execute_update("DELETE FROM test WHERE id = ?", (1,))

        assert rows == 1

        # 验证删除成功
        cursor.execute("SELECT * FROM test")
        result = cursor.fetchall()
        assert len(result) == 1

    def test_execute_batch(self, db_connection):
        """测试：批量执行"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        db_connection.commit()

        rows = executor.execute_batch(
            "INSERT INTO test VALUES (?, ?)",
            [
                (1, 'Alice'),
                (2, 'Bob'),
                (3, 'Charlie'),
            ]
        )

        assert rows == 3

        # 验证插入成功
        cursor.execute("SELECT * FROM test ORDER BY id")
        result = cursor.fetchall()
        assert len(result) == 3

    def test_execute_script(self, db_connection):
        """测试：执行 SQL 脚本"""
        executor = SQLExecutor(db_connection)

        script = '''
        CREATE TABLE test1 (id INTEGER);
        CREATE TABLE test2 (id INTEGER);
        INSERT INTO test1 VALUES (1);
        INSERT INTO test2 VALUES (2);
        '''

        executor.execute_script(script)

        # 验证表已创建（使用 executor.execute_query）
        tables_result = executor.execute_query(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [row['name'] for row in tables_result]
        assert 'test1' in tables
        assert 'test2' in tables

        # 验证数据已插入
        result1 = executor.execute_query("SELECT * FROM test1")
        assert result1[0]['id'] == 1
        result2 = executor.execute_query("SELECT * FROM test2")
        assert result2[0]['id'] == 2

    def test_sql_injection_prevention(self, db_connection):
        """测试：SQL 注入防御"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        cursor.execute("INSERT INTO test VALUES (2, 'Bob')")
        db_connection.commit()

        # 尝试 SQL 注入
        malicious_input = "1 OR 1=1"
        result = executor.execute_query(
            "SELECT * FROM test WHERE id = ?",
            (malicious_input,)
        )

        # 不应该返回所有行（因为参数被正确转义）
        assert len(result) == 0

    def test_unique_constraint_error(self, db_connection):
        """测试：主键冲突异常"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        db_connection.commit()

        # 第一次插入成功
        executor.execute_update("INSERT INTO test VALUES (?, ?)", (1, 'Alice'))

        # 第二次插入相同 ID，应该抛出 DatabaseConstraintError
        with pytest.raises(DatabaseConstraintError) as exc_info:
            executor.execute_update("INSERT INTO test VALUES (?, ?)", (1, 'Bob'))

        assert 'UNIQUE constraint' in str(exc_info.value) or '主键冲突' in str(exc_info.value)

    def test_foreign_key_constraint_error(self, db_connection):
        """测试：外键约束异常"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        # 启用外键
        cursor.execute("PRAGMA foreign_keys = ON")

        # 创建父表和子表
        cursor.execute("CREATE TABLE parent (id INTEGER PRIMARY KEY)")
        cursor.execute("""
            CREATE TABLE child (
                id INTEGER PRIMARY KEY,
                parent_id INTEGER,
                FOREIGN KEY (parent_id) REFERENCES parent(id)
            )
        """)
        db_connection.commit()

        # 插入不存在的父 ID，应该抛出 DatabaseConstraintError
        with pytest.raises(DatabaseConstraintError) as exc_info:
            executor.execute_update("INSERT INTO child VALUES (?, ?)", (1, 999))

        assert 'FOREIGN KEY constraint' in str(exc_info.value) or '外键违反' in str(exc_info.value)

    def test_not_null_constraint_error(self, db_connection):
        """测试：非空约束异常"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        db_connection.commit()

        # 插入 NULL 值，应该抛出 DatabaseConstraintError
        with pytest.raises(DatabaseConstraintError) as exc_info:
            executor.execute_update("INSERT INTO test (id) VALUES (?)", (1,))

        assert 'NOT NULL constraint' in str(exc_info.value) or '非空约束' in str(exc_info.value)

    def test_query_syntax_error(self, db_connection):
        """测试：SQL 语法错误"""
        executor = SQLExecutor(db_connection)

        # 执行语法错误的 SQL，应该抛出 DatabaseQueryError
        with pytest.raises(DatabaseQueryError):
            executor.execute_query("SELECT * FORM test")  # FORM 应该是 FROM

    def test_table_not_exist_error(self, db_connection):
        """测试：表不存在错误"""
        executor = SQLExecutor(db_connection)

        # 查询不存在的表，应该抛出 DatabaseQueryError
        with pytest.raises(DatabaseQueryError):
            executor.execute_query("SELECT * FROM nonexistent_table")

    def test_row_factory_dict(self, db_connection):
        """测试：Row Factory 返回字典"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT, age INTEGER)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice', 30)")
        db_connection.commit()

        result = executor.execute_query("SELECT * FROM test")

        assert len(result) == 1
        row = result[0]
        assert isinstance(row, dict)
        assert set(row.keys()) == {'id', 'name', 'age'}
        assert row['id'] == 1
        assert row['name'] == 'Alice'
        assert row['age'] == 30
