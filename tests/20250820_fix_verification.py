#!/usr/bin/env python3
"""
2025年8月20日修复验证测试
测试目的：验证application.py中重复代码修复效果
测试起因：修复handle_add_pdf_with_path方法的重复代码和错误处理逻辑
"""

import os
import sys
import tempfile
import json
import logging
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src" / "backend"))

from app.application import AnkiLinkMasterApp
from pdf_manager.manager import PDFManager
from websocket.server import WebSocketServer

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MockWebSocketServer:
    """模拟WebSocket服务器"""
    
    def __init__(self):
        self.messages = []
    
    def send_message(self, client_id, message):
        """模拟发送消息"""
        if isinstance(message, dict):
            data = message
        else:
            data = json.loads(message)
        self.messages.append({
            'client_id': client_id,
            'type': data.get('type', ''),
            'status': data.get('status', ''),
            'message': data.get('message', ''),
            'data': data.get('data', {})
        })
        logger.info(f"发送消息: {data}")
    
    def broadcast_message(self, message):
        """模拟广播消息"""
        if isinstance(message, dict):
            data = message
        else:
            data = json.loads(message)
        logger.info(f"广播消息: {data}")


def create_test_pdf():
    """创建测试PDF文件"""
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
(Test PDF File) Tj
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


def test_fix_verification():
    """验证修复效果"""
    print("🧪 开始修复验证测试...")
    
    # 创建测试环境
    mock_ws = MockWebSocketServer()
    pdf_manager = PDFManager()
    app = AnkiLinkMasterApp()
    app.pdf_manager = pdf_manager
    app.websocket_server = mock_ws
    
    # 创建测试文件
    test_pdf_path = create_test_pdf()
    print(f"✅ 创建测试PDF文件: {test_pdf_path}")
    
    try:
        # 测试1：首次添加文件
        print("\n📋 测试1：首次添加文件")
        file_info = {
            'name': os.path.basename(test_pdf_path),
            'path': test_pdf_path,
            'size': os.path.getsize(test_pdf_path)
        }
        
        app.handle_add_pdf_with_path("client_1", file_info, "msg_001")
        
        # 验证结果
        messages = mock_ws.messages
        success_messages = [m for m in messages if m['status'] == 'success']
        
        if success_messages:
            print("✅ 首次添加成功")
        else:
            print("❌ 首次添加失败")
            return False
        
        # 测试2：重复添加同一文件
        print("\n📋 测试2：重复添加同一文件")
        mock_ws.messages.clear()  # 清空消息
        
        app.handle_add_pdf_with_path("client_1", file_info, "msg_002")
        
        # 验证结果
        messages = mock_ws.messages
        error_messages = [m for m in messages if m['status'] == 'error']
        
        if error_messages and '已存在' in error_messages[0]['message']:
            print("✅ 重复添加正确处理")
        else:
            print("❌ 重复添加处理异常")
            return False
        
        # 测试3：不存在的文件
        print("\n📋 测试3：不存在的文件")
        mock_ws.messages.clear()
        
        non_existent_file = {
            'name': 'non_existent.pdf',
            'path': '/path/to/non_existent.pdf',
            'size': 0
        }
        
        app.handle_add_pdf_with_path("client_1", non_existent_file, "msg_003")
        
        messages = mock_ws.messages
        error_messages = [m for m in messages if m['status'] == 'error']
        
        if error_messages and '不存在' in error_messages[0]['message']:
            print("✅ 不存在的文件正确处理")
        else:
            print("❌ 不存在的文件处理异常")
            return False
        
        # 测试4：验证文件数量
        print("\n📋 测试4：验证文件数量")
        file_count = pdf_manager.get_file_count()
        
        if file_count == 1:
            print(f"✅ 文件数量正确: {file_count}")
        else:
            print(f"❌ 文件数量异常: {file_count}")
            return False
        
        print("\n🎉 所有测试通过！修复验证成功")
        return True
        
    finally:
        # 清理测试文件
        try:
            os.unlink(test_pdf_path)
            print("✅ 清理测试文件")
        except:
            pass


if __name__ == "__main__":
    success = test_fix_verification()
    sys.exit(0 if success else 1)