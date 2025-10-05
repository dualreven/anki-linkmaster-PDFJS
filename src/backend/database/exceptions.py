"""
数据库异常定义模块

定义所有数据库相关的自定义异常类，用于统一错误处理。

异常层次结构:
- DatabaseError (基类)
  - DatabaseConnectionError (连接失败)
  - DatabaseQueryError (查询失败)
  - DatabaseTransactionError (事务失败)
  - DatabaseConstraintError (约束违反)
  - DatabaseValidationError (数据验证失败)

创建日期: 2025-10-05
版本: v1.0
"""


class DatabaseError(Exception):
    """
    数据库异常基类

    所有数据库相关异常的父类，用于捕获所有数据库异常。

    Example:
        >>> try:
        ...     # 数据库操作
        ...     pass
        ... except DatabaseError as e:
        ...     print(f"数据库错误: {e}")
    """
    pass


class DatabaseConnectionError(DatabaseError):
    """
    连接失败异常

    触发场景:
    - 数据库文件不存在
    - 无权限访问数据库文件
    - 连接超时
    - 连接池已满

    Example:
        >>> raise DatabaseConnectionError("无法连接到数据库: 文件不存在")
    """
    pass


class DatabaseQueryError(DatabaseError):
    """
    查询失败异常

    触发场景:
    - SQL 语法错误
    - 表不存在
    - 字段不存在
    - 参数数量不匹配
    - 查询执行超时

    Example:
        >>> raise DatabaseQueryError("SQL 语法错误: SELECT * FORM table")
    """
    pass


class DatabaseTransactionError(DatabaseError):
    """
    事务失败异常

    触发场景:
    - 事务提交失败
    - 事务回滚失败
    - 嵌套事务错误
    - 死锁检测

    Example:
        >>> raise DatabaseTransactionError("事务提交失败: 数据库已锁定")
    """
    pass


class DatabaseConstraintError(DatabaseError):
    """
    约束违反异常

    触发场景:
    - 主键冲突 (UNIQUE constraint failed)
    - 外键违反 (FOREIGN KEY constraint failed)
    - 非空约束 (NOT NULL constraint failed)
    - 检查约束 (CHECK constraint failed)

    Example:
        >>> raise DatabaseConstraintError("主键冲突: UUID 'abc123' 已存在")
    """
    pass


class DatabaseValidationError(DatabaseError):
    """
    数据验证失败异常

    触发场景:
    - 必填字段缺失
    - 字段类型错误
    - 字段值超出范围
    - JSON 格式错误
    - 业务规则验证失败

    Example:
        >>> raise DatabaseValidationError("字段 'title' 不能为空")
    """
    pass
