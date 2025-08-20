#!/usr/bin/env python3
"""
20250820 最终验证测试
测试目的：验证前端显示"undefined"问题的修复效果
"""

import os
import sys
import tempfile
import json
from pathlib import Path

# 添加项目路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.backend.app.application import AnkiLinkMasterApp

def test_error_response_format():
    """测试错误响应格式是否正确"""
    print("🧪 测试错误响应格式...")
    
    # 创建测试文件
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(b"test pdf content")
        test_file = tmp.name
    
    try:
        # 初始化应用
        app = AnkiLinkMasterApp()
        
        # 模拟客户端ID
        client_id = "test_client"
        
        # 第一次添加
        print("📥 第一次添加文件...")
        result1 = app.handle_add_pdf_with_path(test_file, client_id)
        print(f"第一次添加结果: {result1}")
        
        # 第二次添加（应该返回错误）
        print("📥 第二次添加相同文件...")
        result2 = app.handle_add_pdf_with_path(test_file, client_id)
        print(f"第二次添加结果: {result2}")
        
        # 验证响应格式
        messages = app.websocket_server.messages
        error_messages = [m for m in messages if m['client_id'] == client_id and m['message'].get('type') == 'error']
        
        if error_messages:
            error_msg = error_messages[-1]['message']
            print(f"\n📤 错误响应格式:")
            print(json.dumps(error_msg, ensure_ascii=False, indent=2))
            
            # 验证格式
            if 'data' in error_msg and 'code' in error_msg['data']:
                print("✅ 错误响应格式正确")
                print(f"错误码: {error_msg['data']['code']}")
                print(f"错误消息: {error_msg['data']['message']}")
                return True
            else:
                print("❌ 错误响应格式不正确")
                return False
        else:
            print("❌ 未找到错误消息")
            return False
            
    finally:
        # 清理测试文件
        if os.path.exists(test_file):
            os.unlink(test_file)
        # 清理PDF列表
        if 'app' in locals():
            app.pdf_manager.clear_all_pdfs()

def test_frontend_compatibility():
    """测试前端兼容性"""
    print("\n🧪 测试前端兼容性...")
    
    # 模拟前端处理逻辑
    def mock_frontend_handle_error(error_data):
        """模拟前端错误处理"""
        # 兼容新旧格式
        if 'data' in error_data and 'code' in error_data['data']:
            # 新格式
            code = error_data['data']['code']
            message = error_data['data']['message']
        elif 'error_code' in error_data:
            # 旧格式
            code = error_data['error_code']
            message = error_data['message']
        elif 'code' in error_data:
            # 简化格式
            code = error_data['code']
            message = error_data.get('message', '未知错误')
        else:
            # 无法识别
            code = 'UNKNOWN'
            message = 'undefined'
        
        return code, message
    
    # 测试不同格式
    test_cases = [
        {"type": "error", "data": {"code": "FILE_EXISTS", "message": "文件已存在"}},
        {"type": "error", "error_code": "FILE_EXISTS", "message": "文件已存在"},
        {"type": "error", "code": "FILE_EXISTS", "message": "文件已存在"},
        {"type": "error", "message": "未知错误"}
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        code, message = mock_frontend_handle_error(test_case)
        print(f"测试用例 {i}: code={code}, message='{message}'")
        
        if message == 'undefined':
            print(f"❌ 测试用例 {i} 显示为 undefined")
            return False
    
    print("✅ 所有测试用例都正确处理")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("20250820 最终验证测试")
    print("=" * 60)
    
    success = True
    
    # 测试1: 错误响应格式
    if not test_error_response_format():
        success = False
    
    # 测试2: 前端兼容性
    if not test_frontend_compatibility():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 所有测试通过！问题已修复")
    else:
        print("❌ 测试未通过，需要进一步检查")
    print("=" * 60)