"""
简化版并发控制测试 - 专注于测试并发控制逻辑，避免文件操作
"""
import unittest
import time
import threading
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(__file__))

from src.backend.pdf_manager.chunk_manager import ChunkManager, FileChunk, ChunkStatus
from src.backend.pdf_manager.concurrency_manager import RequestPriority

class TestConcurrencyControlSimple(unittest.TestCase):
    """简化版并发控制测试类"""
    
    def setUp(self):
        """测试前准备"""
        self.chunk_manager = ChunkManager(max_concurrent=3)
        self.mock_file_path = "/fake/path/test.pdf"
        self.test_chunks = []
        
        # 创建测试分片
        for i in range(10):
            chunk = FileChunk(
                file_id=self.mock_file_path,
                chunk_index=i,
                start_offset=i * 1048576,
                end_offset=(i + 1) * 1048576,
                size=1048576,
                status=ChunkStatus.PENDING
            )
            self.test_chunks.append(chunk)
    
    def test_max_concurrent_limit(self):
        """测试最大并发限制"""
        print("测试最大并发限制...")
        
        # 完全模拟文件读取，避免实际文件操作
        with patch.object(self.chunk_manager, '_read_chunk_direct') as mock_read:
            mock_read.return_value = MagicMock(status=ChunkStatus.COMPLETED)
            
            # 启动多个并发读取
            threads = []
            results = []
            
            def read_chunk_thread(chunk_index):
                try:
                    chunk = self.test_chunks[chunk_index]
                    result = self.chunk_manager.read_chunk_from_file(
                        self.mock_file_path, chunk, RequestPriority.NORMAL
                    )
                    results.append((chunk_index, result.status))
                except Exception as e:
                    results.append((chunk_index, f"error: {e}"))
            
            # 启动10个线程模拟并发请求
            for i in range(10):
                thread = threading.Thread(target=read_chunk_thread, args=(i,))
                threads.append(thread)
                thread.start()
            
            # 等待一段时间检查并发数
            time.sleep(1.0)
            
            # 检查当前活跃并发数
            stats = self.chunk_manager.get_concurrency_stats()
            print(f"当前并发统计: {stats}")
            
            self.assertLessEqual(stats['active_count'], 3, "活跃并发数不应超过3")
            
            # 等待所有线程完成
            for thread in threads:
                thread.join(timeout=5.0)
            
            # 验证所有分片都处理完成
            completed_count = sum(1 for _, status in results if status == ChunkStatus.COMPLETED)
            print(f"完成的分片数量: {completed_count}/10")
            
            self.assertEqual(completed_count, 10, "所有分片都应该完成")
    
    def test_concurrency_pressure_test(self):
        """并发压力测试 - 模拟版本"""
        print("开始压力测试...")
        
        start_time = time.time()
        completed_count = 0
        
        # 模拟文件读取
        with patch.object(self.chunk_manager, '_read_chunk_direct') as mock_read:
            mock_read.return_value = MagicMock(status=ChunkStatus.COMPLETED)
            
            def process_chunk(chunk_index):
                nonlocal completed_count
                try:
                    chunk = self.test_chunks[chunk_index]
                    result = self.chunk_manager.read_chunk_from_file(
                        self.mock_file_path, chunk, RequestPriority.NORMAL
                    )
                    if result.status == ChunkStatus.COMPLETED:
                        completed_count += 1
                except Exception as e:
                    print(f"处理分片错误: {e}")
            
            # 创建大量线程模拟高并发
            threads = []
            for i in range(20):  # 20个并发请求
                thread = threading.Thread(target=process_chunk, args=(i % 10,))
                threads.append(thread)
            
            # 启动所有线程
            for thread in threads:
                thread.start()
            
            # 监控并发状态
            max_active = 0
            for _ in range(10):  # 监控10次
                time.sleep(0.3)
                stats = self.chunk_manager.get_concurrency_stats()
                max_active = max(max_active, stats['active_count'])
                print(f"当前活跃: {stats['active_count']}, 队列: {stats['queue_size']}")
            
            # 等待所有完成
            self.chunk_manager.wait_all_chunks_completed(timeout=10.0)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            print(f"压力测试结果:")
            print(f"总时间: {total_time:.2f}s")
            print(f"完成数量: {completed_count}")
            print(f"最大并发数: {max_active}")
            
            # 验证并发控制
            self.assertLessEqual(max_active, 3, "最大并发数不应超过3")
            self.assertEqual(completed_count, 20, "应该完成所有请求")
    
    def test_queue_management(self):
        """测试队列管理功能"""
        print("测试队列管理...")
        
        # 模拟文件读取
        with patch.object(self.chunk_manager, '_read_chunk_direct') as mock_read:
            mock_read.return_value = MagicMock(status=ChunkStatus.COMPLETED)
            
            # 获取初始队列状态
            initial_stats = self.chunk_manager.get_concurrency_stats()
            initial_queue_size = initial_stats.get('queue_size', 0)
            
            # 提交多个请求
            for i in range(5):
                chunk = self.test_chunks[i]
                self.chunk_manager.read_chunk_from_file(
                    self.mock_file_path, chunk, RequestPriority.NORMAL
                )
            
            # 检查队列大小
            time.sleep(0.5)
            stats = self.chunk_manager.get_concurrency_stats()
            print(f"队列大小: {stats['queue_size']}")
            
            self.assertGreaterEqual(stats['queue_size'], 2, "应该有请求在队列中等待")
            
            # 等待所有处理完成
            self.chunk_manager.wait_all_chunks_completed(timeout=10.0)
            
            # 检查队列应该为空
            final_stats = self.chunk_manager.get_concurrency_stats()
            self.assertEqual(final_stats['queue_size'], 0, "队列应该为空")
            self.assertEqual(final_stats['active_count'], 0, "活跃请求数应该为0")

class TestConcurrencyManagerDirect(unittest.TestCase):
    """直接测试并发管理器"""
    
    def setUp(self):
        from src.backend.pdf_manager.concurrency_manager import ConcurrencyManager
        self.concurrency_manager = ConcurrencyManager(max_concurrent=2)
        self.concurrency_manager.start()
    
    def tearDown(self):
        self.concurrency_manager.stop()
    
    def test_direct_concurrency_control(self):
        """直接测试并发控制"""
        print("直接测试并发控制...")
        
        results = []
        
        def test_callback(success, file_id, chunk_index, metadata):
            results.append((file_id, chunk_index, success))
            print(f"回调: {file_id}-{chunk_index}, 成功: {success}")
        
        # 提交多个请求
        for i in range(5):
            self.concurrency_manager.submit_request(
                f"file_{i}", i, RequestPriority.NORMAL, test_callback
            )
        
        # 检查并发状态
        time.sleep(1.0)
        stats = {
            'queue_size': self.concurrency_manager.get_queue_size(),
            'active_count': self.concurrency_manager.get_active_count()
        }
        print(f"并发状态: {stats}")
        
        self.assertLessEqual(stats['active_count'], 2, "活跃并发数不应超过2")
        self.assertGreaterEqual(stats['queue_size'], 3, "应该有请求在队列中")
        
        # 等待所有完成
        self.concurrency_manager.wait_all_completed(timeout=10.0)
        
        self.assertEqual(len(results), 5, "所有回调都应该被执行")
        self.assertEqual(self.concurrency_manager.get_queue_size(), 0, "队列应该为空")

if __name__ == '__main__':
    print("=" * 50)
    print("简化版并发控制测试")
    print("=" * 50)
    
    # 运行测试
    unittest.main(verbosity=2)