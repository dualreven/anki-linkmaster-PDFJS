"""
pytest 配置和 fixtures

提供测试所需的通用 fixtures。

创建日期: 2025-10-05
版本: v1.0
"""

import sqlite3
import pytest
from pathlib import Path
import tempfile
import os


@pytest.fixture
def tmp_db_path(tmp_path):
    """
    提供临时数据库文件路径

    Args:
        tmp_path: pytest 提供的临时目录

    Returns:
        Path: 临时数据库文件路径

    Example:
        >>> def test_example(tmp_db_path):
        ...     manager = DatabaseConnectionManager(str(tmp_db_path))
        ...     conn = manager.get_connection()
    """
    return tmp_path / "test.db"


@pytest.fixture
def db_connection(tmp_db_path):
    """
    提供数据库连接对象

    自动创建和清理数据库连接。

    Returns:
        sqlite3.Connection: 数据库连接对象

    Example:
        >>> def test_example(db_connection):
        ...     cursor = db_connection.cursor()
        ...     cursor.execute("CREATE TABLE test (id INTEGER)")
    """
    conn = sqlite3.connect(str(tmp_db_path))
    yield conn
    conn.close()


@pytest.fixture
def db_with_table(db_connection):
    """
    提供包含测试表的数据库连接

    自动创建测试表 test(id INTEGER, name TEXT)。

    Returns:
        sqlite3.Connection: 数据库连接对象

    Example:
        >>> def test_example(db_with_table):
        ...     cursor = db_with_table.cursor()
        ...     cursor.execute("INSERT INTO test VALUES (1, 'Alice')")
    """
    cursor = db_connection.cursor()
    cursor.execute("CREATE TABLE test (id INTEGER, name TEXT)")
    db_connection.commit()
    yield db_connection


@pytest.fixture
def isolated_connection_manager(tmp_db_path):
    """
    提供隔离的连接管理器实例

    每个测试使用独立的数据库文件，避免单例模式的影响。

    Returns:
        DatabaseConnectionManager: 连接管理器实例

    Example:
        >>> def test_example(isolated_connection_manager):
        ...     conn = isolated_connection_manager.get_connection()
    """
    from ..connection import DatabaseConnectionManager

    # 重置单例
    DatabaseConnectionManager._instance = None

    manager = DatabaseConnectionManager(str(tmp_db_path))
    yield manager

    # 清理
    manager.close_all()
    DatabaseConnectionManager._instance = None
