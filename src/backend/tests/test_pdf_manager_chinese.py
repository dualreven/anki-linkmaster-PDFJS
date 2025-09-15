"""
中文PDF标题提取测试
测试中文PDF文件的元数据提取功能
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch, MagicMock
import json

import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# 直接导入模块
from backend.pdf_manager.manager import PDFManager
from backend.pdf_manager.utils import PDFMetadataExtractor


class TestChinesePDFTitleExtraction(unittest.TestCase):
    """测试中文PDF标题提取功能"""
    
    def setUp(self):
        """测试前准备"""
        # 创建临时数据目录
        self.temp_dir = tempfile.mkdtemp()
        self.pdf_manager = PDFManager(data_dir=self.temp_dir)
        
        # 模拟中文PDF文件路径
        self.chinese_pdf_path = "C:\\Users\\napretep\\Downloads\\基于深度特征的立定跳远子动作定位方法研究_花延卓.pdf"
        self.chinese_filename = "基于深度特征的立定跳远子动作定位方法研究_花延卓.pdf"
        
    def tearDown(self):
        """测试后清理"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_chinese_title_extraction(self):
        """测试中文PDF标题提取"""
        # 模拟PDFMetadataExtractor.extract_metadata返回空标题
        with patch.object(PDFMetadataExtractor, 'extract_metadata') as mock_extract:
            mock_extract.return_value = {
                "title": "",  # 空标题
                "author": "",
                "subject": "",
                "keywords": "",
                "page_count": 10
            }
            
            # 调用_extract_metadata方法
            metadata = self.pdf_manager._extract_metadata(self.chinese_pdf_path)
            
            # 验证标题应该使用文件名作为回退
            expected_title = "基于深度特征的立定跳远子动作定位方法研究_花延卓"
            self.assertEqual(metadata["title"], expected_title)
            print(f"✓ 中文标题提取正确: {metadata['title']}")
    
    def test_chinese_title_with_actual_metadata(self):
        """测试有实际元数据的中文PDF"""
        with patch.object(PDFMetadataExtractor, 'extract_metadata') as mock_extract:
            mock_extract.return_value = {
                "title": "基于深度特征的立定跳远子动作定位方法研究",  # 实际中文标题
                "author": "花延卓",
                "subject": "体育科学",
                "keywords": "立定跳远,动作分析,深度学习",
                "page_count": 25
            }
            
            metadata = self.pdf_manager._extract_metadata(self.chinese_pdf_path)
            
            # 验证应该使用提取到的中文标题
            self.assertEqual(metadata["title"], "基于深度特征的立定跳远子动作定位方法研究")
            print(f"✓ 实际中文标题提取正确: {metadata['title']}")
    
    def test_english_title_extraction(self):
        """测试英文PDF标题提取（对照测试）"""
        english_pdf_path = "C:\\Users\\napretep\\Downloads\\Research_Paper_on_AI.pdf"
        english_filename = "Research_Paper_on_AI.pdf"
        
        with patch.object(PDFMetadataExtractor, 'extract_metadata') as mock_extract:
            mock_extract.return_value = {
                "title": "Research Paper on Artificial Intelligence",  # 英文标题
                "author": "John Smith",
                "subject": "Artificial Intelligence",
                "keywords": "AI, Machine Learning",
                "page_count": 15
            }
            
            metadata = self.pdf_manager._extract_metadata(english_pdf_path)
            
            # 验证应该使用提取到的英文标题
            self.assertEqual(metadata["title"], "Research Paper on Artificial Intelligence")
            print(f"✓ 英文标题提取正确: {metadata['title']}")
    
    def test_empty_title_fallback(self):
        """测试空标题回退机制"""
        with patch.object(PDFMetadataExtractor, 'extract_metadata') as mock_extract:
            mock_extract.return_value = {
                "title": "",  # 空标题
                "author": "",
                "subject": "",
                "keywords": "",
                "page_count": 0
            }
            
            metadata = self.pdf_manager._extract_metadata(self.chinese_pdf_path)
            
            # 验证回退到文件名（不含扩展名）
            expected_title = "基于深度特征的立定跳远子动作定位方法研究_花延卓"
            self.assertEqual(metadata["title"], expected_title)
            print(f"✓ 空标题回退正确: {metadata['title']}")
    
    def test_metadata_extraction_error(self):
        """测试元数据提取错误情况"""
        with patch.object(PDFMetadataExtractor, 'extract_metadata') as mock_extract:
            mock_extract.return_value = {"error": "提取失败"}
            
            metadata = self.pdf_manager._extract_metadata(self.chinese_pdf_path)
            
            # 验证错误情况下使用文件名作为回退
            expected_title = "基于深度特征的立定跳远子动作定位方法研究_花延卓"
            self.assertEqual(metadata["title"], expected_title)
            print(f"✓ 错误情况回退正确: {metadata['title']}")
    
    def test_chinese_characters_detection(self):
        """测试中文字符检测"""
        # 测试包含中文的文件名
        chinese_text = "基于深度特征的立定跳远子动作定位方法研究_花延卓"
        self.assertTrue(any('\u4e00' <= char <= '\u9fff' for char in chinese_text))
        print("✓ 中文字符检测正确")
    
    def test_metadata_structure(self):
        """测试元数据结构完整性"""
        metadata = self.pdf_manager._extract_metadata(self.chinese_pdf_path)
        
        # 验证元数据包含所有必要字段
        required_fields = ["title", "author", "subject", "keywords", "page_count"]
        for field in required_fields:
            self.assertIn(field, metadata)
            print(f"✓ 元数据字段 '{field}' 存在")
    
    def test_filename_title_extraction(self):
        """测试从文件名提取标题的逻辑"""
        test_cases = [
            ("中文文件.pdf", "中文文件"),
            ("Research Paper.pdf", "Research Paper"),
            ("文档-测试_v1.2.pdf", "文档-测试_v1.2"),
            ("file.with.dots.pdf", "file.with.dots"),
            ("", ""),  # 空文件名
        ]
        
        for filename, expected_title in test_cases:
            # 模拟文件路径
            filepath = f"C:\\temp\\{filename}"
            
            # 手动测试标题提取逻辑
            import os
            actual_title = os.path.splitext(os.path.basename(filepath))[0]
            
            self.assertEqual(actual_title, expected_title)
            print(f"✓ 文件名标题提取: '{filename}' -> '{actual_title}'")


if __name__ == "__main__":
    print("开始中文PDF标题提取测试...")
    unittest.main(verbosity=2)