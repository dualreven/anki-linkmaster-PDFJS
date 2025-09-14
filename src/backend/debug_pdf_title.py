#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from pdf_manager.manager import PDFManager
from pdf_manager.utils import PDFMetadataExtractor

def debug_pdf_title_extraction():
    """调试PDF标题提取过程"""
    
    # 测试文件路径
    test_file = r"C:\Users\napretep\Downloads\基于深度特征的立定跳远子动作定位方法研究_花延卓.pdf"
    
    print(f"测试文件: {test_file}")
    print(f"文件存在: {os.path.exists(test_file)}")
    
    if not os.path.exists(test_file):
        print("测试文件不存在，跳过调试")
        return
    
    print("\n=== 步骤1: PDFMetadataExtractor.extract_metadata() ===")
    metadata = PDFMetadataExtractor.extract_metadata(test_file)
    print(f"原始元数据: {metadata}")
    
    print("\n=== 步骤2: 文件名提取 ===")
    filename_title = os.path.splitext(os.path.basename(test_file))[0]
    print(f"文件名标题: {repr(filename_title)}")
    print(f"文件名标题类型: {type(filename_title)}")
    print(f"文件名标题长度: {len(filename_title)}")
    
    print("\n=== 步骤3: manager._extract_metadata() ===")
    manager = PDFManager(data_dir="debug_data")
    manager_metadata = manager._extract_metadata(test_file)
    print(f"Manager提取的元数据: {manager_metadata}")
    
    print("\n=== 步骤4: 完整文件添加流程 ===")
    success = manager.add_file(test_file)
    print(f"文件添加结果: {success}")
    
    if success:
        files = manager.get_files()
        print(f"文件列表: {files}")
        
        if files:
            file_detail = manager.get_file_detail(files[0]['id'])
            print(f"文件详情: {file_detail}")
            
            # 检查前端可能使用的字段
            print(f"\n前端相关字段:")
            print(f"title: {repr(file_detail.get('title', 'N/A'))}")
            print(f"filename: {repr(file_detail.get('filename', 'N/A'))}")
            print(f"id: {repr(file_detail.get('id', 'N/A'))}")
    
    print("\n=== 编码检查 ===")
    # 检查字符串编码
    test_str = "基于深度特征的立定跳远子动作定位方法研究_花延卓"
    print(f"测试字符串: {repr(test_str)}")
    print(f"测试字符串类型: {type(test_str)}")
    print(f"测试字符串长度: {len(test_str)}")
    print(f"测试字符串可打印: {test_str.isprintable()}")
    
    # 尝试不同编码
    try:
        utf8_bytes = test_str.encode('utf-8')
        print(f"UTF-8字节: {utf8_bytes}")
        print(f"UTF-8解码: {utf8_bytes.decode('utf-8')}")
    except Exception as e:
        print(f"UTF-8编码错误: {e}")

if __name__ == "__main__":
    debug_pdf_title_extraction()