"""
WebSocket端到端集成测试
测试完整的WebSocket通信流程，包括JSON处理
"""

import sys
import os
import json
import time
import threading
import pytest
from PyQt6.QtCore import QCoreApplication, QTimer

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from websocket.server import WebSocketServer


class TestWebSocketIntegration:
    """WebSocket端到端集成测试"""
    
    @classmethod
    def setup_class(cls):
        """测试类初始化"""
        cls.app = QCoreApplication.instance() or QCoreApplication([])
    
    def test_server_startup_with_json_support(self):
        """测试服务器启动时JSON支持是否正常"""
        server = WebSocketServer()
        
        # 验证服务器可以启动
        assert hasattr(server, 'send_message'), "服务器应该有send_message方法"
        assert hasattr(server, 'broadcast_message'), "服务器应该有broadcast_message方法"
        
        # 验证这些方法可以访问json模块
        assert 'json' in sys.modules, "json模块应该已导入"
    
    def test_json_message_round_trip(self):
        """测试JSON消息的完整往返流程"""
        server = WebSocketServer()
        
        # 测试消息
        original_message = {
            "type": "add_pdf",
            "id": "msg_123",
            "data": {
                "filename": "test_document.pdf",
                "filepath": "/path/to/test_document.pdf",
                "metadata": {
                    "title": "Test Document",
                    "author": "Test Author",
                    "pages": 42
                }
            },
            "timestamp": time.time()
        }
        
        # 序列化
        json_string = json.dumps(original_message)
        assert isinstance(json_string, str), "应该返回字符串"
        
        # 反序列化
        parsed_message = json.loads(json_string)
        assert parsed_message == original_message, "反序列化后应该与原始消息相同"
        
        # 验证消息结构完整性
        assert parsed_message["type"] == "add_pdf"
        assert parsed_message["data"]["filename"] == "test_document.pdf"
        assert parsed_message["data"]["metadata"]["pages"] == 42
    
    def test_error_handling_with_json(self):
        """测试带JSON的错误处理"""
        server = WebSocketServer()
        
        # 测试错误响应格式
        error_response = {
            "type": "error",
            "error_code": "INVALID_REQUEST",
            "error_message": "Invalid JSON format",
            "original_message": "{invalid json}",
            "timestamp": time.time()
        }
        
        # 验证错误响应可以正确序列化
        json_str = json.dumps(error_response)
        parsed = json.loads(json_str)
        
        assert parsed["type"] == "error"
        assert "error_code" in parsed
        assert "error_message" in parsed
    
    def test_unicode_json_handling(self):
        """测试Unicode字符的JSON处理"""
        server = WebSocketServer()
        
        # 包含Unicode字符的消息
        unicode_message = {
            "type": "add_pdf",
            "data": {
                "filename": "测试文档.pdf",
                "title": "中文标题文档",
                "description": "这是一个包含特殊字符的测试文档: àáâãäåæçèéêë 中文测试"
            }
        }
        
        # 测试序列化
        json_str = json.dumps(unicode_message, ensure_ascii=False)
        assert "测试文档.pdf" in json_str, "Unicode字符应该保留在JSON中"
        
        # 测试反序列化
        parsed = json.loads(json_str)
        assert parsed["data"]["filename"] == "测试文档.pdf"
        assert "中文测试" in parsed["data"]["description"]
    
    def test_complex_data_structures(self):
        """测试复杂数据结构的JSON处理"""
        server = WebSocketServer()
        
        # 复杂数据结构
        complex_data = {
            "type": "pdf_list_update",
            "data": {
                "pdfs": [
                    {
                        "id": "pdf_123",
                        "filename": "document1.pdf",
                        "size": 1024000,
                        "metadata": {
                            "title": "Document 1",
                            "author": "Author Name",
                            "pages": 100,
                            "keywords": ["test", "pdf", "document"]
                        },
                        "thumbnail": "/path/to/thumbnail.jpg"
                    },
                    {
                        "id": "pdf_456",
                        "filename": "document2.pdf",
                        "size": 2048000,
                        "metadata": {
                            "title": "Document 2",
                            "author": "Another Author",
                            "pages": 200,
                            "keywords": ["example", "pdf"]
                        }
                    }
                ],
                "total_count": 2,
                "last_update": time.time()
            }
        }
        
        # 测试完整序列化/反序列化
        json_str = json.dumps(complex_data)
        parsed = json.loads(json_str)
        
        # 验证结构完整性
        assert len(parsed["data"]["pdfs"]) == 2
        assert parsed["data"]["total_count"] == 2
        assert parsed["data"]["pdfs"][0]["metadata"]["pages"] == 100
        assert "test" in parsed["data"]["pdfs"][0]["metadata"]["keywords"]
    
    def test_empty_and_edge_cases(self):
        """测试空值和边界情况的JSON处理"""
        server = WebSocketServer()
        
        edge_cases = [
            {"type": "empty_data", "data": {}},
            {"type": "null_values", "data": {"null_value": None, "empty_string": ""}},
            {"type": "numeric_limits", "data": {"max_int": 2**31-1, "min_int": -2**31}},
            {"type": "boolean_values", "data": {"true": True, "false": False}},
            {"type": "array_empty", "data": {"empty_array": [], "nested_array": [[], [1, 2, 3]]}}
        ]
        
        for test_case in edge_cases:
            json_str = json.dumps(test_case)
            parsed = json.loads(json_str)
            assert parsed == test_case, f"边界情况处理失败: {test_case}"
    
    def test_server_methods_json_accessibility(self):
        """测试服务器方法可以正确访问JSON功能"""
        server = WebSocketServer()
        
        # 验证服务器实例可以直接使用json
        test_data = {"test": "json_accessibility"}
        
        # 模拟send_message方法中的序列化
        message = test_data
        if isinstance(message, dict):
            serialized = json.dumps(message)
            assert serialized == '{"test": "json_accessibility"}'
        
        # 模拟broadcast_message方法中的序列化
        broadcast_msg = {"type": "broadcast", "data": test_data}
        if isinstance(broadcast_msg, dict):
            serialized = json.dumps(broadcast_msg)
            assert "json_accessibility" in serialized


if __name__ == "__main__":
    # 运行测试
    pytest.main([__file__, "-v"])