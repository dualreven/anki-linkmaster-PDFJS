# 后端数据库系统 - 第一期需求文档

**期数**: 第一期 - 数据库抽象层
**版本**: v1.0
**创建日期**: 2025-10-05
**预计工期**: 2天
**依赖**: 无（基础层）
**设计参考**: `AItemp/database-design-final-v2.md`

---

## 📋 概述

### 目标
封装 SQLite3 库的基本 API，提供统一、安全、高效的数据库访问接口。

### 为什么需要抽象层？
1. **统一接口** - 屏蔽 SQLite3 底层细节，提供简洁的 API
2. **连接管理** - 自动化连接池、超时重试、资源释放
3. **事务安全** - 支持嵌套事务、异常自动回滚
4. **错误处理** - 统一异常类型，便于上层业务处理
5. **性能优化** - 启用 WAL 模式、PRAGMA 优化、连接复用

### 核心价值
> 让上层业务（第二期插件系统、第三期数据表实现）专注于业务逻辑，无需关心数据库底层细节。

---

## 🎯 功能需求

### 1. 数据库连接管理器 (DatabaseConnectionManager)

#### 1.1 职责
- 管理数据库连接的创建、复用、关闭
- 自动启用性能优化（WAL、外键、JSONB）
- 提供连接池功能（最多5个连接）

#### 1.2 接口设计

```python
# src/backend/database/connection.py

import sqlite3
from typing import Optional, Any
from pathlib import Path

class DatabaseConnectionManager:
    """
    数据库连接管理器（单例模式）

    特性:
    - 自动启用 WAL 模式（Write-Ahead Logging）
    - 自动启用外键约束
    - 自动启用 JSONB 支持
    - 连接池管理（最多5个连接）
    - 超时重试机制
    """

    def __init__(self, db_path: str, **options):
        """
        初始化连接管理器

        Args:
            db_path: 数据库文件路径（绝对路径）
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
        self._db_path = Path(db_path)
        self._timeout = options.get('timeout', 10.0)
        self._check_same_thread = options.get('check_same_thread', False)
        self._isolation_level = options.get('isolation_level', 'DEFERRED')
        self._pool_size = options.get('pool_size', 5)
        self._connections = []  # 连接池
        self._initialized = False

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
        """
        pass

    def close_all(self) -> None:
        """
        关闭所有连接

        用于:
        - 应用程序退出时
        - 数据库迁移前
        - 测试清理
        """
        pass

    def execute_pragma(self, pragma: str) -> Any:
        """
        执行 PRAGMA 语句

        Args:
            pragma: PRAGMA 语句（如 'foreign_keys = ON'）

        Returns:
            PRAGMA 返回值

        Example:
            >>> manager.execute_pragma('journal_mode = WAL')
            >>> manager.execute_pragma('foreign_keys = ON')
        """
        pass

    def _initialize_connection(self, conn: sqlite3.Connection) -> None:
        """
        初始化新连接（私有方法）

        自动执行:
        - PRAGMA foreign_keys = ON（启用外键）
        - PRAGMA journal_mode = WAL（启用 WAL 模式）
        - PRAGMA synchronous = NORMAL（性能优化）
        - PRAGMA temp_store = MEMORY（内存临时表）
        """
        pass

    def _ensure_db_directory(self) -> None:
        """确保数据库目录存在（私有方法）"""
        pass
```

#### 1.3 配置文件

```python
# src/backend/database/config.py

from pathlib import Path

# 数据库配置
DATABASE_CONFIG = {
    'db_path': 'data/anki_linkmaster.db',
    'timeout': 10.0,
    'check_same_thread': False,
    'isolation_level': 'DEFERRED',
    'pool_size': 5,
}

# PRAGMA 优化配置
PRAGMA_SETTINGS = {
    'foreign_keys': 'ON',           # 启用外键约束
    'journal_mode': 'WAL',          # 启用 WAL 模式
    'synchronous': 'NORMAL',        # 同步模式（平衡性能和安全）
    'temp_store': 'MEMORY',         # 临时表存储在内存
    'cache_size': -64000,           # 缓存大小（64MB）
}

def get_db_path() -> Path:
    """获取数据库文件路径（绝对路径）"""
    return Path(__file__).parent.parent.parent / DATABASE_CONFIG['db_path']
```

---

### 2. 事务管理器 (TransactionManager)

#### 2.1 职责
- 提供事务的开启、提交、回滚能力
- 支持嵌套事务（Savepoint 实现）
- 上下文管理器（自动提交/回滚）

#### 2.2 接口设计

```python
# src/backend/database/transaction.py

import sqlite3
from typing import Optional

class TransactionManager:
    """
    事务管理器（支持上下文管理器）

    特性:
    - 支持嵌套事务（使用 Savepoint）
    - 异常时自动回滚
    - 正常退出时自动提交
    - 记录事务日志（调试模式）
    """

    def __init__(self, connection: sqlite3.Connection, logger: Optional[Any] = None):
        """
        初始化事务管理器

        Args:
            connection: SQLite 连接对象
            logger: 日志记录器（可选）
        """
        self._conn = connection
        self._logger = logger
        self._savepoint_counter = 0
        self._savepoint_stack = []

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
        pass

    def commit(self) -> None:
        """
        提交事务

        - 主事务：COMMIT
        - 嵌套事务：RELEASE SAVEPOINT

        Raises:
            DatabaseTransactionError: 提交失败
        """
        pass

    def rollback(self) -> None:
        """
        回滚事务

        - 主事务：ROLLBACK
        - 嵌套事务：ROLLBACK TO SAVEPOINT
        """
        pass

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
```

#### 2.3 嵌套事务示例

```python
# 嵌套事务示例
with TransactionManager(conn) as txn1:
    cursor.execute("INSERT INTO pdf_info ...")

    # 嵌套事务
    with TransactionManager(conn) as txn2:
        cursor.execute("INSERT INTO pdf_annotation ...")
        # 如果这里抛异常，只回滚 txn2，不影响 txn1

    cursor.execute("UPDATE pdf_info ...")
    # 如果这里抛异常，回滚整个 txn1（包括 txn2）
```

---

### 3. SQL 执行器 (SQLExecutor)

#### 3.1 职责
- 执行 SQL 语句（查询、更新、批量、脚本）
- 处理参数绑定（防止 SQL 注入）
- 结果映射（Row → Dict）
- 错误处理和日志记录

#### 3.2 接口设计

```python
# src/backend/database/executor.py

import sqlite3
from typing import List, Dict, Optional, Union, Any

class SQLExecutor:
    """
    SQL 执行器

    特性:
    - 自动参数绑定（防止 SQL 注入）
    - Row Factory（将结果转为字典）
    - 异常转换（SQLite 异常 → 自定义异常）
    - 查询日志（DEBUG 模式）
    """

    def __init__(self, connection: sqlite3.Connection, logger: Optional[Any] = None):
        """
        初始化 SQL 执行器

        Args:
            connection: SQLite 连接对象
            logger: 日志记录器（可选）
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
        pass

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
        pass

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
        pass

    def execute_script(self, script: str) -> None:
        """
        执行 SQL 脚本（建表、迁移等）

        Args:
            script: SQL 脚本（多条语句，用分号分隔）

        Example:
            >>> script = '''
            ... CREATE TABLE IF NOT EXISTS test (id INTEGER);
            ... CREATE INDEX IF NOT EXISTS idx_test ON test(id);
            ... '''
            >>> executor.execute_script(script)
        """
        pass

    def _setup_row_factory(self) -> None:
        """
        设置 Row Factory（私有方法）

        将查询结果转为字典格式:
        - (value1, value2, ...) → {'col1': value1, 'col2': value2, ...}
        """
        def dict_factory(cursor, row):
            return {
                col[0]: row[idx]
                for idx, col in enumerate(cursor.description)
            }

        self._conn.row_factory = dict_factory

    def _log_query(self, sql: str, params: Optional[Union[tuple, dict]]) -> None:
        """记录查询日志（私有方法）"""
        if self._logger:
            self._logger.debug(f"SQL: {sql}")
            if params:
                self._logger.debug(f"Params: {params}")
```

---

### 4. 异常定义 (exceptions.py)

#### 4.1 异常层次结构

```python
# src/backend/database/exceptions.py

class DatabaseError(Exception):
    """
    数据库异常基类

    所有数据库相关异常的父类
    """
    pass


class DatabaseConnectionError(DatabaseError):
    """
    连接失败异常

    触发场景:
    - 数据库文件不存在
    - 无权限访问
    - 连接超时
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
    """
    pass


class DatabaseTransactionError(DatabaseError):
    """
    事务失败异常

    触发场景:
    - 提交失败
    - 回滚失败
    - 嵌套事务错误
    """
    pass


class DatabaseConstraintError(DatabaseError):
    """
    约束违反异常

    触发场景:
    - 主键冲突（UNIQUE constraint）
    - 外键违反（FOREIGN KEY constraint）
    - 非空约束（NOT NULL constraint）
    - 检查约束（CHECK constraint）
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
    """
    pass
```

#### 4.2 异常转换示例

```python
# 异常转换示例
try:
    executor.execute_update(
        "INSERT INTO pdf_info (uuid, title) VALUES (?, ?)",
        ('abc123', 'Test')
    )
except sqlite3.IntegrityError as e:
    # 主键冲突
    if 'UNIQUE constraint failed' in str(e):
        raise DatabaseConstraintError(f"UUID 'abc123' 已存在") from e
    else:
        raise DatabaseConstraintError(str(e)) from e
except sqlite3.OperationalError as e:
    # 查询错误
    raise DatabaseQueryError(f"SQL 执行失败: {e}") from e
except Exception as e:
    # 其他异常
    raise DatabaseError(f"未知错误: {e}") from e
```

---

## 📁 文件结构

```
src/backend/database/
├── __init__.py                     # 导出公共接口
├── config.py                       # 配置文件
├── connection.py                   # DatabaseConnectionManager
├── transaction.py                  # TransactionManager
├── executor.py                     # SQLExecutor
├── exceptions.py                   # 异常定义
└── __tests__/                      # 单元测试
    ├── __init__.py
    ├── conftest.py                 # pytest 配置和 fixtures
    ├── test_connection.py          # 连接管理器测试
    ├── test_transaction.py         # 事务管理器测试
    ├── test_executor.py            # SQL 执行器测试
    └── test_exceptions.py          # 异常测试
```

---

## ✅ 单元测试要求

### 测试覆盖率
- **目标**: ≥ 90%
- **工具**: `pytest` + `pytest-cov`

### 测试用例清单

#### 1. 连接管理器测试 (test_connection.py)

```python
import pytest
from src.backend.database.connection import DatabaseConnectionManager
from src.backend.database.exceptions import DatabaseConnectionError

class TestDatabaseConnectionManager:
    """连接管理器测试"""

    def test_create_connection(self, tmp_path):
        """测试：创建连接成功"""
        db_path = tmp_path / "test.db"
        manager = DatabaseConnectionManager(str(db_path))
        conn = manager.get_connection()

        assert conn is not None
        assert conn.execute("SELECT 1").fetchone() == (1,)

    def test_connection_pool_reuse(self, tmp_path):
        """测试：连接池复用"""
        db_path = tmp_path / "test.db"
        manager = DatabaseConnectionManager(str(db_path), pool_size=2)

        conn1 = manager.get_connection()
        conn2 = manager.get_connection()

        # 应该返回相同的连接对象
        assert conn1 is conn2

    def test_connection_pool_limit(self, tmp_path):
        """测试：连接池上限控制"""
        # TODO: 实现连接池上限测试

    def test_pragma_foreign_keys_enabled(self, tmp_path):
        """测试：外键自动启用"""
        db_path = tmp_path / "test.db"
        manager = DatabaseConnectionManager(str(db_path))

        result = manager.execute_pragma('foreign_keys')
        assert result == 1  # 1 = ON

    def test_pragma_wal_mode_enabled(self, tmp_path):
        """测试：WAL 模式自动启用"""
        db_path = tmp_path / "test.db"
        manager = DatabaseConnectionManager(str(db_path))

        result = manager.execute_pragma('journal_mode')
        assert result == 'wal'

    def test_connection_timeout(self, tmp_path):
        """测试：超时重试"""
        # TODO: 实现超时测试

    def test_close_all_connections(self, tmp_path):
        """测试：关闭所有连接"""
        db_path = tmp_path / "test.db"
        manager = DatabaseConnectionManager(str(db_path))

        conn = manager.get_connection()
        manager.close_all()

        # 连接应该已关闭
        with pytest.raises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")
```

#### 2. 事务管理器测试 (test_transaction.py)

```python
class TestTransactionManager:
    """事务管理器测试"""

    def test_commit_transaction(self, db_connection):
        """测试：正常提交事务"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        txn.begin()
        cursor.execute("CREATE TABLE test (id INTEGER)")
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.commit()

        # 验证数据已提交
        result = cursor.execute("SELECT * FROM test").fetchall()
        assert len(result) == 1

    def test_rollback_transaction(self, db_connection):
        """测试：异常回滚事务"""
        txn = TransactionManager(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER)")

        txn.begin()
        cursor.execute("INSERT INTO test VALUES (1)")
        txn.rollback()

        # 验证数据已回滚
        result = cursor.execute("SELECT * FROM test").fetchall()
        assert len(result) == 0

    def test_context_manager_auto_commit(self, db_connection):
        """测试：上下文管理器自动提交"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")

        with TransactionManager(db_connection):
            cursor.execute("INSERT INTO test VALUES (1)")
            # 退出时自动 commit

        result = cursor.execute("SELECT * FROM test").fetchall()
        assert len(result) == 1

    def test_context_manager_auto_rollback(self, db_connection):
        """测试：上下文管理器异常时自动回滚"""
        cursor = db_connection.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER)")

        try:
            with TransactionManager(db_connection):
                cursor.execute("INSERT INTO test VALUES (1)")
                raise ValueError("Test error")
        except ValueError:
            pass

        # 验证数据已回滚
        result = cursor.execute("SELECT * FROM test").fetchall()
        assert len(result) == 0

    def test_nested_transaction(self, db_connection):
        """测试：嵌套事务（Savepoint）"""
        # TODO: 实现嵌套事务测试
```

#### 3. SQL 执行器测试 (test_executor.py)

```python
class TestSQLExecutor:
    """SQL 执行器测试"""

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

    def test_execute_query_with_params(self, db_connection):
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

    def test_execute_update_returns_rowcount(self, db_connection):
        """测试：更新返回影响行数"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        db_connection.commit()

        rows = executor.execute_update(
            "INSERT INTO test VALUES (?, ?)",
            (1, 'Alice')
        )

        assert rows == 1

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

    def test_sql_injection_prevention(self, db_connection):
        """测试：SQL 注入防御"""
        executor = SQLExecutor(db_connection)
        cursor = db_connection.cursor()

        cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
        cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
        db_connection.commit()

        # 尝试 SQL 注入
        malicious_input = "1 OR 1=1"
        result = executor.execute_query(
            "SELECT * FROM test WHERE id = ?",
            (malicious_input,)
        )

        # 不应该返回所有行
        assert len(result) == 0

    def test_exception_conversion(self, db_connection):
        """测试：异常转换"""
        executor = SQLExecutor(db_connection)

        # 查询不存在的表应该抛出 DatabaseQueryError
        with pytest.raises(DatabaseQueryError):
            executor.execute_query("SELECT * FROM nonexistent_table")
```

---

## 📦 交付标准

### 代码完成
- [x] `config.py` - 配置文件
- [x] `connection.py` - DatabaseConnectionManager 实现
- [x] `transaction.py` - TransactionManager 实现
- [x] `executor.py` - SQLExecutor 实现
- [x] `exceptions.py` - 异常类定义

### 测试通过
- [x] 所有单元测试通过（pytest）
- [x] 测试覆盖率 ≥ 90%（pytest-cov）
- [x] 所有异常场景测试通过

### 代码质量
- [x] 所有类和方法有 docstring
- [x] 所有参数有类型注解（Python 3.9+ typing）
- [x] 通过 pylint 检查（评分 ≥ 8.0）
- [x] 通过 mypy 类型检查

### 文档完善
- [x] README.md（使用说明）
- [x] API 文档（自动生成）
- [x] 代码示例（每个类至少1个示例）

---

## 🚀 开发指南

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements-dev.txt
```

**requirements-dev.txt**:
```
pytest>=7.0.0
pytest-cov>=4.0.0
pylint>=2.15.0
mypy>=1.0.0
```

### 2. 开发流程

1. **创建开发分支**
   ```bash
   git checkout -b feature/phase1-abstraction-layer
   ```

2. **实现功能**
   - 先写接口（抽象方法、类型注解）
   - 再写实现（遵循 docstring 说明）
   - 最后写测试（覆盖所有分支）

3. **运行测试**
   ```bash
   # 运行所有测试
   pytest src/backend/database/__tests__/

   # 生成覆盖率报告
   pytest --cov=src/backend/database --cov-report=html

   # 查看报告
   open htmlcov/index.html
   ```

4. **代码检查**
   ```bash
   # pylint 检查
   pylint src/backend/database/

   # mypy 类型检查
   mypy src/backend/database/
   ```

5. **提交代码**
   ```bash
   git add .
   git commit -m "feat(database): 实现数据库抽象层"
   git push origin feature/phase1-abstraction-layer
   ```

### 3. 调试技巧

**启用 SQLite 日志**:
```python
import sqlite3
sqlite3.enable_callback_tracebacks(True)

# 设置日志级别
logging.basicConfig(level=logging.DEBUG)
```

**查看查询计划**:
```sql
EXPLAIN QUERY PLAN SELECT * FROM pdf_info WHERE uuid = 'abc123';
```

---

## 📚 参考资料

- **SQLite 官方文档**: https://www.sqlite.org/docs.html
- **SQLite PRAGMA**: https://www.sqlite.org/pragma.html
- **Python sqlite3**: https://docs.python.org/3/library/sqlite3.html
- **pytest 文档**: https://docs.pytest.org/

---

## 🔗 下一期预告

**第二期：插件隔离架构**
- TablePlugin 基类（所有数据表插件的父类）
- EventBus 事件总线（三段式事件命名）
- TablePluginRegistry 插件注册中心

依赖第一期交付物：
- DatabaseConnectionManager
- SQLExecutor
- 自定义异常类

---

**文档结束**

✅ 第一期完成后，将为第二期提供稳定、高效的数据库访问基础。
