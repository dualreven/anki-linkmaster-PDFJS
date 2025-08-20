"""
简化的WebSocket服务器测试套件
"""

import pytest
from unittest.mock import MagicMock
from PyQt6.QtCore import QCoreApplication

from websocket.server import WebSocketServer


class TestWebSocketServerSimple:
    """简化的WebSocket服务器测试类"""
    
    @pytest.fixture
    def app(self):
        """Qt应用fixture"""
        return QCoreApplication.instance() or QCoreApplication([])
        
    @pytest.fixture
    def server(self, app):
        """WebSocket服务器fixture"""
        server = WebSocketServer(port=8768)  # 使用不同端口避免冲突
        yield server
        server.stop_server()
        
    def test_server_initialization(self, server):
        """测试服务器初始化"""
        assert server.server is not None
        assert server.port == 8768
        assert len(server.clients) == 0
        
    def test_start_stop_server(self, server):
        """测试启动和停止服务器"""
        # 测试启动
        result = server.start_server()
        assert result is True
        assert server.server.isListening()
        
        # 测试停止
        result = server.stop_server()
        assert server.server is None or not server.server.isListening()
        
    def test_port_configuration(self, app):
        """测试端口配置"""
        custom_port = 9999
        server = WebSocketServer(port=custom_port)
        
        try:
            assert server.port == custom_port
        finally:
            server.stop_server()
            
    def test_error_handling_basic(self, server):
        """测试基本错误处理"""
        # 测试停止未启动的服务器
        result = server.stop_server()
        # 应该优雅处理，不抛出异常
        assert True  # 只要没有异常就算通过


if __name__ == "__main__":
    pytest.main([__file__, "-v"])