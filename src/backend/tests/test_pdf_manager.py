"""
PDF管理器测试套件
"""

import os
import tempfile
import shutil
import pytest
from unittest.mock import patch, MagicMock

from pdf_manager.manager import PDFManager
from pdf_manager.models import PDFFile, PDFFileList


class TestPDFManager:
    """PDF管理器测试类"""
    
    @pytest.fixture
    def temp_dir(self):
        """临时目录fixture"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
        
    @pytest.fixture
    def pdf_manager(self, temp_dir):
        """PDF管理器fixture"""
        return PDFManager(data_dir=os.path.join(temp_dir, "data"))
        
    @pytest.fixture
    def test_pdf(self, temp_dir):
        """测试PDF文件fixture"""
        pdf_path = os.path.join(temp_dir, "test.pdf")
        with open(pdf_path, "w") as f:
            f.write("%PDF-1.4 test content")
        return pdf_path
        
    def test_initialization(self, pdf_manager):
        """测试初始化"""
        assert pdf_manager.data_dir.endswith("data")
        assert pdf_manager.get_file_count() == 0
        
    def test_add_valid_pdf(self, pdf_manager, test_pdf):
        """测试添加有效PDF文件"""
        result = pdf_manager.add_file(test_pdf)
        assert result is True
        assert pdf_manager.get_file_count() == 1
        
    def test_add_nonexistent_file(self, pdf_manager):
        """测试添加不存在的文件"""
        result = pdf_manager.add_file("/nonexistent/file.pdf")
        assert result is False
        assert pdf_manager.get_file_count() == 0
        
    def test_add_non_pdf_file(self, pdf_manager, temp_dir):
        """测试添加非PDF文件"""
        txt_file = os.path.join(temp_dir, "test.txt")
        with open(txt_file, "w") as f:
            f.write("not a pdf")
            
        result = pdf_manager.add_file(txt_file)
        assert result is False
        assert pdf_manager.get_file_count() == 0
        
    def test_add_duplicate_file(self, pdf_manager, test_pdf):
        """测试添加重复文件"""
        pdf_manager.add_file(test_pdf)
        result = pdf_manager.add_file(test_pdf)
        assert result is False
        assert pdf_manager.get_file_count() == 1
        
    def test_remove_existing_file(self, pdf_manager, test_pdf):
        """测试移除存在的文件"""
        pdf_manager.add_file(test_pdf)
        file_id = pdf_manager.get_file_ids()[0]
        
        result = pdf_manager.remove_file(file_id)
        assert result is True
        assert pdf_manager.get_file_count() == 0
        
    def test_remove_nonexistent_file(self, pdf_manager):
        """测试移除不存在的文件"""
        result = pdf_manager.remove_file("nonexistent_id")
        assert result is False
        
    def test_get_files(self, pdf_manager, test_pdf):
        """测试获取文件列表"""
        pdf_manager.add_file(test_pdf)
        files = pdf_manager.get_files()
        
        assert len(files) == 1
        assert files[0]["filename"] == "test.pdf"
        assert "id" in files[0]
        assert "filepath" in files[0]
        
    def test_get_file_by_id(self, pdf_manager, test_pdf):
        """测试根据ID获取文件"""
        pdf_manager.add_file(test_pdf)
        file_id = pdf_manager.get_file_ids()[0]
        
        file_info = pdf_manager.get_file_by_id(file_id)
        assert file_info is not None
        assert file_info["filename"] == "test.pdf"
        
    def test_get_nonexistent_file_by_id(self, pdf_manager):
        """测试获取不存在的文件"""
        file_info = pdf_manager.get_file_by_id("nonexistent_id")
        assert file_info is None
        
    def test_get_file_detail(self, pdf_manager, test_pdf):
        """测试获取文件详细信息"""
        pdf_manager.add_file(test_pdf)
        file_id = pdf_manager.get_file_ids()[0]
        
        detail = pdf_manager.get_file_detail(file_id)
        assert detail is not None
        assert detail["filename"] == "test.pdf"
        assert "title" in detail
        assert "author" in detail
        assert "exists" in detail
        
    def test_save_and_load_files(self, temp_dir):
        """测试保存和加载文件列表"""
        # 创建第一个管理器并添加文件
        manager1 = PDFManager(data_dir=os.path.join(temp_dir, "data"))
        test_pdf = os.path.join(temp_dir, "test.pdf")
        with open(test_pdf, "w") as f:
            f.write("%PDF-1.4 test")
            
        manager1.add_file(test_pdf)
        
        # 创建第二个管理器，应该能加载相同的数据
        manager2 = PDFManager(data_dir=os.path.join(temp_dir, "data"))
        assert manager2.get_file_count() == 1
        
    def test_clear_all(self, pdf_manager, test_pdf):
        """测试清空所有文件"""
        pdf_manager.add_file(test_pdf)
        assert pdf_manager.get_file_count() == 1
        
        result = pdf_manager.clear_all()
        assert result is True
        assert pdf_manager.get_file_count() == 0
        
    def test_search_files(self, pdf_manager, temp_dir):
        """测试文件搜索"""
        # 创建多个测试文件
        pdf1 = os.path.join(temp_dir, "python_tutorial.pdf")
        pdf2 = os.path.join(temp_dir, "javascript_guide.pdf")
        
        for pdf_path in [pdf1, pdf2]:
            with open(pdf_path, "w") as f:
                f.write("%PDF-1.4 test")
                
        pdf_manager.add_file(pdf1)
        pdf_manager.add_file(pdf2)
        
        # 测试搜索
        results = pdf_manager.search_files("python")
        assert len(results) == 1
        assert "python" in results[0]["filename"].lower()
        
        results = pdf_manager.search_files("guide")
        assert len(results) == 1
        assert "guide" in results[0]["filename"].lower()
        
    def test_refresh_file_list(self, pdf_manager, test_pdf):
        """测试刷新文件列表"""
        pdf_manager.add_file(test_pdf)
        assert pdf_manager.get_file_count() == 1
        
        # 删除物理文件
        os.remove(test_pdf)
        
        # 刷新应该移除不存在的文件
        removed_count = pdf_manager.refresh_file_list()
        assert removed_count == 1
        assert pdf_manager.get_file_count() == 0
        
    def test_add_files_from_directory(self, pdf_manager, temp_dir):
        """测试从目录批量添加文件"""
        # 创建测试目录结构
        sub_dir = os.path.join(temp_dir, "pdfs")
        os.makedirs(sub_dir)
        
        # 创建多个PDF文件
        for name in ["doc1.pdf", "doc2.pdf", "readme.txt"]:
            path = os.path.join(sub_dir, name)
            with open(path, "w") as f:
                f.write("%PDF-1.4" if name.endswith(".pdf") else "text")
                
        # 批量添加
        added_count = pdf_manager.add_files_from_directory(sub_dir)
        assert added_count == 2  # 只添加PDF文件
        assert pdf_manager.get_file_count() == 2
        
    def test_signal_emission(self, pdf_manager, test_pdf):
        """测试信号发射"""
        signals_received = []
        
        def on_file_added(file_info):
            signals_received.append(('file_added', file_info))
            
        def on_file_removed(file_id):
            signals_received.append(('file_removed', file_id))
            
        def on_file_list_changed():
            signals_received.append(('file_list_changed', None))
            
        # 连接信号
        pdf_manager.file_added.connect(on_file_added)
        pdf_manager.file_removed.connect(on_file_removed)
        pdf_manager.file_list_changed.connect(on_file_list_changed)
        
        # 添加文件
        pdf_manager.add_file(test_pdf)
        assert len(signals_received) >= 2  # file_added + file_list_changed
        
        # 移除文件
        file_id = pdf_manager.get_file_ids()[0]
        pdf_manager.remove_file(file_id)
        assert len(signals_received) >= 4  # 更多信号
        
    def test_error_handling(self, pdf_manager):
        """测试错误处理"""
        errors_received = []
        
        def on_error(error_msg):
            errors_received.append(error_msg)
            
        pdf_manager.error_occurred.connect(on_error)
        
        # 触发错误
        pdf_manager.add_file("/nonexistent/file.pdf")
        assert len(errors_received) > 0


class TestPDFFile:
    """PDFFile数据类测试"""
    
    @pytest.fixture
    def temp_dir(self):
        """临时目录fixture"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)
        
    def test_initialization(self):
        """测试初始化"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        assert pdf_file.id == "test_id"
        assert pdf_file.filename == "test.pdf"
        assert pdf_file.file_size == 1024
        
    def test_generate_file_id(self):
        """测试文件ID生成"""
        filepath = "/path/to/test.pdf"
        file_id1 = PDFFile.generate_file_id(filepath)
        file_id2 = PDFFile.generate_file_id(filepath)
        
        assert file_id1 == file_id2  # 相同路径应该生成相同ID
        assert len(file_id1) > 0
        
    def test_from_file_path(self, temp_dir):
        """测试从文件路径创建"""
        pdf_path = os.path.join(temp_dir, "test.pdf")
        with open(pdf_path, "w") as f:
            f.write("%PDF-1.4 test")
            
        pdf_file = PDFFile.from_file_path(pdf_path, "test_id")
        
        assert pdf_file.filename == "test.pdf"
        assert pdf_file.filepath == pdf_path
        assert pdf_file.file_size > 0
        assert pdf_file.id == "test_id"
        
    def test_file_exists_check(self, temp_dir):
        """测试文件存在性检查"""
        pdf_path = os.path.join(temp_dir, "test.pdf")
        with open(pdf_path, "w") as f:
            f.write("%PDF-1.4 test")
            
        pdf_file = PDFFile.from_file_path(pdf_path, "test_id")
        assert pdf_file.is_file_exists() is True
        
        # 删除文件
        os.remove(pdf_path)
        assert pdf_file.is_file_exists() is False
        
    def test_get_file_info(self):
        """测试获取文件信息"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        info = pdf_file.get_file_info()
        assert info["id"] == "test_id"
        assert info["filename"] == "test.pdf"
        assert "created_time" in info
        assert "modified_time" in info
        
    def test_get_metadata(self):
        """测试获取元数据"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        metadata = pdf_file.get_metadata()
        assert "title" in metadata
        assert "author" in metadata
        assert "subject" in metadata
        
    def test_update_metadata(self):
        """测试更新元数据"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        new_metadata = {
            "title": "New Title",
            "author": "Author Name",
            "subject": "Test Subject"
        }
        
        pdf_file.update_metadata(new_metadata)
        assert pdf_file.title == "New Title"
        assert pdf_file.author == "Author Name"


class TestPDFFileList:
    """PDF文件列表测试类"""
    
    @pytest.fixture
    def pdf_file_list(self):
        """PDF文件列表fixture"""
        from pdf_manager.models import PDFFileList
        return PDFFileList()
        
    def test_add_file(self, pdf_file_list):
        """测试添加文件"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        result = pdf_file_list.add_file(pdf_file)
        assert result is True
        assert pdf_file_list.count() == 1
        
    def test_add_duplicate_file(self, pdf_file_list):
        """测试添加重复文件"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        pdf_file_list.add_file(pdf_file)
        result = pdf_file_list.add_file(pdf_file)
        assert result is False
        assert pdf_file_list.count() == 1
        
    def test_remove_file(self, pdf_file_list):
        """测试移除文件"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        pdf_file_list.add_file(pdf_file)
        result = pdf_file_list.remove_file("test_id")
        assert result is True
        assert pdf_file_list.count() == 0
        
    def test_remove_nonexistent_file(self, pdf_file_list):
        """测试移除不存在的文件"""
        result = pdf_file_list.remove_file("nonexistent")
        assert result is False
        
    def test_exists(self, pdf_file_list):
        """测试文件存在检查"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        pdf_file_list.add_file(pdf_file)
        assert pdf_file_list.exists("test_id") is True
        assert pdf_file_list.exists("nonexistent") is False
        
    def test_clear(self, pdf_file_list):
        """测试清空列表"""
        for i in range(3):
            pdf_file = PDFFile(
                id=f"test_id_{i}",
                filename=f"test_{i}.pdf",
                filepath=f"/path/to/test_{i}.pdf",
                file_size=1024,
                created_time=1640995200.0,
                modified_time=1640995200.0
            )
            pdf_file_list.add_file(pdf_file)
            
        assert pdf_file_list.count() == 3
        pdf_file_list.clear()
        assert pdf_file_list.count() == 0
        
    def test_get_files_info(self, pdf_file_list):
        """测试获取文件信息列表"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        pdf_file_list.add_file(pdf_file)
        files_info = pdf_file_list.get_files_info()
        
        assert len(files_info) == 1
        assert files_info[0]["id"] == "test_id"
        assert files_info[0]["filename"] == "test.pdf"
        
    def test_to_dict_from_dict(self, pdf_file_list):
        """测试序列化和反序列化"""
        pdf_file = PDFFile(
            id="test_id",
            filename="test.pdf",
            filepath="/path/to/test.pdf",
            file_size=1024,
            created_time=1640995200.0,
            modified_time=1640995200.0
        )
        
        pdf_file_list.add_file(pdf_file)
        
        # 序列化
        data = pdf_file_list.to_dict()
        assert len(data["files"]) == 1
        
        # 反序列化
        new_list = PDFFileList.from_dict(data)
        assert new_list.count() == 1
        assert new_list.get_file("test_id").filename == "test.pdf"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])