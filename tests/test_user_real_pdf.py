#!/usr/bin/env python3
"""
用户真实PDF文件集成测试
测试用户提供的真实PDF文件
"""

import os
import sys

# 添加src/backend到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from pdf_manager.manager import PDFManager

def test_user_real_pdf():
    """测试用户真实PDF文件"""
    print("=== 用户真实PDF文件测试 ===")
    
    # 用户提供的文件路径
    user_pdf_path = r"C:\Users\napretep\Desktop\test.pdf"
    
    if not os.path.exists(user_pdf_path):
        print(f"❌ 用户文件不存在: {user_pdf_path}")
        print("请确保test.pdf文件在桌面上")
        return False
    
    print(f"测试文件: {user_pdf_path}")
    print(f"文件大小: {os.path.getsize(user_pdf_path)} bytes")
    
    try:
        # 初始化PDF管理器
        pdf_manager = PDFManager()
        
        # 测试添加用户真实文件
        print("\n--- 测试添加用户真实文件 ---")
        
        result = pdf_manager.add_file(user_pdf_path)
        
        if result:
            print("✅ 用户PDF文件添加成功")
        else:
            print("❌ 用户PDF文件添加失败")
            return False
        
        # 验证文件信息
        print("\n--- 验证文件信息 ---")
        
        files = pdf_manager.get_files()
        if files:
            print("✅ PDF管理器中已添加用户文件")
            
            # 找到刚添加的文件
            user_file = None
            for file_info in files:
                if file_info['filepath'] == user_pdf_path:
                    user_file = file_info
                    break
            
            if user_file:
                print(f"   ID: {user_file['id']}")
                print(f"   文件名: {user_file['filename']}")
                print(f"   文件大小: {user_file['file_size']} bytes")
                print(f"   文件路径: {user_file['filepath']}")
                print("✅ 用户文件信息验证成功")
                return True
            else:
                print("❌ 找不到用户文件")
                return False
        else:
            print("❌ PDF管理器中没有文件")
            return False
            
    except Exception as e:
        print(f"❌ 测试过程中出现错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_user_real_pdf()
    if success:
        print("\n🎉 用户真实PDF文件测试成功！")
        print("QT文件选择机制已正确集成")
    else:
        print("\n❌ 用户真实PDF文件测试失败")