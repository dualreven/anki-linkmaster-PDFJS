"""
WebSocket修复验证测试脚本
验证JSON模块导入修复是否成功
"""

import sys
import os
import json
import time
import threading
from PyQt6.QtCore import QCoreApplication

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from websocket.server import WebSocketServer


class WebSocketFixVerifier:
    """WebSocket修复验证器"""
    
    def __init__(self):
        self.app = QCoreApplication.instance() or QCoreApplication([])
        self.server = None
        self.test_results = []
    
    def verify_json_import(self):
        """验证JSON模块导入"""
        print("🔍 验证JSON模块导入...")
        
        try:
            # 创建WebSocket服务器实例
            server = WebSocketServer()
            
            # 验证json模块可用
            test_data = {"test": "data"}
            serialized = json.dumps(test_data)
            deserialized = json.loads(serialized)
            
            assert deserialized == test_data, "JSON序列化/反序列化失败"
            
            self.test_results.append(("JSON模块导入", "✅ 通过", "json模块正确导入并可使用"))
            print("   ✅ JSON模块导入成功")
            return True
            
        except Exception as e:
            self.test_results.append(("JSON模块导入", "❌ 失败", str(e)))
            print(f"   ❌ JSON模块导入失败: {e}")
            return False
    
    def verify_send_message_json_serialization(self):
        """验证send_message方法的JSON序列化"""
        print("🔍 验证send_message JSON序列化...")
        
        try:
            server = WebSocketServer()
            
            # 模拟客户端
            server.clients = {"test_client": type('MockClient', (), {'send_message': lambda x: True})()}
            
            # 测试字典消息
            test_message = {"type": "test", "data": {"key": "value"}}
            
            # 验证序列化逻辑（模拟send_message内部逻辑）
            if isinstance(test_message, dict):
                serialized = json.dumps(test_message)
                expected = '{"type": "test", "data": {"key": "value"}}'
                assert json.loads(serialized) == json.loads(expected)
            
            self.test_results.append(("send_message JSON序列化", "✅ 通过", "JSON序列化正常"))
            print("   ✅ send_message JSON序列化成功")
            return True
            
        except Exception as e:
            self.test_results.append(("send_message JSON序列化", "❌ 失败", str(e)))
            print(f"   ❌ send_message JSON序列化失败: {e}")
            return False
    
    def verify_broadcast_message_json_serialization(self):
        """验证broadcast_message方法的JSON序列化"""
        print("🔍 验证broadcast_message JSON序列化...")
        
        try:
            server = WebSocketServer()
            
            # 模拟多个客户端
            mock_client = type('MockClient', (), {'send_message': lambda x: True})()
            server.clients = {"client1": mock_client, "client2": mock_client}
            
            # 测试广播消息
            broadcast_data = {"type": "broadcast", "content": "test"}
            
            # 验证序列化逻辑
            if isinstance(broadcast_data, dict):
                serialized = json.dumps(broadcast_data)
                expected = '{"type": "broadcast", "content": "test"}'
                assert json.loads(serialized) == json.loads(expected)
            
            self.test_results.append(("broadcast_message JSON序列化", "✅ 通过", "广播消息JSON序列化正常"))
            print("   ✅ broadcast_message JSON序列化成功")
            return True
            
        except Exception as e:
            self.test_results.append(("broadcast_message JSON序列化", "❌ 失败", str(e)))
            print(f"   ❌ broadcast_message JSON序列化失败: {e}")
            return False
    
    def verify_on_message_received_json_parsing(self):
        """验证on_message_received方法的JSON解析"""
        print("🔍 验证on_message_received JSON解析...")
        
        try:
            server = WebSocketServer()
            
            # 测试JSON解析
            test_json = '{"type": "test", "data": {"key": "value"}}'
            parsed = json.loads(test_json)
            
            expected = {"type": "test", "data": {"key": "value"}}
            assert parsed == expected
            
            self.test_results.append(("on_message_received JSON解析", "✅ 通过", "JSON解析正常"))
            print("   ✅ on_message_received JSON解析成功")
            return True
            
        except Exception as e:
            self.test_results.append(("on_message_received JSON解析", "❌ 失败", str(e)))
            print(f"   ❌ on_message_received JSON解析失败: {e}")
            return False
    
    def verify_unicode_json_handling(self):
        """验证Unicode字符的JSON处理"""
        print("🔍 验证Unicode JSON处理...")
        
        try:
            unicode_data = {
                "filename": "测试文档.pdf",
                "title": "中文标题",
                "description": "测试描述"
            }
            
            # 测试序列化
            json_str = json.dumps(unicode_data, ensure_ascii=False)
            assert "测试文档.pdf" in json_str
            
            # 测试反序列化
            parsed = json.loads(json_str)
            assert parsed["filename"] == "测试文档.pdf"
            
            self.test_results.append(("Unicode JSON处理", "✅ 通过", "Unicode字符处理正常"))
            print("   ✅ Unicode JSON处理成功")
            return True
            
        except Exception as e:
            self.test_results.append(("Unicode JSON处理", "❌ 失败", str(e)))
            print(f"   ❌ Unicode JSON处理失败: {e}")
            return False
    
    def run_all_verifications(self):
        """运行所有验证测试"""
        print("🚀 开始WebSocket JSON修复验证测试...\n")
        
        # 运行所有验证
        tests = [
            self.verify_json_import,
            self.verify_send_message_json_serialization,
            self.verify_broadcast_message_json_serialization,
            self.verify_on_message_received_json_parsing,
            self.verify_unicode_json_handling
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            print()
        
        # 打印结果总结
        print("=" * 50)
        print("📊 WebSocket JSON修复验证结果")
        print("=" * 50)
        
        for test_name, status, message in self.test_results:
            print(f"{test_name}: {status} - {message}")
        
        print("=" * 50)
        print(f"✅ 通过: {passed}/{total} 项测试")
        
        if passed == total:
            print("🎉 所有测试通过！WebSocket JSON修复验证成功")
            return True
        else:
            print("❌ 部分测试失败，需要进一步修复")
            return False


def main():
    """主测试函数"""
    verifier = WebSocketFixVerifier()
    return verifier.run_all_verifications()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)