"""
测试后端监听 logs/load-pdf.json 文件并触发 WebSocket 消息加载 PDF 的功能
"""

import os
import json
import time
import threading
import tempfile
import shutil
from unittest.mock import MagicMock
import pytest
from src.backend.app.application import AnkiLinkMasterApp
from src.backend.websocket.server import WebSocketServer
from src.backend.pdf_manager.manager import PDFManager

class TestPDFLoadListener:
    """测试 PDF 加载监听器功能"""
    
    def setup_method(self):
        """设置测试环境"""
        # 创建临时目录用于测试
        self.test_dir = tempfile.mkdtemp()
        self.logs_dir = os.path.join(self.test_dir, 'logs')
        self.load_pdf_file = os.path.join(self.logs_dir, 'load-pdf.json')
        
        # 创建 logs 目录
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # 创建一个模拟的 WebSocketServer
        self.mock_websocket_server = MagicMock()
        self.mock_websocket_server.broadcast_message = MagicMock()
        
        # 创建一个模拟的 PDFManager
        self.mock_pdf_manager = MagicMock()
        
        # 创建 AnkiLinkMasterApp 实例
        self.app = AnkiLinkMasterApp()
        self.app.websocket_server = self.mock_websocket_server
        self.app.pdf_manager = self.mock_pdf_manager
        
        # 启动监听器（使用临时目录）
        self.app._pdf_load_listener_worker = self._create_test_listener_worker()
        
    def teardown_method(self):
        """清理测试环境"""
        # 删除临时目录
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def _create_test_listener_worker(self):
        """创建一个使用测试目录的监听器工作函数"""
        def test_worker():
            """使用测试目录的监听器工作函数"""
            logger = self.app.logger
            
            # 使用测试目录
            load_pdf_file = self.load_pdf_file
            
            # 确保 logs 目录存在
            os.makedirs(os.path.dirname(load_pdf_file), exist_ok=True)
            
            # 上次文件修改时间
            last_modified = 0
            
            # 为测试设置一个较小的轮询间隔
            poll_interval = 0.1
            
            # 模拟运行状态
            self.pdf_load_listener_running = True
            
            # 用于测试的文件检查
            def check_file():
                if os.path.exists(load_pdf_file):
                    current_modified = os.path.getmtime(load_pdf_file)
                    if current_modified > last_modified:
                        logger.info(f"检测到 load-pdf.json 文件被修改: {load_pdf_file}")
                        
                        # 读取文件内容
                        with open(load_pdf_file, 'r', encoding='utf-8') as f:
                            try:
                                data = json.load(f)
                                pdf_path = data.get('path')
                                
                                if pdf_path and os.path.exists(pdf_path):
                                    logger.info(f"准备加载 PDF 文件: {pdf_path}")
                                    
                                    # 构建 WebSocket 消息
                                    websocket_message = {
                                        "type": "pdf_view_request",
                                        "data": {
                                            "path": pdf_path
                                        }
                                    }
                                    
                                    # 广播消息给所有前端客户端
                                    if self.app.websocket_server:
                                        self.app.websocket_server.broadcast_message(websocket_message)
                                        logger.info(f"已广播 PDF 加载请求: {pdf_path}")
                                    
                                    # 删除 load-pdf.json 文件
                                    os.remove(load_pdf_file)
                                    logger.info(f"已删除 load-pdf.json 文件: {load_pdf_file}")
                                    
                                    # 更新最后修改时间
                                    last_modified = current_modified
                                    
                                else:
                                    logger.warning(f"load-pdf.json 中的路径无效或文件不存在: {pdf_path}")
                                    
                            except json.JSONDecodeError:
                                logger.error(f"load-pdf.json 文件格式错误，无法解析为 JSON")
                            except Exception as e:
                                logger.error(f"处理 load-pdf.json 文件时出错: {str(e)}")
            
            # 在测试中，我们不会使用 while 循环，而是手动触发检查
            return check_file
        
        return test_worker
    
    def test_pdf_load_listener_triggers_websocket_message(self):
        """测试 PDF 加载监听器是否触发 WebSocket 消息"""
        # 创建测试 PDF 文件（实际文件不需要存在，因为测试只验证消息发送）
        test_pdf_path = "test.pdf"
        
        # 创建 load-pdf.json 文件
        load_pdf_data = {
            "path": test_pdf_path
        }
        
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            json.dump(load_pdf_data, f)
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证 WebSocket 消息是否被广播
        self.mock_websocket_server.broadcast_message.assert_called_once()
        
        # 获取调用参数
        call_args = self.mock_websocket_server.broadcast_message.call_args[0][0]
        
        # 验证消息格式
        assert call_args["type"] == "pdf_view_request"
        assert call_args["data"]["path"] == test_pdf_path
        
        # 验证 load-pdf.json 文件已被删除
        assert not os.path.exists(self.load_pdf_file)
    
    def test_pdf_load_listener_handles_invalid_json(self):
        """测试 PDF 加载监听器是否正确处理无效的 JSON 文件"""
        # 创建无效的 JSON 文件
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            f.write("invalid json content")
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证 WebSocket 消息没有被广播
        self.mock_websocket_server.broadcast_message.assert_not_called()
        
        # 验证 load-pdf.json 文件仍然存在（因为没有被成功处理）
        assert os.path.exists(self.load_pdf_file)
    
    def test_pdf_load_listener_handles_nonexistent_pdf_path(self):
        """测试 PDF 加载监听器是否正确处理不存在的 PDF 路径"""
        # 创建包含不存在路径的 load-pdf.json 文件
        nonexistent_pdf_path = "nonexistent.pdf"
        load_pdf_data = {
            "path": nonexistent_pdf_path
        }
        
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            json.dump(load_pdf_data, f)
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证 WebSocket 消息没有被广播
        self.mock_websocket_server.broadcast_message.assert_not_called()
        
        # 验证 load-pdf.json 文件仍然存在（因为没有被成功处理）
        assert os.path.exists(self.load_pdf_file)
    
    def test_pdf_load_listener_handles_missing_path(self):
        """测试 PDF 加载监听器是否正确处理缺少 path 字段的 JSON 文件"""
        # 创建缺少 path 字段的 load-pdf.json 文件
        load_pdf_data = {
            "filename": "test.pdf"
        }
        
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            json.dump(load_pdf_data, f)
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证 WebSocket 消息没有被广播
        self.mock_websocket_server.broadcast_message.assert_not_called()
        
        # 验证 load-pdf.json 文件仍然存在（因为没有被成功处理）
        assert os.path.exists(self.load_pdf_file)
    
    def test_pdf_load_listener_handles_multiple_files(self):
        """测试 PDF 加载监听器是否能正确处理多个文件"""
        # 创建第一个 load-pdf.json 文件
        test_pdf_path1 = "test1.pdf"
        load_pdf_data1 = {
            "path": test_pdf_path1
        }
        
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            json.dump(load_pdf_data1, f)
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证第一个消息被广播
        self.mock_websocket_server.broadcast_message.assert_called_once()
        
        # 获取第一个调用参数
        call_args1 = self.mock_websocket_server.broadcast_message.call_args[0][0]
        assert call_args1["type"] == "pdf_view_request"
        assert call_args1["data"]["path"] == test_pdf_path1
        
        # 验证第一个文件已被删除
        assert not os.path.exists(self.load_pdf_file)
        
        # 创建第二个 load-pdf.json 文件
        test_pdf_path2 = "test2.pdf"
        load_pdf_data2 = {
            "path": test_pdf_path2
        }
        
        with open(self.load_pdf_file, 'w', encoding='utf-8') as f:
            json.dump(load_pdf_data2, f)
        
        # 等待一小段时间让监听器处理文件
        time.sleep(0.2)
        
        # 验证第二个消息被广播
        assert self.mock_websocket_server.broadcast_message.call_count == 2
        
        # 获取第二个调用参数
        call_args2 = self.mock_websocket_server.broadcast_message.call_args[0][0]
        assert call_args2["type"] == "pdf_view_request"
        assert call_args2["data"]["path"] == test_pdf_path2
        
        # 验证第二个文件已被删除
        assert not os.path.exists(self.load_pdf_file)