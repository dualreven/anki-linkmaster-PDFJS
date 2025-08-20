"""
使用真实PDF文件地址的深度诊断测试
"""

import os
import sys
import logging

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pdf_manager.manager import PDFManager
from pdf_manager.utils import FileValidator

# 设置详细日志
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 用户提供的真实文件路径
REAL_PDF_PATH = r"C:\Users\napretep\Desktop\test.pdf"

def diagnose_real_pdf():
    """诊断真实PDF文件"""
    
    print("=" * 70)
    print("🔍 真实PDF文件深度诊断")
    print("=" * 70)
    print(f"目标文件: {REAL_PDF_PATH}")
    
    # 1. 文件存在性检查
    print("\n1️⃣ 文件存在性检查")
    exists = os.path.exists(REAL_PDF_PATH)
    print(f"   文件存在: {exists}")
    
    if not exists:
        print("   ❌ 文件不存在，请确认路径正确")
        return False
    
    # 2. 文件基本信息
    print("\n2️⃣ 文件基本信息")
    try:
        file_stat = os.stat(REAL_PDF_PATH)
        print(f"   文件大小: {file_stat.st_size} bytes")
        print(f"   创建时间: {file_stat.st_ctime}")
        print(f"   修改时间: {file_stat.st_mtime}")
    except Exception as e:
        print(f"   ❌ 获取文件信息失败: {e}")
    
    # 3. 文件权限检查
    print("\n3️⃣ 文件权限检查")
    can_read, read_error = FileValidator.can_access_file(REAL_PDF_PATH)
    print(f"   文件可读: {can_read}")
    if not can_read:
        print(f"   ❌ 读取错误: {read_error}")
    
    can_write, write_error = FileValidator.validate_file_operation(REAL_PDF_PATH, "write")
    print(f"   文件可写: {can_write}")
    if not can_write:
        print(f"   ❌ 写入错误: {write_error}")
    
    # 4. PDF格式验证
    print("\n4️⃣ PDF格式验证")
    is_pdf = FileValidator.is_pdf_file(REAL_PDF_PATH)
    print(f"   是PDF文件: {is_pdf}")
    
    # 增强的PDF验证
    try:
        with open(REAL_PDF_PATH, 'rb') as f:
            header = f.read(10)
            print(f"   文件头: {header}")
            is_valid_pdf = header.startswith(b'%PDF-')
            print(f"   PDF格式正确: {is_valid_pdf}")
    except Exception as e:
        print(f"   ❌ 读取文件头失败: {e}")
        is_valid_pdf = False
    
    # 5. 尝试通过PDF管理器添加
    print("\n5️⃣ PDF管理器添加测试")
    try:
        manager = PDFManager()
        print(f"   管理器初始化完成，当前文件数: {len(manager.get_files())}")
        
        # 检查是否已存在
        from pdf_manager.models import PDFFile
        file_id = PDFFile.generate_file_id(REAL_PDF_PATH)
        exists = manager.file_list.exists(file_id)
        print(f"   文件已在列表中: {exists}")
        
        if not exists:
            print("   🔄 开始添加文件...")
            result = manager.add_file(REAL_PDF_PATH)
            print(f"   添加结果: {result}")
            
            if result:
                files = manager.get_files()
                print(f"   ✅ 添加成功！当前文件数: {len(files)}")
                if files:
                    latest = files[-1]
                    print(f"   📄 最新文件信息:")
                    print(f"      文件名: {latest['filename']}")
                    print(f"      路径: {latest['filepath']}")
                    print(f"      大小: {latest['file_size']} bytes")
                    print(f"      ID: {latest['id']}")
            else:
                print("   ❌ 添加失败")
        else:
            print("   ⏭️ 文件已存在，跳过添加")
            
    except Exception as e:
        print(f"   ❌ 添加过程异常: {e}")
        logger.exception("PDF添加过程异常")
        return False
    
    return True

def test_application_layer():
    """测试应用层处理"""
    
    print("\n" + "=" * 70)
    print("🏗️ 应用层模拟测试")
    print("=" * 70)
    
    # 模拟application.py的处理流程
    try:
        import tempfile
        
        # 模拟前端发送的文件信息
        mock_file_info = {
            'name': os.path.basename(REAL_PDF_PATH),
            'size': os.path.getsize(REAL_PDF_PATH) if os.path.exists(REAL_PDF_PATH) else 0
        }
        
        print(f"模拟文件信息: {mock_file_info}")
        
        # 检查文件是否真实存在
        if os.path.exists(REAL_PDF_PATH):
            print("✅ 真实文件存在，可以直接处理")
            
            # 测试直接处理
            manager = PDFManager()
            result = manager.add_file(REAL_PDF_PATH)
            print(f"直接处理结果: {result}")
            
        else:
            print("❌ 真实文件不存在，将使用模拟流程")
            
            # 模拟application.py的临时文件创建
            temp_dir = tempfile.gettempdir()
            temp_path = os.path.join(temp_dir, "test.pdf")
            
            # 创建模拟PDF内容
            if os.path.exists(REAL_PDF_PATH):
                # 如果真实文件存在，复制内容
                with open(REAL_PDF_PATH, 'rb') as src:
                    content = src.read()
            else:
                # 创建基础PDF内容
                content = b'''%PDF-1.4
%\xe2\xe3\xcf\xd3
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
trailer
<<
/Root 1 0 R
>>
%%EOF'''
            
            with open(temp_path, 'wb') as f:
                f.write(content)
            
            print(f"创建临时文件: {temp_path}")
            
            # 测试添加临时文件
            manager = PDFManager()
            result = manager.add_file(temp_path)
            print(f"临时文件处理结果: {result}")
            
            # 清理
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        print(f"应用层测试异常: {e}")
        logger.exception("应用层测试异常")

if __name__ == "__main__":
    print("🚀 开始真实PDF文件诊断...")
    
    success = diagnose_real_pdf()
    test_application_layer()
    
    print("\n" + "=" * 70)
    if success:
        print("✅ 真实PDF文件诊断完成")
        if os.path.exists(REAL_PDF_PATH):
            print("📄 真实文件存在且可处理")
        else:
            print("❌ 真实文件不存在")
    else:
        print("❌ 诊断发现问题")
    print("=" * 70)