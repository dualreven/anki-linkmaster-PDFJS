#!/usr/bin/env python3
"""
QT文件选择功能验证测试
"""

import os
import sys
import json
import tempfile
import time
from pathlib import Path

# 添加src/backend到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from app.application import AnkiLinkMasterApp
from pdf_manager.manager import PDFManager

class MockWebsocketServer:
    """模拟WebSocket服务器用于测试"""
    
    def __init__(self):
        self.messages = []
    
    def send_message(self, client_id, message):
        """模拟发送消息"""
        self.messages.append({
            'client_id': client_id,
            'message': message
        })
        print(f"发送到客户端 {client_id}: {json.dumps(message, ensure_ascii=False)}")
    
    def broadcast_message(self, message):
        """模拟广播消息"""
        self.messages.append({
            'client_id': 'broadcast',
            'message': message
        })
        print(f"广播消息: {json.dumps(message, ensure_ascii=False)}")

def create_test_pdf():
    """创建测试PDF文件"""
    # 使用一个简单的PDF文件作为测试
    test_pdf_content = b'''%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello, PDF!) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000204 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
298
%%EOF'''
    
    with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as f:
        f.write(test_pdf_content)
        return f.name

def test_qt_file_selection():
    """测试QT文件选择功能"""
    print("=== 开始QT文件选择功能验证测试 ===")
    
    # 创建临时测试PDF
    test_pdf_path = create_test_pdf()
    print(f"创建测试PDF文件: {test_pdf_path}")
    
    try:
        # 初始化应用
        pdf_manager = PDFManager()
        app = AnkiLinkMasterApp()
        app.pdf_manager = pdf_manager
        
        # 模拟WebSocket服务器
        mock_server = MockWebsocketServer()
        app.websocket_server = mock_server
        
        # 测试1: 模拟文件选择请求
        print("\n--- 测试1: 文件选择请求 ---")
        
        # 由于QT需要GUI环境，这里模拟文件选择的结果
        # 在实际环境中，这会弹出QT文件选择对话框
        
        # 模拟用户选择文件
        file_info = {
            'name': os.path.basename(test_pdf_path),
            'size': os.path.getsize(test_pdf_path),
            'path': test_pdf_path
        }
        
        # 测试直接添加文件
        print(f"测试添加文件: {file_info}")
        
        # 调用handle_add_pdf_with_path方法
        app.handle_add_pdf_with_path('test_client', file_info, 'test_message_123')
        
        # 验证响应
        if mock_server.messages:
            last_message = mock_server.messages[-1]
            if last_message['message'].get('type') == 'success':
                print("✅ 文件添加成功响应")
                print(f"   文件名: {last_message['message']['data']['result']['filename']}")
                print(f"   文件路径: {last_message['message']['data']['result']['filepath']}")
            else:
                print("❌ 文件添加失败")
                print(f"   错误: {last_message['message']}")
        
        # 测试2: 验证文件是否真的被添加
        print("\n--- 测试2: 验证文件添加结果 ---")
        
        files = pdf_manager.get_files()
        if files:
            print("✅ PDF管理器中已添加文件")
            for file_info in files:
                print(f"   ID: {file_info['id']}")
                print(f"   文件名: {file_info['filename']}")
                print(f"   文件大小: {file_info['file_size']} bytes")
                print(f"   文件路径: {file_info['filepath']}")
        else:
            print("❌ PDF管理器中没有文件")
        
        # 测试3: 验证文件路径是否正确
        print("\n--- 测试3: 验证文件路径 ---")
        
        if files:
            first_file = files[0]
            if os.path.exists(first_file['filepath']):
                print("✅ 文件路径有效")
                print(f"   真实路径: {first_file['filepath']}")
            else:
                print("❌ 文件路径无效")
        
        print("\n=== 测试完成 ===")
        
    except Exception as e:
        print(f"❌ 测试过程中出现错误: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理临时文件
        if os.path.exists(test_pdf_path):
            os.unlink(test_pdf_path)
            print(f"清理临时文件: {test_pdf_path}")

if __name__ == '__main__':
    test_qt_file_selection()