"""
并发控制测试用例 - 验证最大并发3个分片的控制逻辑
直接在项目根目录运行，避免路径问题
"""
import unittest
import time
import threading
from unittest.mock import Mock, patch
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(__file__))

from src.backend.pdf_manager.chunk_manager import ChunkManager, FileChunk, ChunkStatus
from src.backend.pdf_manager.concurrency_manager import RequestPriority

class TestConcurrencyControl(unittest.TestCase):
    """并发控制测试类"""
    
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
        
        # 模拟文件读取
        def mock_read_file(file_path, mode):
            return b"x" * 1048576
        
        with patch('builtins.open', unittest.mock.mock_open(read_data=b"x" * 1048576 * 10)):
            with patch('os.path.exists', return_value=True):
                with patch('os.path.getmtime', return_value=time.time()):
                    
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
                        thread.join(timeout=10.0)
                    
                    # 验证所有分片都处理完成
                    completed_count = sum(1 for _, status in results if status == ChunkStatus.COMPLETED)
                    print(f"完成的分片数量: {completed_count}/10")
                    
                    self.assertGreaterEqual(completed_count, 8, "至少80%的分片应该完成")
    
    def test_priority_scheduling(self):
        """测试优先级调度"""
        print("测试优先级调度...")
        
        with patch('builtins.open', unittest.mock.mock_open(read_data=b"x" * 1048576)):
            with patch('os.path.exists', return_value=True):
                with patch('os.path.getmtime', return_value=time.time()):
                    
                    # 提交不同优先级的请求
                    high_priority_chunk = self.test_chunks[0]
                    normal_priority_chunk = self.test_chunks[1]
                    low_priority_chunk = self.test_chunks[2]
                    
                    # 记录开始时间
                    start_time = time.time()
                    completion_times = {}
                    
                    def completion_callback(chunk_index, priority):
                        def callback(success, file_id, chunk_idx, metadata):
                            end_time = time.time()
                            completion_times[chunk_index] = end_time - start_time
                            print(f"{priority}优先级分片 {chunk_index} 完成时间: {completion_times[chunk_index]:.3f}s")
                        return callback
                    
                    # 提交请求（先提交低优先级，再提交高优先级）
                    self.chunk_manager.read_chunk_from_file(
                        self.mock_file_path, low_priority_chunk, RequestPriority.LOW
                    )
                    
                    time.sleep(0.5)  # 让低优先级先进入队列
                    
                    self.chunk_manager.read_chunk_from_file(
                        self.mock_file_path, high_priority_chunk, RequestPriority.HIGH
                    )
                    
                    self.chunk_manager.read_chunk_from_file(
                        self.mock_file_path, normal_priority_chunk, RequestPriority.NORMAL
                    )
                    
                    # 等待所有处理完成
                    self.chunk_manager.wait_all_chunks_completed(timeout=10.0)
                    
                    # 验证高优先级应该先完成（尽管后提交）
                    self.assertLess(
                        completion_times.get(1, float('inf')),  # 高优先级
                        completion_times.get(0, float('inf')),   # 低优先级
                        "高优先级分片应该比低优先级先完成"
                    )
    
    def test_queue_management(self):
        """测试队列管理功能"""
        print("测试队列管理...")
        
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
    
    def test_concurrency_pressure_test(self):
        """并发压力测试"""
        print("开始压力测试...")
        
        start_time = time.time()
        completed_count = 0
        error_count = 0
        
        def process_chunk(chunk_index):
            nonlocal completed_count, error_count
            try:
                chunk = self.test_chunks[chunk_index]
                result = self.chunk_manager.read_chunk_from_file(
                    self.mock_file_path, chunk, RequestPriority.NORMAL
                )
                if result.status == ChunkStatus.COMPLETED:
                    completed_count += 1
            except Exception:
                error_count += 1
        
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
            time.sleep(0.5)
            stats = self.chunk_manager.get_concurrency_stats()
            max_active = max(max_active, stats['active_count'])
            print(f"当前活跃: {stats['active_count']}, 队列: {stats['queue_size']}")
        
        # 等待所有完成
        self.chunk_manager.wait_all_chunks_completed(timeout=15.0)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"压力测试结果:")
        print(f"总时间: {total_time:.2f}s")
        print(f"完成数量: {completed_count}")
        print(f"错误数量: {error_count}")
        print(f"最大并发数: {max_active}")
        
        # 验证并发控制
        self.assertLessEqual(max_active, 3, "最大并发数不应超过3")
        self.assertGreater(completed_count, 15, "应该完成大部分请求")
        self.assertLess(error_count, 3, "错误数量应该很少")

if __name__ == '__main__':
    print("=" * 50)
    print("并发控制机制测试")
    print("=" * 50)
    
    # 运行测试
    unittest.main(verbosity=2)