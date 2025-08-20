#!/usr/bin/env python3
"""
QT集成修复验证测试
验证QT文件选择机制是否正常工作
"""

import sys
import os
import tempfile
import json
from pathlib import Path

# 添加项目路径
sys.path.insert(0, 'src/backend')

from pdf_manager.manager import PDFManager
from app.application import AnkiLinkMasterApp

class MockWebsocketServer:
    """模拟WebSocket服务器"""
    def __init__(self):
        self.messages = []
        self.clients = {}
    
    def send_message(self, client_id, message):
        """模拟发送消息"""
        self.messages.append({
            'client_id': client_id,
            'message': message
        })
    
    def broadcast_message(self, message):
        """模拟广播消息"""
        self.messages.append({
            'type': 'broadcast',
            'message': message
        })

def test_qt_integration():
    """测试QT文件选择集成"""
    print("=== QT文件选择集成验证测试 ===")
    
    # 创建测试PDF文件
    test_pdf_path = r"C:\Users\napretep\Desktop\test.pdf"
    
    if not os.path.exists(test_pdf_path):
        print(f"❌ 测试文件不存在: {test_pdf_path}")
        return False
    
    print(f"测试文件: {test_pdf_path}")
    print(f"文件大小: {os.path.getsize(test_pdf_path)} bytes")
    
    try:
        # 初始化应用
        pdf_manager = PDFManager()
        app = AnkiLinkMasterApp()
        app.pdf_manager = pdf_manager
        
        # 模拟WebSocket服务器
        mock_server = MockWebsocketServer()
        app.websocket_server = mock_server
        
        # 清空现有文件
        files = pdf_manager.get_files()
        for file_info in files:
            pdf_manager.remove_file(file_info['filename'])
        
        print(f"已清空PDF管理器，当前文件数: {len(pdf_manager.get_files())}")
        
        # 测试1: 直接通过handle_add_pdf_with_path添加
        print("\n--- 测试1: 直接添加真实文件 ---")
        
        file_info = {
            'name': os.path.basename(test_pdf_path),
            'size': os.path.getsize(test_pdf_path),
            'path': test_pdf_path
        }
        
        app.handle_add_pdf_with_path('test_client', file_info, 'test_message_123')
        
        # 检查响应
        success_response = None
        for msg in mock_server.messages:
            if msg['message'].get('type') == 'success' and msg['message'].get('action') == 'add_pdf':
                success_response = msg
                break
        
        if success_response:
            print("✅ 成功响应收到")
            print(f"   消息: {success_response['message']}")
        else:
            print("❌ 未收到成功响应")
            for msg in mock_server.messages:
                print(f"   调试消息: {msg}")
        
        # 检查文件是否被添加
        files_after = pdf_manager.get_files()
        print(f"添加后文件数: {len(files_after)}")
        
        if len(files_after) == 1:
            added_file = files_after[0]
            print("✅ 文件成功添加到管理器")
            print(f"   文件名: {added_file['filename']}")
            print(f"   路径: {added_file['filepath']}")
            print(f"   大小: {added_file['file_size']} bytes")
            
            # 验证文件路径是否正确
            if added_file['filepath'] == test_pdf_path:
                print("✅ 文件路径正确")
            else:
                print(f"❌ 文件路径错误: {added_file['filepath']}")
        else:
            print("❌ 文件未添加到管理器")
        
        # 测试2: 重复添加测试
        print("\n--- 测试2: 重复添加测试 ---")
        mock_server.messages.clear()
        
        app.handle_add_pdf_with_path('test_client', file_info, 'test_message_456')
        
        error_response = None
        for msg in mock_server.messages:
            if msg['message'].get('type') == 'error' and msg['message'].get('action') == 'add_pdf':
                error_response = msg
                break
        
        if error_response:
            print("✅ 重复添加正确处理")
            print(f"   错误消息: {error_response['message']['message']}")
        else:
            print("❌ 重复添加处理异常")
        
        return len(files_after) == 1
        
    except Exception as e:
        print(f"❌ 测试过程中出现错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_qt_integration()
    
    if success:
        print("\n🎉 QT文件选择集成验证通过！")
    else:
        print("\n❌ QT文件选择集成验证失败！")