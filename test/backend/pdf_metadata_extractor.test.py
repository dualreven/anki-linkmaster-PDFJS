"""
PDF元数据提取器测试
测试PDFMetadataExtractor类的功能，包括元数据提取和页数获取
"""

import pytest
import os
import sys
from unittest.mock import Mock, patch, MagicMock

# 添加src目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src'))

from backend.pdf_manager.utils import PDFMetadataExtractor


class TestPDFMetadataExtractor:
    """PDFMetadataExtractor测试类"""
    
    @pytest.fixture
    def sample_pdf_path(self):
        """提供测试PDF文件路径"""
        # 使用项目中的测试PDF文件
        return "data/pdfs/7d688289f74a.pdf"
    
    @pytest.fixture
    def non_existent_pdf_path(self):
        """提供不存在的PDF文件路径"""
        return "non_existent.pdf"
    
    @pytest.fixture
    def invalid_pdf_path(self):
        """提供无效的PDF文件路径"""
        return "test_files/invalid.pdf"
    
    def test_extract_metadata_success(self, sample_pdf_path):
        """测试成功提取PDF元数据"""
        # 确保测试文件存在
        if not os.path.exists(sample_pdf_path):
            pytest.skip(f"测试文件不存在: {sample_pdf_path}")
        
        # 提取元数据
        metadata = PDFMetadataExtractor.extract_metadata(sample_pdf_path)
        
        # 验证基本元数据字段存在
        assert "error" not in metadata
        assert "page_count" in metadata
        assert isinstance(metadata["page_count"], int)
        assert metadata["page_count"] > 0  # 应该有正数页数
        
        # 验证其他元数据字段
        for field in ["title", "author", "subject", "keywords", "creator", "producer"]:
            assert field in metadata
            assert isinstance(metadata[field], str)
        
        # 验证日期字段
        assert "creation_date" in metadata
        assert "modification_date" in metadata
    
    def test_extract_metadata_file_not_found(self, non_existent_pdf_path):
        """测试处理不存在的PDF文件"""
        metadata = PDFMetadataExtractor.extract_metadata(non_existent_pdf_path)
        
        # 验证返回错误信息
        assert "error" in metadata
        assert "文件不存在" in metadata["error"]
    
    def test_get_page_count_success(self, sample_pdf_path):
        """测试成功获取PDF页数"""
        # 确保测试文件存在
        if not os.path.exists(sample_pdf_path):
            pytest.skip(f"测试文件不存在: {sample_pdf_path}")
        
        # 获取页数
        page_count = PDFMetadataExtractor.get_page_count(sample_pdf_path)
        
        # 验证页数为正数
        assert isinstance(page_count, int)
        assert page_count > 0
    
    def test_get_page_count_file_not_found(self, non_existent_pdf_path):
        """测试获取不存在的PDF文件的页数"""
        page_count = PDFMetadataExtractor.get_page_count(non_existent_pdf_path)
        
        # 验证返回0（错误情况）
        assert page_count == 0
    
    def test_extract_metadata_with_mock_pdf_reader(self):
        """使用模拟的PdfReader测试元数据提取"""
        # 创建模拟的PDF阅读器
        mock_reader = Mock()
        mock_reader.metadata = {
            "/Title": "Test Document",
            "/Author": "Test Author",
            "/Subject": "Test Subject",
            "/Keywords": "test, document",
            "/Creator": "Test Creator",
            "/Producer": "Test Producer",
            "/CreationDate": "D:20230101120000",
            "/ModDate": "D:20230102120000"
        }
        mock_reader.pages = [Mock(), Mock(), Mock()]  # 3页
        
        with patch('backend.pdf_manager.utils.PdfReader', return_value=mock_reader):
            # 提取元数据
            metadata = PDFMetadataExtractor.extract_metadata("test.pdf")
            
            # 验证元数据提取正确
            assert metadata["title"] == "Test Document"
            assert metadata["author"] == "Test Author"
            assert metadata["subject"] == "Test Subject"
            assert metadata["keywords"] == "test, document"
            assert metadata["creator"] == "Test Creator"
            assert metadata["producer"] == "Test Producer"
            assert metadata["creation_date"] == "D:20230101120000"
            assert metadata["modification_date"] == "D:20230102120000"
            assert metadata["page_count"] == 3
    
    def test_extract_metadata_empty_metadata(self):
        """测试处理空元数据的情况"""
        # 创建模拟的PDF阅读器（空元数据）
        mock_reader = Mock()
        mock_reader.metadata = {}
        mock_reader.pages = [Mock()]  # 1页
        
        with patch('backend.pdf_manager.utils.PdfReader', return_value=mock_reader):
            # 提取元数据
            metadata = PDFMetadataExtractor.extract_metadata("test.pdf")
            
            # 验证默认值
            assert metadata["title"] == ""
            assert metadata["author"] == ""
            assert metadata["subject"] == ""
            assert metadata["keywords"] == ""
            assert metadata["creator"] == ""
            assert metadata["producer"] == ""
            assert metadata["creation_date"] is None
            assert metadata["modification_date"] is None
            assert metadata["page_count"] == 1
    
    def test_extract_metadata_with_slash_prefix(self):
        """测试处理带斜杠前缀的元数据"""
        # 创建模拟的PDF阅读器（带斜杠前缀的元数据）
        mock_reader = Mock()
        mock_reader.metadata = {
            "/Title": "/Test Document",  # 带斜杠前缀
            "/Author": "/Test Author",
            "/Subject": "/Test Subject",
            "/Keywords": "/test, document",
            "/Creator": "/Test Creator",
            "/Producer": "/Test Producer"
        }
        mock_reader.pages = [Mock()]
        
        with patch('backend.pdf_manager.utils.PdfReader', return_value=mock_reader):
            # 提取元数据
            metadata = PDFMetadataExtractor.extract_metadata("test.pdf")
            
            # 验证斜杠前缀被正确移除
            assert metadata["title"] == "Test Document"
            assert metadata["author"] == "Test Author"
            assert metadata["subject"] == "Test Subject"
            assert metadata["keywords"] == "test, document"
            assert metadata["creator"] == "Test Creator"
            assert metadata["producer"] == "Test Producer"
    
    def test_get_page_count_with_mock(self):
        """使用模拟测试获取页数"""
        # 创建模拟的PDF阅读器
        mock_reader = Mock()
        mock_reader.pages = [Mock(), Mock(), Mock(), Mock()]  # 4页
        
        with patch('backend.pdf_manager.utils.PdfReader', return_value=mock_reader):
            # 获取页数
            page_count = PDFMetadataExtractor.get_page_count("test.pdf")
            
            # 验证页数正确
            assert page_count == 4
    
    def test_get_page_count_exception_handling(self):
        """测试异常处理"""
        # 模拟PdfReader抛出异常
        with patch('backend.pdf_manager.utils.PdfReader', side_effect=Exception("Test error")):
            # 获取页数
            page_count = PDFMetadataExtractor.get_page_count("test.pdf")
            
            # 验证异常时返回0
            assert page_count == 0
    
    def test_extract_metadata_exception_handling(self):
        """测试元数据提取的异常处理"""
        # 模拟PdfReader抛出异常
        with patch('backend.pdf_manager.utils.PdfReader', side_effect=Exception("Test error")):
            # 提取元数据
            metadata = PDFMetadataExtractor.extract_metadata("test.pdf")
            
            # 验证返回错误信息
            assert "error" in metadata
            assert "Test error" in metadata["error"]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])