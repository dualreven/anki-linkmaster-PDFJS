"""
PDF文件添加失败诊断测试
"""

import os
import sys
import tempfile
import logging

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pdf_manager.manager import PDFManager
from pdf_manager.utils import FileValidator

# 设置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def test_pdf_add_pipeline():
    """测试PDF添加完整流程"""
    
    print("🔍 开始PDF添加失败诊断测试...")
    
    # 1. 测试临时目录权限
    print("\n1️⃣ 测试临时目录权限...")
    temp_dir = tempfile.gettempdir()
    print(f"   临时目录: {temp_dir}")
    print(f"   目录存在: {os.path.exists(temp_dir)}")
    print(f"   目录可写: {os.access(temp_dir, os.W_OK)}")
    
    # 2. 测试文件创建
    print("\n2️⃣ 测试文件创建...")
    test_filename = "test.pdf"
    test_filepath = os.path.join(temp_dir, test_filename)
    
    try:
        # 创建测试PDF文件
        pdf_content = b'''%PDF-1.4
%\xe2\xe3\xcf\xd3
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
(Test PDF Content) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000174 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
262
%%EOF'''
        
        with open(test_filepath, 'wb') as f:
            f.write(pdf_content)
        
        print(f"   文件创建成功: {test_filepath}")
        print(f"   文件大小: {os.path.getsize(test_filepath)} bytes")
        
        # 3. 测试文件验证
        print("\n3️⃣ 测试文件验证...")
        
        # 测试文件存在性
        exists = os.path.exists(test_filepath)
        print(f"   文件存在: {exists}")
        
        # 测试PDF格式验证
        is_pdf = FileValidator.is_pdf_file(test_filepath)
        print(f"   是PDF文件: {is_pdf}")
        
        # 测试文件权限
        can_read, read_error = FileValidator.can_access_file(test_filepath)
        print(f"   文件可读: {can_read}")
        if not can_read:
            print(f"   读取错误: {read_error}")
        
        # 测试文件操作验证
        is_valid, validation_error = FileValidator.validate_file_operation(test_filepath, "read")
        print(f"   文件验证通过: {is_valid}")
        if not is_valid:
            print(f"   验证错误: {validation_error}")
        
        # 4. 测试PDF管理器添加
        print("\n4️⃣ 测试PDF管理器添加...")
        manager = PDFManager()
        
        # 检查文件是否已存在
        from pdf_manager.models import PDFFile
        file_id = PDFFile.generate_file_id(test_filepath)
        exists_in_list = manager.file_list.exists(file_id)
        print(f"   文件已在列表中: {exists_in_list}")
        
        if not exists_in_list:
            result = manager.add_file(test_filepath)
            print(f"   添加结果: {result}")
            
            if result:
                files = manager.get_files()
                print(f"   当前文件数量: {len(files)}")
                if files:
                    print(f"   最新文件: {files[-1]['filename']}")
            else:
                print("   ❌ 添加失败 - 检查PDFManager日志")
        else:
            print("   文件已存在，跳过添加")
        
        # 5. 清理测试文件
        if os.path.exists(test_filepath):
            os.remove(test_filepath)
            print(f"   测试文件已清理")
            
        return True
        
    except Exception as e:
        print(f"   ❌ 测试失败: {str(e)}")
        logger.exception("PDF添加测试失败")
        return False

def test_real_world_scenarios():
    """测试真实场景"""
    
    print("\n🌍 测试真实场景...")
    
    scenarios = [
        # 场景1: 正常PDF文件
        {
            "name": "正常PDF文件",
            "filename": "valid_test.pdf",
            "content": b"%PDF-1.4\n%test\n1 0 obj<</Type/Catalog>>endobj trailer<</Root 1 0 R>>",
            "expected": True
        },
        # 场景2: 非PDF文件
        {
            "name": "非PDF文件",
            "filename": "fake.pdf",
            "content": b"This is not a PDF file",
            "expected": False
        },
        # 场景3: 空文件
        {
            "name": "空文件",
            "filename": "empty.pdf",
            "content": b"",
            "expected": False
        }
    ]
    
    temp_dir = tempfile.gettempdir()
    manager = PDFManager()
    
    for scenario in scenarios:
        print(f"\n   测试场景: {scenario['name']}")
        filepath = os.path.join(temp_dir, scenario['filename'])
        
        try:
            # 创建测试文件
            with open(filepath, 'wb') as f:
                f.write(scenario['content'])
            
            # 测试添加
            result = manager.add_file(filepath)
            expected = scenario['expected']
            
            status = "✅" if result == expected else "❌"
            print(f"   {status} 结果: {result}, 期望: {expected}")
            
            # 清理
            if os.path.exists(filepath):
                os.remove(filepath)
                
        except Exception as e:
            print(f"   ❌ 异常: {str(e)}")
            if os.path.exists(filepath):
                os.remove(filepath)

if __name__ == "__main__":
    print("=" * 60)
    print("PDF文件添加失败诊断测试")
    print("=" * 60)
    
    success = test_pdf_add_pipeline()
    test_real_world_scenarios()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 诊断测试完成 - 基础功能正常")
    else:
        print("❌ 诊断测试发现问题")
    print("=" * 60)