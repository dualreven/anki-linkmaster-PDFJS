"""
连接管理器测试

测试 DatabaseConnectionManager 的所有功能。

创建日期: 2025-10-05
版本: v1.0
"""

import pytest
import sqlite3
from pathlib import Path

from ..connection import DatabaseConnectionManager
from ..exceptions import DatabaseConnectionError


class TestDatabaseConnectionManager:
    """连接管理器测试类"""

    def test_create_connection(self, isolated_connection_manager):
        """测试：创建连接成功"""
        conn = isolated_connection_manager.get_connection()

        assert conn is not None
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        assert result == (1,)

    def test_connection_pool_reuse(self, tmp_db_path):
        """测试：连接池复用"""
        # 重置单例
        DatabaseConnectionManager._instance = None

        manager = DatabaseConnectionManager(str(tmp_db_path), pool_size=2)

        conn1 = manager.get_connection()
        conn2 = manager.get_connection()

        # 应该返回相同的连接对象（简化版连接池）
        assert conn1 is conn2

        # 清理
        manager.close_all()
        DatabaseConnectionManager._instance = None

    def test_pragma_foreign_keys_enabled(self, isolated_connection_manager):
        """测试：外键自动启用"""
        result = isolated_connection_manager.execute_pragma('foreign_keys')
        assert result == 1  # 1 = ON

    def test_pragma_wal_mode_enabled(self, isolated_connection_manager):
        """测试：WAL 模式自动启用"""
        result = isolated_connection_manager.execute_pragma('journal_mode')
        assert result.lower() == 'wal'

    def test_pragma_query_mode(self, isolated_connection_manager):
        """测试：PRAGMA 查询模式（不带 =）"""
        result = isolated_connection_manager.execute_pragma('foreign_keys')
        assert result in (0, 1)

    def test_pragma_set_mode(self, isolated_connection_manager):
        """测试：PRAGMA 设置模式（带 =）"""
        # 设置 PRAGMA（无返回值）
        result = isolated_connection_manager.execute_pragma('foreign_keys = OFF')
        assert result is None

        # 验证设置生效（需要重新获取连接）
        conn = isolated_connection_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys")
        value = cursor.fetchone()[0]
        assert value == 0

    def test_close_all_connections(self, tmp_db_path):
        """测试：关闭所有连接"""
        # 重置单例
        DatabaseConnectionManager._instance = None

        manager = DatabaseConnectionManager(str(tmp_db_path))
        conn = manager.get_connection()

        # 关闭所有连接
        manager.close_all()

        # 连接应该已关闭
        with pytest.raises(sqlite3.ProgrammingError):
            conn.execute("SELECT 1")

        # 清理
        DatabaseConnectionManager._instance = None

    def test_db_directory_creation(self, tmp_path):
        """测试：自动创建数据库目录"""
        # 重置单例
        DatabaseConnectionManager._instance = None

        db_path = tmp_path / "subdir1" / "subdir2" / "test.db"

        manager = DatabaseConnectionManager(str(db_path))
        conn = manager.get_connection()

        # 目录应该被创建
        assert db_path.parent.exists()

        # 连接应该正常
        assert conn is not None

        # 清理
        manager.close_all()
        DatabaseConnectionManager._instance = None

    def test_singleton_pattern(self, tmp_db_path):
        """测试：单例模式"""
        # 重置单例
        DatabaseConnectionManager._instance = None

        manager1 = DatabaseConnectionManager(str(tmp_db_path))
        manager2 = DatabaseConnectionManager(str(tmp_db_path))

        # 应该是同一个实例
        assert manager1 is manager2

        # 清理
        manager1.close_all()
        DatabaseConnectionManager._instance = None

    def test_connection_options(self, tmp_db_path):
        """测试：连接选项配置"""
        # 重置单例
        DatabaseConnectionManager._instance = None

        manager = DatabaseConnectionManager(
            str(tmp_db_path),
            timeout=20.0,
            pool_size=10
        )

        assert manager._timeout == 20.0
        assert manager._pool_size == 10

        # 清理
        manager.close_all()
        DatabaseConnectionManager._instance = None

    def test_execute_pragma_error(self, isolated_connection_manager):
        """测试：PRAGMA 执行错误"""
        # 执行无效的 PRAGMA（但 SQLite 可能不会报错）
        # 这里测试 PRAGMA 执行不会崩溃
        try:
            result = isolated_connection_manager.execute_pragma('invalid_pragma')
            # SQLite 对无效 PRAGMA 通常返回 None
            assert result is None or isinstance(result, (int, str))
        except DatabaseConnectionError:
            # 预期异常
            pass
