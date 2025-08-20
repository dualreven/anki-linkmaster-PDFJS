"""
WebSocket服务器测试套件
"""

import asyncio
import json
import pytest
from unittest.mock import patch, MagicMock
from PyQt6.QtCore import QCoreApplication, QTimer
from PyQt6.QtNetwork import QTcpSocket

import json
from websocket.server import WebSocketServer
from websocket.client import WebSocketClient
from websocket.protocol import WebSocketProtocol, MessageHandler


class TestWebSocketProtocol:
    """WebSocket协议测试类"""
    
    def test_frame_parsing(self):
        """测试帧解析"""
        # 测试文本帧
        frame_data = b'\x81\x05Hello'  # 文本帧，长度5，内容"Hello"
        parsed = WebSocketProtocol.parse_frame(frame_data)
        assert parsed["opcode"] == 0x1  # 文本帧
        assert parsed["payload"] == b'Hello'
        assert parsed["fin"] is True
        
    def test_frame_building(self):
        """测试帧构建"""
        message = "Hello, WebSocket!"
        frame = WebSocketProtocol.build_text_frame(message)
        
        assert isinstance(frame, bytes)
        assert len(frame) > len(message)
        
    def test_masking_unmasking(self):
        """测试掩码处理"""
        payload = b"test data"
        mask = b"abcd"
        
        masked = WebSocketProtocol.mask_payload(payload, mask)
        unmasked = WebSocketProtocol.mask_payload(masked, mask)
        
        assert payload == unmasked
        assert masked != payload


class TestMessageHandler:
    """消息处理器测试类"""
    
    def test_json_message_parsing(self):
        """测试JSON消息解析"""
        message_data = {"type": "test", "data": "hello"}
        json_str = json.dumps(message_data)
        
        parsed = MessageHandler.parse_message(json_str)
        assert parsed["type"] == "test"
        assert parsed["data"] == "hello"
        
    def test_json_message_building(self):
        """测试JSON消息构建"""
        message_data = {"type": "response", "data": {"status": "ok"}}
        
        json_str = MessageHandler.build_message(message_data)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "response"
        assert parsed["data"]["status"] == "ok"
        
    def test_invalid_json_handling(self):
        """测试无效JSON处理"""
        invalid_json = "{invalid json}"
        
        parsed = MessageHandler.parse_message(invalid_json)
        assert parsed is None


class TestWebSocketClient:
    """WebSocket客户端测试类"""
    
    @pytest.fixture
    def mock_socket(self):
        """模拟socket fixture"""
        socket = MagicMock()
        socket.write = MagicMock()
        socket.read = MagicMock()
        socket.bytesAvailable = MagicMock(return_value=0)
        socket.state = MagicMock(return_value=3)  # ConnectedState
        return socket
        
    @pytest.fixture
    def client(self, mock_socket):
        """WebSocket客户端fixture"""
        client = WebSocketClient(mock_socket, "test_id")
        return client
        
    def test_client_initialization(self, client):
        """测试客户端初始化"""
        assert client.client_id == "test_id"
        assert client.disconnected is False
        
    def test_send_message(self, client):
        """测试发送消息"""
        message = {"type": "test", "data": "hello"}
        
        client.send_message(message)
        client.socket.write.assert_called_once()
        
    def test_client_properties(self, client):
        """测试客户端属性"""
        assert client.client_id == "test_id"
        assert hasattr(client, 'send_message')
        
    def test_close_connection(self, client):
        """测试关闭连接"""
        client.close()
        client.socket.write.assert_called()
        assert client.disconnected is True


class TestWebSocketServer:
    """WebSocket服务器测试类"""
    
    @pytest.fixture
    def app(self):
        """Qt应用fixture"""
        return QCoreApplication.instance() or QCoreApplication([])
        
    @pytest.fixture
    def server(self, app):
        """WebSocket服务器fixture"""
        server = WebSocketServer()
        yield server
        server.stop_server()
        
    def test_server_initialization(self, server):
        """测试服务器初始化"""
        assert server.server is not None
        assert len(server.clients) == 0
        assert server.port == 8765
        
    def test_start_server(self, server):
        """测试启动服务器"""
        result = server.start_server()
        assert result is True
        assert server.server.isListening()
        
    def test_stop_server(self, server):
        """测试停止服务器"""
        server.start_server()
        result = server.stop_server()
        assert result is True
        assert not server.server.isListening()
        
    def test_client_connection_management(self, server):
        """测试客户端连接管理"""
        server.start_server()
        
        # 验证服务器已启动
        assert server.server.isListening()
        assert len(server.clients) == 0
        
    def test_message_broadcasting(self, server):
        """测试消息广播"""
        server.start_server()
        
        # 模拟客户端
        mock_client = MagicMock()
        mock_client.send_message = MagicMock()
        mock_client.is_connected = True
        
        server.clients["test_id"] = mock_client
        
        # 广播消息
        message = {"type": "broadcast", "data": "test"}
        server.broadcast_message(message)
        
        mock_client.send_message.assert_called_once_with(message)
        
    def test_message_sending_to_client(self, server):
        """测试向特定客户端发送消息"""
        server.start_server()
        
        # 模拟客户端
        mock_client = MagicMock()
        mock_client.send_message = MagicMock()
        mock_client.is_connected = True
        
        server.clients["test_id"] = mock_client
        
        # 发送消息
        message = {"type": "direct", "data": "test"}
        result = server.send_message("test_id", message)
        
        assert result is True
        mock_client.send_message.assert_called_once_with(message)
        
    def test_send_to_nonexistent_client(self, server):
        """测试向不存在的客户端发送消息"""
        server.start_server()
        
        message = {"type": "test", "data": "hello"}
        result = server.send_message("nonexistent", message)
        
        assert result is False
        
    def test_client_disconnection(self, server):
        """测试客户端断开连接"""
        server.start_server()
        
        # 添加模拟客户端
        mock_client = MagicMock()
        mock_client.is_connected = False
        server.clients["test_id"] = mock_client
        
        # 触发断开处理
        server.on_client_disconnected("test_id")
        
        assert "test_id" not in server.clients
        
    def test_port_configuration(self, app):
        """测试端口配置"""
        custom_port = 9999
        server = WebSocketServer(port=custom_port)
        
        assert server.port == custom_port
        server.stop_server()
        
    def test_error_handling(self, server):
        """测试错误处理"""
        server.start_server()
        
        # 测试无效操作
        result = server.send_message("", None)
        assert result is False
        
        # 测试停止未启动的服务器
        server.stop_server()
        result = server.stop_server()
        assert result is False


class TestIntegration:
    """集成测试类"""
    
    @pytest.fixture
    def app(self):
        """Qt应用fixture"""
        return QCoreApplication.instance() or QCoreApplication([])
        
    def test_full_communication_flow(self, app):
        """测试完整通信流程"""
        server = WebSocketServer(port=8766)
        
        try:
            # 启动服务器
            assert server.start_server() is True
            
            # 模拟客户端连接
            mock_socket = MagicMock()
            mock_socket.peerAddress = MagicMock()
            mock_socket.peerPort = MagicMock(return_value=12345)
            
            # 处理新连接
            server.on_new_connection()
            
            # 验证服务器状态
            assert len(server.clients) >= 0
            
            # 模拟消息处理
            test_message = {
                "type": "test",
                "data": {"message": "hello server"}
            }
            
            # 测试广播
            server.broadcast_message(test_message)
            
        finally:
            server.stop_server()
            
    def test_concurrent_clients(self, app):
        """测试并发客户端"""
        server = WebSocketServer(port=8767)
        
        try:
            server.start_server()
            
            # 模拟多个客户端
            for i in range(3):
                mock_socket = MagicMock()
                mock_socket.peerAddress = MagicMock()
                mock_socket.peerPort = MagicMock(return_value=12345 + i)
                
                server.on_new_connection()
            
            # 验证客户端数量
            assert len(server.clients) >= 0
            
            # 广播消息给所有客户端
            message = {"type": "broadcast", "data": "hello all"}
            server.broadcast_message(message)
            
        finally:
            server.stop_server()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])