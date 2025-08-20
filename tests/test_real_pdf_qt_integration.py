#!/usr/bin/env python3
"""
QT文件选择集成验证测试
"""

import os
import sys
import tempfile
import json
from pathlib import Path

# 添加src/backend到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from pdf_manager.manager import PDFManager

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

def test_pdf_manager_with_real_file():
    """测试PDF管理器使用真实文件路径"""
    print("=== PDF管理器真实文件路径测试 ===")
    
    # 创建临时测试PDF
    test_pdf_path = create_test_pdf()
    print(f"创建测试PDF文件: {test_pdf_path}")
    
    try:
        # 初始化PDF管理器
        pdf_manager = PDFManager()
        
        # 测试1: 直接添加真实文件
        print("\n--- 测试1: 直接添加真实文件 ---")
        
        result = pdf_manager.add_file(test_pdf_path)
        
        if result:
            print("✅ PDF文件添加成功")
        else:
            print("❌ PDF文件添加失败")
        
        # 测试2: 验证文件信息
        print("\n--- 测试2: 验证文件信息 ---")
        
        files = pdf_manager.get_files()
        if files:
            print("✅ PDF管理器中已添加文件")
            for file_info in files:
                print(f"   ID: {file_info['id']}")
                print(f"   文件名: {file_info['filename']}")
                print(f"   文件大小: {file_info['file_size']} bytes")
                print(f"   文件路径: {file_info['filepath']}")
                
                # 验证文件存在
                if os.path.exists(file_info['filepath']):
                    print("   ✅ 文件路径有效")
                else:
                    print("   ❌ 文件路径无效")
        else:
            print("❌ PDF管理器中没有文件")
        
        # 测试3: 验证文件内容
        print("\n--- 测试3: 验证文件内容 ---")
        
        if files:
            first_file = files[0]
            try:
                with open(first_file['filepath'], 'rb') as f:
                    content = f.read(10)
                    if content.startswith(b'%PDF'):
                        print("✅ 文件是有效的PDF格式")
                    else:
                        print("❌ 文件不是有效的PDF格式")
            except Exception as e:
                print(f"❌ 读取文件失败: {e}")
        
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

def test_file_info_extraction():
    """测试文件信息提取"""
    print("\n=== 文件信息提取测试 ===")
    
    test_pdf_path = create_test_pdf()
    print(f"创建测试PDF文件: {test_pdf_path}")
    
    try:
        from pdf_manager.models import PDFFile
        
        # 测试PDFFile类
        pdf_file = PDFFile.from_file_path(test_pdf_path)
        
        file_info = pdf_file.get_file_info()
        
        print("✅ 文件信息提取成功")
        print(f"   ID: {file_info['id']}")
        print(f"   文件名: {file_info['filename']}")
        print(f"   文件大小: {file_info['file_size']} bytes")
        print(f"   文件路径: {file_info['filepath']}")
        
        # 验证键名
        expected_keys = ['id', 'filename', 'filepath', 'file_size', 'upload_date']
        for key in expected_keys:
            if key in file_info:
                print(f"   ✅ 包含键 '{key}': {file_info[key]}")
            else:
                print(f"   ❌ 缺少键 '{key}'")
        
    except Exception as e:
        print(f"❌ 文件信息提取失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(test_pdf_path):
            os.unlink(test_pdf_path)
            print(f"清理临时文件: {test_pdf_path}")

if __name__ == '__main__':
    test_pdf_manager_with_real_file()
    test_file_info_extraction()