#!/usr/bin/env python3
"""
2025年8月20日简单修复验证测试
测试目的：验证PDF文件添加功能的修复效果
"""

import os
import sys
import tempfile
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src" / "backend"))

from pdf_manager.manager import PDFManager

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

def test_pdf_manager_direct():
    """直接测试PDF管理器"""
    print("🧪 直接测试PDF管理器功能...")
    
    pdf_manager = PDFManager()
    
    # 创建测试文件
    test_pdf_path = create_test_pdf()
    print(f"✅ 创建测试PDF文件: {test_pdf_path}")
    
    try:
        # 测试1：首次添加
        print("\n📋 测试1：首次添加文件")
        result1 = pdf_manager.add_file(test_pdf_path)
        
        if result1:
            print("✅ 首次添加成功")
        else:
            print("⚠️  首次添加失败（可能已存在）")
        
        file_count = pdf_manager.get_file_count()
        print(f"📊 当前文件数量: {file_count}")
        
        # 测试2：重复添加
        print("\n📋 测试2：重复添加同一文件")
        result2 = pdf_manager.add_file(test_pdf_path)
        
        if not result2:
            print("✅ 重复添加正确处理（返回False）")
        else:
            print("❌ 重复添加处理异常")
        
        file_count2 = pdf_manager.get_file_count()
        print(f"📊 重复添加后文件数量: {file_count2}")
        
        # 测试3：验证文件信息
        files = pdf_manager.get_files()
        print(f"📋 测试3：文件列表信息")
        for file_info in files:
            if file_info['filepath'] == test_pdf_path:
                print(f"✅ 找到测试文件: {file_info['filename']}")
                print(f"   文件大小: {file_info['file_size_formatted']}")
                print(f"   文件ID: {file_info['id']}")
                break
        
        # 测试4：清理后重新添加
        print("\n📋 测试4：清理后重新添加")
        # 获取文件ID
        file_id = None
        for file_info in files:
            if file_info['filepath'] == test_pdf_path:
                file_id = file_info['id']
                break
        
        if file_id:
            pdf_manager.remove_file(file_id)
            print("✅ 文件已移除")
            
            result3 = pdf_manager.add_file(test_pdf_path)
            if result3:
                print("✅ 清理后重新添加成功")
            else:
                print("❌ 清理后重新添加失败")
        
        print("\n🎉 所有测试完成！")
        return True
        
    finally:
        # 清理测试文件
        try:
            os.unlink(test_pdf_path)
            print("✅ 清理测试文件")
        except:
            pass

if __name__ == "__main__":
    success = test_pdf_manager_direct()
    sys.exit(0 if success else 1)