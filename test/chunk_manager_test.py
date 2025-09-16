
"""
分片管理器测试用例
测试1MB分片逻辑的正确性
"""

import os
import tempfile
import unittest
from pathlib import Path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.pdf_manager.chunk_manager import ChunkManager, FileChunk, ChunkStatus


class TestChunkManager(unittest.TestCase):
    """分片管理器测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.chunk_manager = ChunkManager()
        self.test_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        """测试后清理"""
        # 清理临时文件
        for file in Path(self.test_dir).glob("*"):
            if file.is_file():
                file.unlink()
        Path(self.test_dir).rmdir()
        
    def create_test_file(self, size_bytes: int, filename: str = "test.bin") -> str:
        """
        创建测试文件
        
        Args:
            size_bytes: 文件大小（字节）
            filename: 文件名
            
        Returns:
            str: 文件路径
        """
        file_path = os.path.join(self.test_dir, filename)
        
        # 创建包含连续字节数据的文件
        with open(file_path, 'wb') as f:
            # 写入模式数据：0x00, 0x01, 0x02, ... 0xFF 重复
            pattern = bytes([i % 256 for i in range(size_bytes)])
            f.write(pattern)
            
        return file_path
    
    def test_calculate_chunks_exact_multiple(self):
        """测试正好是分片大小整数倍的文件"""
        file_size = 3 * 1048576  # 正好3MB
        chunks = self.chunk_manager.calculate_chunks(file_size)
        
        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0], (0, 1048576))
        self.assertEqual(chunks[1], (1048576, 2097152))
        self.assertEqual(chunks[2], (2097152, 3145728))
        
    def test_calculate_chunks_partial_last_chunk(self):
        """测试最后一个分片不完整的情况"""
        file_size = 1048576 + 512  # 1MB + 512字节
        chunks = self.chunk_manager.calculate_chunks(file_size)
        
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0], (0, 1048576))
        self.assertEqual(chunks[1], (1048576, 1048576 + 512))
        
    def test_calculate_chunks_small_file(self):
        """测试小文件（小于1MB）"""
        file_size = 1024  # 1KB
        chunks = self.chunk_manager.calculate_chunks(file_size)
        
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0], (0, 1024))
        
    def test_calculate_chunks_empty_file(self):
        """测试空文件"""
        chunks = self.chunk_manager.calculate_chunks(0)
        self.assertEqual(len(chunks), 0)
        
    def test_create_chunks_for_file(self):
        """测试创建分片信息"""
        file_size = 2097152  # 2MB
        file_id = "test_file"
        
        chunks = self.chunk_manager.create_chunks_for_file(file_id, file_size)
        
        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0].chunk_index, 0)
        self.assertEqual(chunks[0].start_offset, 0)
        self.assertEqual(chunks[0].end_offset, 1048576)
        self.assertEqual(chunks[0].size, 1048576)
        self.assertEqual(chunks[0].status, ChunkStatus.PENDING)
        
        self.assertEqual(chunks[1].chunk_index, 1)
        self.assertEqual(chunks[1].start_offset, 1048576)
        self.assertEqual(chunks[1].end_offset, 2097152)
        self.assertEqual(chunks[1].size, 1048576)
        
    def test_read_chunk_from_file(self):
        """测试从文件中读取分片"""
        # 创建2MB的测试文件
        file_size = 2 * 1048576
        file_path = self.create_test_file(file_size)
        
        # 创建分片信息
        chunks = self.chunk_manager.create_chunks_for_file(file_path, file_size)
        
        # 读取第一个分片
        chunk = self.chunk_manager.read_chunk_from_file(file_path, chunks[0])
        
        self.assertEqual(chunk.status, ChunkStatus.COMPLETED)
        self.assertIsNotNone(chunk.data)
        self.assertEqual(len(chunk.data), 1048576)
        self.assertIsNotNone(chunk.checksum)
        self.assertIsNotNone(chunk.timestamp)
        
        # 验证数据内容
        expected_data = bytes([i % 256 for i in range(1048576)])
        self.assertEqual(chunk.data, expected_data)
        
    def test_read_all_chunks(self):
        """测试读取所有分片"""
        file_size = 2.5 * 1048576  # 2.5MB
        file_path = self.create_test_file(int(file_size))
        
        chunks = self.chunk_manager.read_all_chunks(file_path)
        
        self.assertEqual(len(chunks), 3)  # 应该有3个分片
        
        # 验证每个分片的状态和数据
        for i, chunk in enumerate(chunks):
            self.assertEqual(chunk.chunk_index, i)
            self.assertEqual(chunk.status, ChunkStatus.COMPLETED)
            self.assertIsNotNone(chunk.data)
            self.assertIsNotNone(chunk.checksum)
            
            # 验证分片大小
            if i < 2:  # 前两个分片应该是完整的1MB
                self.assertEqual(chunk.size, 1048576)
            else:  # 最后一个分片应该是0.5MB
                self.assertEqual(chunk.size, file_size - 2 * 1048576)
    
    def test_get_chunk(self):
        """测试获取指定分片"""
        file_size = 3 * 1048576
        file_path = self.create_test_file(file_size)
        
        # 获取第二个分片
        chunk = self.chunk_manager.get_chunk(file_path, 1)
        
        self.assertIsNotNone(chunk)
        self.assertEqual(chunk.chunk_index, 1)
        self.assertEqual(chunk.start_offset, 1048576)
        self.assertEqual(chunk.end_offset, 2097152)
        self.assertEqual(chunk.size, 1048576)
        self.assertEqual(chunk.status, ChunkStatus.COMPLETED)
        self.assertIsNotNone(chunk.data)
        
        # 验证数据内容（应该是1048576到2097152范围内的字节）
        expected_data = bytes([i % 256 for i in range(1048576, 2097152)])
        self.assertEqual(chunk.data, expected_data)
        
    def test_reassemble_file(self):
        """测试重新组装文件"""
        # 创建原始文件
        original_size = 2.3 * 1048576  # 2.3MB
        original_file = self.create_test_file(int(original_size), "original.bin")
        
        # 读取所有分片
        chunks = self.chunk_manager.read_all_chunks(original_file)
        
        # 重新组装文件
        reassembled_file = os.path.join(self.test_dir, "reassembled.bin")
        success = self.chunk_manager.reassemble_file(chunks, reassembled_file)
        
        self.assertTrue(success)
        
        # 验证重组后的文件大小
        self.assertEqual(os.path.getsize(reassembled_file), original_size)
        
        # 验证文件内容
        with open(original_file, 'rb') as f1, open(reassembled_file, 'rb') as f2:
            original_data = f1.read()
            reassembled_data = f2.read()
            self.assertEqual(original_data, reassembled_data)
    
    def test_validate_chunk_sequence(self):
        """测试验证分片序列连续性"""
        file_size = 3 * 1048576
        file_id = "test_file"
        
        chunks = self.chunk_manager.create_chunks_for_file(file_id, file_size)
        
        # 验证连续序列
        self.assertTrue(self.chunk_manager.validate_chunk_sequence(chunks))
        
        # 创建不连续的序列（缺少一个分片）
        incomplete_chunks = chunks[:2]  # 只取前两个分片
        self.assertFalse(self.chunk_manager.validate_chunk_sequence(incomplete_chunks))
        
        # 创建顺序错乱的序列
        shuffled_chunks = [chunks[1], chunks[0], chunks[2]]
        self.assertFalse(self.chunk_manager.validate_chunk_sequence(shuffled_chunks))
    
    def test_get_chunk_info(self):
        """测试获取分片信息"""
        file_size = 1.5 * 1048576
        file_path = self.create_test_file(int(file_size))
        
        info = self.chunk_manager.get_chunk_info(file_path)
        
        self.assertEqual(info["file_path"], file_path)
        self.assertEqual(info["file_size"], file_size)
        self.assertEqual(info["chunk_size"], 1048576)
        self.assertEqual(info["total_chunks"], 2)  # 1.5MB应该分成2个分片
        
        chunks_info = info["chunks"]
        self.assertEqual(len(chunks_info), 2)
        self.assertEqual(chunks_info[0]["size"], 1048576)
        self.assertEqual(chunks_info[1]["size"], file_size - 1048576)
    
    def test_verify_chunk_integrity(self):
        """测试验证分片完整性"""
        file_size = 1048576
        file_path = self.create_test_file(file_size)
        
        chunks = self.chunk_manager.read_all_chunks(file_path)
        chunk = chunks[0]
        
        # 验证完整性应该通过
        self.assertTrue(self.chunk_manager.verify_chunk_integrity(chunk))
        
        # 篡改数据后验证应该失败
        corrupted_data = chunk.data[:-100] + b"x" * 100
        chunk.data = corrupted_data
        self.assertFalse(self.chunk_manager.verify_chunk_integrity(chunk))
    
    def test_edge_case_very_small_file(self):
        """测试极小文件边界情况"""
        file_sizes = [1, 10, 100, 1000]  # 各种小文件大小
        
        for size in file_sizes:
            file_path = self.create_test_file(size, f"small_{size}.bin")
            chunks = self.chunk_manager.read_all_chunks(file_path)
            
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].size, size)
            self.assertEqual(chunks[0].start_offset, 0)
            self.assertEqual(chunks[0].end_offset, size)
    
    def test_edge_case_large_file(self):
        """测试大文件边界情况"""
        # 测试100MB文件（100个分片）
        file_size = 100 * 1048576
        file_path = self.create_test_file(file_size, "large_100mb.bin")
        
        chunks_info = self.chunk_manager.calculate_chunks(file_size)
        self.assertEqual(len(chunks_info), 100)
        
        # 验证第一个和最后一个分片
        self.assertEqual(chunks_info[0], (0, 1048576))
        self.assertEqual(chunks_info[-1], (99 * 1048576, 100 * 1048576))
    
    def test_chunk_cache_functionality(self):
        """测试分片缓存功能"""
        file_size = 2 * 1048576
        file_path = self.create_test_file(file_size)
        
        # 第一次读取应该不在缓存中
        chunk1 = self.chunk_manager.get_chunk(file_path, 0)
        self.assertIsNotNone(chunk1)
        
        # 第二次读取应该在缓存中
        chunk2 = self.chunk_manager.get_chunk(file_path, 0)
        self.assertEqual(chunk1.data, chunk2.data)
        
        # 清理缓存后再次读取
        self.chunk_manager.clear_cache(file_path)
        chunk3 = self.chunk_manager.get_chunk(file_path, 0)
        self.assertEqual(chunk1.data, chunk3.data)  # 数据应该相同，但会重新读取
    
    def test_error_handling(self):
        """测试错误处理"""
        # 测试不存在的文件
        with self.assertRaises(FileNotFoundError):
            self.chunk_manager.read_chunk_from_file("nonexistent.bin", FileChunk(
                file_id="nonexistent",
                chunk_index=0,
                start_offset=0,
                end_offset=100,
                size=100
            ))
        
        # 测试无效的分片偏移量
        file_path = self.create_test_file(1000)
        invalid_chunk = FileChunk(
            file_id=file_path,
            chunk_index=0,
            start_offset=2000,  # 超出文件范围
            end_offset=3000,
            size=1000
        )
        
        with self.assertRaises(IOError):
            self.chunk_manager.read_chunk_from_file(file_path, invalid_chunk)


if __name__ == "__main__":
    unittest.main()