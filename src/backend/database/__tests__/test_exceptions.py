"""
异常类测试

测试所有自定义异常类。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest

from ..exceptions import (
    DatabaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTransactionError,
    DatabaseConstraintError,
    DatabaseValidationError
)


class TestDatabaseExceptions:
    """异常类测试"""

    def test_database_error_hierarchy(self):
        """测试：异常继承层次"""
        # 所有异常都继承自 DatabaseError
        assert issubclass(DatabaseConnectionError, DatabaseError)
        assert issubclass(DatabaseQueryError, DatabaseError)
        assert issubclass(DatabaseTransactionError, DatabaseError)
        assert issubclass(DatabaseConstraintError, DatabaseError)
        assert issubclass(DatabaseValidationError, DatabaseError)

    def test_database_error_raise(self):
        """测试：抛出 DatabaseError"""
        with pytest.raises(DatabaseError) as exc_info:
            raise DatabaseError("测试错误")

        assert "测试错误" in str(exc_info.value)

    def test_database_connection_error_raise(self):
        """测试：抛出 DatabaseConnectionError"""
        with pytest.raises(DatabaseConnectionError) as exc_info:
            raise DatabaseConnectionError("无法连接到数据库")

        assert "无法连接到数据库" in str(exc_info.value)

    def test_database_query_error_raise(self):
        """测试：抛出 DatabaseQueryError"""
        with pytest.raises(DatabaseQueryError) as exc_info:
            raise DatabaseQueryError("SQL 语法错误")

        assert "SQL 语法错误" in str(exc_info.value)

    def test_database_transaction_error_raise(self):
        """测试：抛出 DatabaseTransactionError"""
        with pytest.raises(DatabaseTransactionError) as exc_info:
            raise DatabaseTransactionError("事务提交失败")

        assert "事务提交失败" in str(exc_info.value)

    def test_database_constraint_error_raise(self):
        """测试：抛出 DatabaseConstraintError"""
        with pytest.raises(DatabaseConstraintError) as exc_info:
            raise DatabaseConstraintError("主键冲突")

        assert "主键冲突" in str(exc_info.value)

    def test_database_validation_error_raise(self):
        """测试：抛出 DatabaseValidationError"""
        with pytest.raises(DatabaseValidationError) as exc_info:
            raise DatabaseValidationError("字段不能为空")

        assert "字段不能为空" in str(exc_info.value)

    def test_catch_specific_exception(self):
        """测试：捕获特定异常"""
        try:
            raise DatabaseQueryError("查询失败")
        except DatabaseQueryError as e:
            assert "查询失败" in str(e)
        except DatabaseError:
            pytest.fail("不应该捕获到 DatabaseError")

    def test_catch_base_exception(self):
        """测试：捕获基类异常"""
        exceptions_caught = []

        for exc_class in [
            DatabaseConnectionError,
            DatabaseQueryError,
            DatabaseTransactionError,
            DatabaseConstraintError,
            DatabaseValidationError
        ]:
            try:
                raise exc_class("测试")
            except DatabaseError:
                exceptions_caught.append(exc_class.__name__)

        # 所有异常都应该被捕获
        assert len(exceptions_caught) == 5
