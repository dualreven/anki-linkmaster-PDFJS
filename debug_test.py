#!/usr/bin/env python3
"""
调试测试：检查PDF管理器状态
"""

import sys
import os
from pathlib import Path

# 添加项目路径
sys.path.insert(0, 'src/backend')

from pdf_manager.manager import PDFManager

def debug_pdf_manager():
    print("=== PDF管理器调试测试 ===")
    
    # 初始化管理器
    manager = PDFManager()
    
    # 获取当前文件列表
    files = manager.get_files()
    print(f"当前文件数量: {len(files)}")
    
    for i, file_info in enumerate(files):
        print(f"文件 {i+1}:")
        print(f"  文件名: {file_info.get('filename')}")
        print(f"  路径: {file_info.get('filepath')}")
        print(f"  大小: {file_info.get('file_size')} bytes")
        print(f"  ID: {file_info.get('id')}")
        print()
    
    # 测试真实文件
    test_path = r"C:\Users\napretep\Desktop\test.pdf"
    print(f"测试文件路径: {test_path}")
    print(f"文件存在: {os.path.exists(test_path)}")
    
    if os.path.exists(test_path):
        print(f"文件大小: {os.path.getsize(test_path)} bytes")
        
        # 尝试直接添加
        print("尝试直接添加文件...")
        result = manager.add_file(test_path)
        print(f"添加结果: {result}")
        
        # 再次检查文件列表
        new_files = manager.get_files()
        print(f"新文件数量: {len(new_files)}")
        
        if len(new_files) > len(files):
            print("✅ 文件添加成功")
        else:
            print("❌ 文件添加失败（可能已存在或格式问题）")

if __name__ == "__main__":
    debug_pdf_manager()