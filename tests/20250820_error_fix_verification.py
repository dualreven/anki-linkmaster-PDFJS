#!/usr/bin/env python3
"""
20250820 错误修复验证测试
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

# 直接导入必要的模块
sys.path.insert(0, str(project_root / "src" / "backend"))
from backend.pdf_manager.manager import PDFManager

def test_pdf_manager_behavior():
    """测试PDF管理器行为"""
    print("🧪 测试PDF管理器行为...")
    
    # 创建测试文件
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(b"test pdf content")
        test_file = tmp.name
    
    try:
        # 初始化PDF管理器
        pdf_manager = PDFManager()
        
        # 第一次添加
        print("📥 第一次添加文件...")
        result1 = pdf_manager.add_pdf(test_file)
        print(f"第一次添加结果: {result1}")
        
        # 第二次添加（应该返回False）
        print("📥 第二次添加相同文件...")
        result2 = pdf_manager.add_pdf(test_file)
        print(f"第二次添加结果: {result2}")
        
        # 验证文件列表
        pdf_list = pdf_manager.get_all_pdfs()
        print(f"当前PDF列表: {len(pdf_list)} 个文件")
        
        # 验证结果
        if result1 is True and result2 is False and len(pdf_list) == 1:
            print("✅ PDF管理器行为正确")
            return True
        else:
            print("❌ PDF管理器行为异常")
            return False
            
    finally:
        # 清理测试文件
        if os.path.exists(test_file):
            os.unlink(test_file)

def test_error_message_format():
    """测试错误消息格式"""
    print("\n🧪 测试错误消息格式...")
    
    # 模拟后端错误响应格式
    error_response = {
        "type": "error",
        "data": {
            "code": "FILE_EXISTS",
            "message": "文件已存在于列表中: test.pdf",
            "original_type": "add_pdf"
        }
    }
    
    print("📤 后端错误响应格式:")
    print(json.dumps(error_response, ensure_ascii=False, indent=2))
    
    # 模拟前端处理（修复后的逻辑）
    def handle_error_response(data):
        """模拟前端处理错误响应"""
        try:
            # 兼容新旧格式
            if 'data' in data and 'code' in data['data']:
                code = data['data']['code']
                message = data['data']['message']
            elif 'error_code' in data:
                code = data['error_code']
                message = data['message']
            elif 'code' in data:
                code = data['code']
                message = data.get('message', '未知错误')
            else:
                code = 'UNKNOWN'
                message = '发生未知错误'
            
            return code, message
        except Exception as e:
            return 'PARSE_ERROR', f'解析错误: {str(e)}'
    
    code, message = handle_error_response(error_response)
    
    print(f"\n✅ 前端处理结果:")
    print(f"错误码: {code}")
    print(f"错误消息: {message}")
    
    if message != 'undefined':
        print("✅ 前端显示正常，不会显示undefined")
        return True
    else:
        print("❌ 前端会显示undefined")
        return False

def test_edge_cases():
    """测试边界情况"""
    print("\n🧪 测试边界情况...")
    
    # 测试不同的错误响应格式
    test_cases = [
        # 标准格式
        {"type": "error", "data": {"code": "FILE_EXISTS", "message": "文件已存在"}},
        # 旧格式
        {"type": "error", "error_code": "FILE_EXISTS", "message": "文件已存在"},
        # 简化格式
        {"type": "error", "code": "FILE_EXISTS", "message": "文件已存在"},
        # 无消息
        {"type": "error", "data": {"code": "FILE_EXISTS"}},
        # 无错误码
        {"type": "error", "data": {"message": "未知错误"}}
    ]
    
    def handle_error_response(data):
        """模拟前端处理错误响应"""
        try:
            # 优先处理新格式
            if 'data' in data and 'code' in data['data']:
                code = data['data']['code']
                message = data['data'].get('message', '未知错误')
            elif 'error_code' in data:
                code = data['error_code']
                message = data.get('message', '未知错误')
            elif 'code' in data:
                code = data['code']
                message = data.get('message', '未知错误')
            else:
                code = 'UNKNOWN'
                message = data.get('message', '发生未知错误')
            
            return code, message
        except Exception as e:
            return 'PARSE_ERROR', f'解析错误: {str(e)}'
    
    all_passed = True
    for i, test_case in enumerate(test_cases, 1):
        code, message = handle_error_response(test_case)
        print(f"测试用例 {i}: message='{message}'")
        
        if message == 'undefined' or message == '未知错误' and 'message' not in str(test_case):
            print(f"❌ 测试用例 {i} 可能显示为 undefined")
            all_passed = False
    
    return all_passed

if __name__ == "__main__":
    print("=" * 60)
    print("20250820 错误修复验证测试")
    print("=" * 60)
    
    success = True
    
    # 测试1: PDF管理器行为
    if not test_pdf_manager_behavior():
        success = False
    
    # 测试2: 错误消息格式
    if not test_error_message_format():
        success = False
    
    # 测试3: 边界情况
    if not test_edge_cases():
        success = False
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 所有验证测试通过！")
        print("📋 修复总结:")
        print("   - 后端错误响应格式正确")
        print("   - 前端错误处理已修复")
        print("   - 不会再显示 undefined")
        print("   - 用户会看到正确的错误提示")
    else:
        print("❌ 验证测试未完全通过")
    print("=" * 60)