#!/usr/bin/env python3
"""
20250820 错误显示验证测试

测试目的：验证前端错误提示显示修复
测试起因：用户选择已存在的PDF文件时显示"undefined"而不是具体的错误信息

测试内容：
1. 验证FILE_EXISTS错误码处理
2. 验证错误消息正确显示
3. 验证前后端消息格式兼容性
"""

import sys
import os
import json
import tempfile
import time
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from pdf_manager.manager import PDFManager

class MockWebSocketServer:
    """模拟WebSocket服务器"""
    def __init__(self):
        self.messages = []
        self.clients = {}
    
    def send_message(self, client_id, message):
        """模拟发送消息"""
        if isinstance(message, dict):
            message_str = json.dumps(message)
        else:
            message_str = str(message)
        
        self.messages.append({
            'client_id': client_id,
            'message': message
        })
        print(f"📤 发送到客户端 {client_id}: {message_str}")
        return True
    
    def broadcast(self, message):
        """模拟广播消息"""
        if isinstance(message, dict):
            message_str = json.dumps(message)
        else:
            message_str = str(message)
        
        self.messages.append({
            'client_id': 'broadcast',
            'message': message
        })
        print(f"📢 广播: {message_str}")

class MockApplication:
    """简化版的应用类，只测试PDF管理器功能"""
    def __init__(self):
        self.pdf_manager = PDFManager()
        self.websocket_server = MockWebSocketServer()
    
    def send_error_response(self, client_id, message, action_type, error_code, message_id=None):
        """模拟发送错误响应"""
        response = {
            'type': 'error',
            'data': {
                'code': error_code,
                'message': message,
                'original_type': action_type
            }
        }
        self.websocket_server.send_message(client_id, response)
    
    def send_success_response(self, client_id, action_type, data, message_id=None):
        """模拟发送成功响应"""
        response = {
            'type': 'success',
            'data': {
                'original_type': action_type,
                'result': data
            }
        }
        self.websocket_server.send_message(client_id, response)

def test_file_exists_error_display():
    """测试文件已存在错误显示"""
    print("🧪 开始测试文件已存在错误显示...")
    
    try:
        # 创建临时测试文件
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(b"test pdf content")
            test_pdf_path = temp_file.name
        
        # 初始化组件
        app = MockApplication()
        client_id = "test_client_1"
        
        
        # 第一次添加文件 - 应该成功
        print("\n📥 第一次添加文件...")
        
        # 使用PDF管理器直接测试
        result = app.pdf_manager.add_file(test_pdf_path)
        
        if result:
            print("✅ 第一次添加成功")
        else:
            print("❌ 第一次添加失败")
            return False
        
        # 清理消息
        app.websocket_server.messages.clear()
        
        # 第二次添加相同文件 - 应该失败
        print("\n📥 第二次添加相同文件...")
        
        # 模拟handle_add_pdf_with_path的行为
        filename = os.path.basename(test_pdf_path)
        
        result = app.pdf_manager.add_file(test_pdf_path)
        
        if result:
            print("❌ 第二次添加应该失败")
            return False
        else:
            # 模拟发送错误响应
            app.send_error_response(
                client_id,
                f"文件已存在于列表中: {filename}",
                "add_pdf",
                "FILE_EXISTS",
                "msg_002"
            )
        
        # 检查消息
        success_messages = [m for m in app.websocket_server.messages 
                         if m['client_id'] == client_id and 
                         m['message'].get('type') == 'success']

        if success_messages:
            print("✅ 第一次添加成功")
        else:
            print("❌ 第一次添加失败")
            return False

        # 清理消息
        app.websocket_server.messages.clear()
        
        # 第二次添加相同文件 - 应该返回FILE_EXISTS错误
        print("\n📥 第二次添加相同文件...")
        app.handle_add_pdf_with_path(client_id, file_info, "msg_002")
        
        # 检查错误消息
        error_messages = [m for m in app.websocket_server.messages 
                        if m['client_id'] == client_id and 
                        m['message'].get('type') == 'error']
        
        if not error_messages:
            print("❌ 未收到错误消息")
            return False
        
        error_msg = error_messages[0]
        error_data = error_msg['message']
        
        # 验证错误格式
        if 'data' in error_data and 'code' in error_data['data']:
            error_code = error_data['data']['code']
            error_message = error_data['data']['message']
        elif 'error_code' in error_data:
            # 兼容旧格式
            error_code = error_data['error_code']
            error_message = error_data['message']
        else:
            print("❌ 错误消息格式不正确")
            return False
        
        print(f"📝 错误码: {error_code}")
        print(f"📝 错误消息: {error_message}")
        
        # 验证错误类型和内容
        if error_code == "FILE_EXISTS":
            print("✅ 正确识别FILE_EXISTS错误")
        else:
            print(f"❌ 错误码不匹配，期望FILE_EXISTS，实际: {error_code}")
            return False
        
        if "已存在于列表中" in error_message:
            print("✅ 错误消息内容正确")
        else:
            print(f"❌ 错误消息内容不匹配: {error_message}")
            return False
        
        # 清理测试文件
        try:
            os.unlink(test_pdf_path)
        except:
            pass
        
        print("\n🎉 文件已存在错误显示测试通过！")
        return True
        
    except Exception as e:
        print(f"❌ 测试过程中出现错误: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 清理测试文件
        try:
            if 'test_pdf_path' in locals():
                os.unlink(test_pdf_path)
        except:
            pass
        
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("20250820 错误显示验证测试")
    print("=" * 60)
    
    success = test_file_exists_error_display()
    
    if success:
        print("\n✅ 所有测试通过！修复有效")
    else:
        print("\n❌ 测试失败，需要进一步检查")
    
    print("=" * 60)