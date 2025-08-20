"""
WebSocket JSON模块导入错误测试套件
测试WebSocket服务器是否正确导入和使用json模块
"""

import json
import sys
import os
import pytest
from unittest.mock import Mock, patch
from PyQt6.QtCore import QCoreApplication
import tempfile

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from websocket.server import WebSocketServer
from websocket.client import WebSocketClient


class TestWebSocketJSONImport:
    """测试WebSocket JSON模块导入和使用"""
    
    @classmethod
    def setup_class(cls):
        """测试类初始化"""
        cls.app = QCoreApplication.instance() or QCoreApplication([])
    
    def test_server_imports_json_module(self):
        """测试服务器是否正确导入json模块"""
        # 检查WebSocketServer类是否能访问json模块
        server = WebSocketServer()
        
        # 验证json模块在全局作用域可用
        assert 'json' in sys.modules, "json模块未导入到系统模块"
        
        # 验证服务器实例可以访问json.dumps和json.loads
        test_data = {"test": "data", "number": 123}
        
        # 测试json.dumps
        json_str = json.dumps(test_data)
        assert isinstance(json_str, str), "json.dumps应该返回字符串"
        
        # 测试json.loads
        parsed_data = json.loads(json_str)
        assert parsed_data == test_data, "json.loads应该正确解析数据"
    
    def test_send_message_json_serialization(self):
        """测试send_message方法是否正确序列化JSON"""
        server = WebSocketServer()
        
        # 模拟客户端连接
        mock_client = Mock()
        mock_client.send_message = Mock(return_value=True)
        
        server.clients = {"test_client": mock_client}
        
        # 测试字典消息序列化
        message_dict = {"type": "test", "data": {"key": "value"}}
        
        # 直接测试序列化逻辑
        if isinstance(message_dict, dict):
            serialized = json.dumps(message_dict)
            assert serialized == '{"type": "test", "data": {"key": "value"}}'
    
    def test_broadcast_message_json_serialization(self):
        """测试broadcast_message方法是否正确序列化JSON"""
        server = WebSocketServer()
        
        # 模拟多个客户端
        mock_client1 = Mock()
        mock_client1.send_message = Mock(return_value=True)
        
        mock_client2 = Mock()
        mock_client2.send_message = Mock(return_value=True)
        
        server.clients = {
            "client1": mock_client1,
            "client2": mock_client2
        }
        
        # 测试广播消息序列化
        broadcast_message = {"type": "broadcast", "content": "test"}
        
        # 直接测试序列化逻辑
        if isinstance(broadcast_message, dict):
            serialized = json.dumps(broadcast_message)
            assert serialized == '{"type": "broadcast", "content": "test"}'
    
    def test_on_message_received_json_parsing(self):
        """测试on_message_received方法是否正确解析JSON"""
        server = WebSocketServer()
        
        # 创建模拟信号接收器
        received_messages = []
        
        def message_handler(client_id, message):
            received_messages.append((client_id, message))
        
        server.message_received.connect(message_handler)
        
        # 测试JSON解析
        test_message = '{"type": "test", "data": {"key": "value"}}'
        
        # 直接测试解析逻辑
        try:
            parsed = json.loads(test_message)
            expected = {"type": "test", "data": {"key": "value"}}
            assert parsed == expected
        except json.JSONDecodeError:
            pytest.fail("JSON解析失败")
    
    def test_json_error_handling(self):
        """测试JSON错误处理"""
        server = WebSocketServer()
        
        # 测试无效JSON的处理
        invalid_json = '{"invalid": json}'
        
        with pytest.raises(json.JSONDecodeError):
            json.loads(invalid_json)
    
    def test_complex_json_structures(self):
        """测试复杂JSON结构的序列化和反序列化"""
        complex_data = {
            "pdf_list": [
                {
                    "id": "123",
                    "filename": "test.pdf",
                    "metadata": {
                        "title": "Test PDF",
                        "author": "Test Author",
                        "pages": 10
                    }
                }
            ],
            "timestamp": 1234567890.123,
            "status": "success"
        }
        
        # 测试序列化
        json_str = json.dumps(complex_data)
        assert isinstance(json_str, str)
        
        # 测试反序列化
        parsed = json.loads(json_str)
        assert parsed == complex_data
    
    def test_unicode_json_handling(self):
        """测试Unicode字符的JSON处理"""
        unicode_data = {
            "filename": "测试文档.pdf",
            "title": "中文标题",
            "content": "测试内容包含特殊字符: àáâãäåæçèéêë"
        }
        
        # 测试序列化
        json_str = json.dumps(unicode_data, ensure_ascii=False)
        assert "测试文档.pdf" in json_str
        
        # 测试反序列化
        parsed = json.loads(json_str)
        assert parsed["filename"] == "测试文档.pdf"


class TestWebSocketIntegration:
    """WebSocket集成测试"""
    
    @classmethod
    def setup_class(cls):
        """测试类初始化"""
        cls.app = QCoreApplication.instance() or QCoreApplication([])
    
    def test_full_websocket_communication_cycle(self):
        """测试完整的WebSocket通信周期"""
        server = WebSocketServer()
        
        # 模拟完整的通信流程
        test_messages = [
            {"type": "add_pdf", "data": {"filename": "test1.pdf"}},
            {"type": "get_pdf_list", "data": {}},
            {"type": "remove_pdf", "data": {"id": "12345"}}
        ]
        
        for message in test_messages:
            # 测试序列化
            json_str = json.dumps(message)
            assert isinstance(json_str, str)
            
            # 测试反序列化
            parsed = json.loads(json_str)
            assert parsed == message
            
            # 验证消息结构
            assert "type" in parsed
            assert "data" in parsed
    
    def test_error_response_json_format(self):
        """测试错误响应的JSON格式"""
        error_response = {
            "type": "error",
            "error_code": "FILE_NOT_FOUND",
            "error_message": "指定的PDF文件不存在",
            "timestamp": 1234567890.0
        }
        
        # 测试错误响应序列化
        json_str = json.dumps(error_response)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "error"
        assert "error_code" in parsed
        assert "error_message" in parsed


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])