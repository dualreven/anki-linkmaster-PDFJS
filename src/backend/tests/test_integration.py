"""
集成测试：验证PDF管理器和WebSocket服务器的集成
"""

import sys
import os
import tempfile
import json
import threading
import time
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from PyQt6.QtCore import QCoreApplication
    from pdf_manager.manager import PDFManager
    from websocket.server import WebSocketServer
    
    def test_basic_integration():
        """测试基本集成"""
        print("🚀 启动集成测试...")
        
        # 创建Qt应用
        app = QCoreApplication([])
        
        # 测试PDF管理器
        print("📁 测试PDF管理器...")
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_manager = PDFManager(data_dir=temp_dir)
            
            # 创建测试PDF文件
            test_pdf = os.path.join(temp_dir, "test_integration.pdf")
            with open(test_pdf, "w") as f:
                f.write("%PDF-1.4 Integration Test")
            
            # 添加文件
            result = pdf_manager.add_file(test_pdf)
            assert result, "PDF文件添加失败"
            assert pdf_manager.get_file_count() == 1, "文件计数不正确"
            
            # 获取文件列表
            files = pdf_manager.get_files()
            assert len(files) == 1, "文件列表长度不正确"
            
            print("✅ PDF管理器测试通过")
        
        # 测试WebSocket服务器
        print("🌐 测试WebSocket服务器...")
        server = WebSocketServer(host="127.0.0.1", port=8766)
        
        # 启动服务器
        result = server.start()
        assert result, "WebSocket服务器启动失败"
        
        # 验证服务器状态
        assert server.is_running(), "服务器未在运行状态"
        assert server.get_client_count() == 0, "客户端计数不正确"
        
        # 停止服务器
        server.stop_server()
        assert not server.is_running(), "服务器未正确停止"
        
        print("✅ WebSocket服务器测试通过")
        
        # 测试信号机制
        print("📡 测试信号机制...")
        
        # 创建新的实例用于信号测试
        pdf_manager2 = PDFManager()
        server2 = WebSocketServer(host="127.0.0.1", port=8767)
        
        # 存储信号接收结果
        signals_received = []
        
        def on_file_added(file_info):
            signals_received.append(f"file_added:{file_info['filename']}")
        
        def on_client_connected(client_id):
            signals_received.append(f"client_connected:{client_id}")
        
        # 连接信号
        pdf_manager2.file_added.connect(on_file_added)
        server2.client_connected.connect(on_client_connected)
        
        # 触发信号
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(b"%PDF-1.4 Signal Test")
            tmp_path = tmp.name
        
        try:
            pdf_manager2.add_file(tmp_path)
            
            # 启动服务器并触发连接信号
            server2.start()
            
            # 由于我们没有实际的WebSocket客户端，手动触发信号
            server2.client_connected.emit("test_client")
            
            # 验证信号接收
            expected_signals = [
                f"file_added:{os.path.basename(tmp_path)}",
                "client_connected:test_client"
            ]
            
            time.sleep(0.1)  # 等待信号处理
            
            for expected in expected_signals:
                assert expected in signals_received, f"期望的信号未收到: {expected}"
            
            print("✅ 信号机制测试通过")
            
        finally:
            server2.stop_server()
            os.unlink(tmp_path)
        
        print("🎉 集成测试全部通过！")
        return True
    
    if __name__ == "__main__":
        try:
            success = test_basic_integration()
            if success:
                print("\n🎯 所有测试成功完成！")
                sys.exit(0)
            else:
                print("\n❌ 测试失败！")
                sys.exit(1)
        except Exception as e:
            print(f"\n💥 测试过程中发生错误: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

except ImportError as e:
    print(f"导入错误: {e}")
    print("请确保已安装PyQt6: pip install PyQt6")
    sys.exit(1)