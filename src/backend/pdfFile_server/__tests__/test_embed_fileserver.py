"""
EmbedFileServer 单元测试

测试嵌入式 HTTP 文件服务器的各项功能
"""

import pytest
import tempfile
import urllib.request
import urllib.error
from pathlib import Path
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QTimer

from src.backend.pdfFile_server.embed_fileserver import EmbedFileServer, setup_embed_fileserver


@pytest.fixture
def temp_dir():
    """创建临时目录用于测试"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def test_files(temp_dir):
    """创建测试文件"""
    # 创建测试 PDF 文件
    pdf_file = temp_dir / "test.pdf"
    pdf_file.write_bytes(b"%PDF-1.4\nTest PDF content")

    # 创建测试文本文件
    txt_file = temp_dir / "test.txt"
    txt_file.write_text("Hello, World!", encoding='utf-8')

    # 创建测试 JSON 文件
    json_file = temp_dir / "test.json"
    json_file.write_text('{"status": "ok"}', encoding='utf-8')

    # 创建子目录和文件
    subdir = temp_dir / "subdir"
    subdir.mkdir()
    sub_file = subdir / "nested.txt"
    sub_file.write_text("Nested file", encoding='utf-8')

    return {
        "pdf": pdf_file,
        "txt": txt_file,
        "json": json_file,
        "nested": sub_file
    }


@pytest.fixture(scope="function")
def app():
    """创建 QApplication 实例"""
    from PyQt6.QtWidgets import QApplication
    import sys
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    yield app
    # 清理（但不退出，因为可能有其他测试需要）


class TestEmbedFileServer:
    """EmbedFileServer 测试套件"""

    def test_server_initialization(self, temp_dir):
        """测试服务器初始化"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8888)

        assert server.root_dir == temp_dir.resolve()
        assert server.host == "127.0.0.1"
        assert server.port == 8888
        assert not server.is_running()

    def test_server_start_stop(self, app, temp_dir):
        """测试服务器启动和停止"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8889)

        # 启动服务器
        assert server.start() == True
        assert server.is_running() == True

        # 停止服务器
        server.stop()
        assert server.is_running() == False

    def test_server_already_running(self, app, temp_dir):
        """测试重复启动服务器"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8890)

        # 第一次启动
        assert server.start() == True

        # 第二次启动（应该返回 True 但不会重复启动）
        assert server.start() == True
        assert server.is_running() == True

        server.stop()

    def test_file_service_pdf(self, app, temp_dir, test_files):
        """测试 PDF 文件服务"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8891)
        assert server.start() == True

        try:
            # 请求 PDF 文件
            response = urllib.request.urlopen("http://127.0.0.1:8891/test.pdf")

            assert response.status == 200
            content = response.read()
            assert content == test_files["pdf"].read_bytes()

            # 检查 Content-Type
            content_type = response.headers.get('Content-Type')
            assert 'application/pdf' in content_type

        finally:
            server.stop()

    def test_file_service_text(self, app, temp_dir, test_files):
        """测试文本文件服务"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8892)
        assert server.start() == True

        try:
            # 请求文本文件
            response = urllib.request.urlopen("http://127.0.0.1:8892/test.txt")

            assert response.status == 200
            content = response.read()
            assert content.decode('utf-8') == "Hello, World!"

        finally:
            server.stop()

    def test_file_service_json(self, app, temp_dir, test_files):
        """测试 JSON 文件服务"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8893)
        assert server.start() == True

        try:
            # 请求 JSON 文件
            response = urllib.request.urlopen("http://127.0.0.1:8893/test.json")

            assert response.status == 200
            content = response.read()
            assert content.decode('utf-8') == '{"status": "ok"}'

        finally:
            server.stop()

    def test_nested_file_service(self, app, temp_dir, test_files):
        """测试嵌套目录文件服务"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8894)
        assert server.start() == True

        try:
            # 请求嵌套文件
            response = urllib.request.urlopen("http://127.0.0.1:8894/subdir/nested.txt")

            assert response.status == 200
            content = response.read()
            assert content.decode('utf-8') == "Nested file"

        finally:
            server.stop()

    def test_file_not_found(self, app, temp_dir):
        """测试文件不存在的情况"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8895)
        assert server.start() == True

        try:
            # 请求不存在的文件
            with pytest.raises(urllib.error.HTTPError) as exc_info:
                urllib.request.urlopen("http://127.0.0.1:8895/nonexistent.pdf")

            assert exc_info.value.code == 404

        finally:
            server.stop()

    def test_path_traversal_attack(self, app, temp_dir):
        """测试路径穿越攻击防护"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8896)
        assert server.start() == True

        try:
            # 尝试路径穿越
            with pytest.raises(urllib.error.HTTPError) as exc_info:
                urllib.request.urlopen("http://127.0.0.1:8896/../../../etc/passwd")

            assert exc_info.value.code == 404

        finally:
            server.stop()

    def test_cors_headers(self, app, temp_dir, test_files):
        """测试 CORS 响应头"""
        server = EmbedFileServer(root_dir=str(temp_dir), port=8897)
        assert server.start() == True

        try:
            response = urllib.request.urlopen("http://127.0.0.1:8897/test.txt")

            # 检查 CORS 头
            cors_header = response.headers.get('Access-Control-Allow-Origin')
            assert cors_header == '*'

        finally:
            server.stop()

    def test_request_signal(self, app, temp_dir, test_files):
        """测试请求信号"""
        import time
        from PyQt6.QtCore import QCoreApplication

        server = EmbedFileServer(root_dir=str(temp_dir), port=8898)
        assert server.start() == True

        # 监听信号
        received_requests = []
        server.request_received.connect(
            lambda method, path: received_requests.append((method, path))
        )

        try:
            # 发送请求
            urllib.request.urlopen("http://127.0.0.1:8898/test.txt")

            # 处理事件循环
            QCoreApplication.processEvents()
            time.sleep(0.1)
            QCoreApplication.processEvents()

            # 验证信号
            assert len(received_requests) == 1
            assert received_requests[0] == ("GET", "/test.txt")

        finally:
            server.stop()

    def test_setup_embed_fileserver(self, app, temp_dir, test_files):
        """测试辅助函数"""
        server = setup_embed_fileserver(app, root_dir=str(temp_dir), port=8899)

        assert server is not None
        assert server.is_running() == True

        try:
            # 验证文件服务正常
            response = urllib.request.urlopen("http://127.0.0.1:8899/test.pdf")
            assert response.status == 200

        finally:
            server.stop()

    def test_server_signals(self, app, temp_dir):
        """测试服务器信号"""
        from PyQt6.QtCore import QCoreApplication

        server = EmbedFileServer(root_dir=str(temp_dir), port=8900)

        # 监听信号
        started_signal = []
        stopped_signal = []
        server.server_started.connect(lambda: started_signal.append(True))
        server.server_stopped.connect(lambda: stopped_signal.append(True))

        # 启动
        server.start()
        QCoreApplication.processEvents()
        assert len(started_signal) == 1

        # 停止
        server.stop()
        QCoreApplication.processEvents()
        assert len(stopped_signal) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
