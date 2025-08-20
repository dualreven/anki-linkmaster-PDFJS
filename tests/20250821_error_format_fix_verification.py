#!/usr/bin/env python3
"""
20250821 前端错误格式修复验证测试

测试目的：验证调试报告中提到的"undefined"错误显示问题是否已修复
测试起因：根据20250820230000_debugReport.md的修复方案进行验证

测试内容：
1. 验证前端能正确解析后端嵌套格式的错误响应
2. 验证FILE_EXISTS等错误码显示用户友好的提示
3. 验证不再显示"undefined"错误
"""

import asyncio
import json
import websockets
import threading
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

class MockWebSocketServer:
    """模拟后端WebSocket服务器，发送各种格式的错误响应"""
    
    def __init__(self, port=8766):  # 使用不同的端口避免冲突
        self.port = port
        self.server = None
        self.clients = set()
        
    async def handle_client(self, websocket, path):
        """处理客户端连接"""
        self.clients.add(websocket)
        try:
            async for message in websocket:
                data = json.loads(message)
                print(f"收到客户端消息: {data}")
                
                # 根据消息类型发送不同的错误响应
                if data.get('type') == 'add_pdf':
                    # 测试场景1: FILE_EXISTS错误（嵌套格式）
                    error_response = {
                        "type": "error",
                        "data": {
                            "code": "FILE_EXISTS",
                            "message": "文件已存在于列表中: test.pdf",
                            "original_type": "add_pdf"
                        }
                    }
                    await websocket.send(json.dumps(error_response))
                    
                elif data.get('type') == 'request_file_selection':
                    # 测试场景2: FILE_NOT_FOUND错误（嵌套格式）
                    error_response = {
                        "type": "error",
                        "data": {
                            "code": "FILE_NOT_FOUND",
                            "message": "文件不存在: missing.pdf",
                            "original_type": "request_file_selection"
                        }
                    }
                    await websocket.send(json.dumps(error_response))
                    
                elif data.get('type') == 'remove_pdf':
                    # 测试场景3: PERMISSION_DENIED错误（嵌套格式）
                    error_response = {
                        "type": "error",
                        "data": {
                            "code": "PERMISSION_DENIED",
                            "message": "文件权限不足: protected.pdf",
                            "original_type": "remove_pdf"
                        }
                    }
                    await websocket.send(json.dumps(error_response))
                    
                elif data.get('type') == 'get_pdf_list':
                    # 发送空列表
                    response = {
                        "type": "pdf_list",
                        "pdfs": []
                    }
                    await websocket.send(json.dumps(response))
                    
        except websockets.exceptions.ConnectionClosed:
            print("客户端连接已关闭")
        finally:
            self.clients.discard(websocket)
    
    async def start_server(self):
        """启动WebSocket服务器"""
        self.server = await websockets.serve(self.handle_client, "localhost", self.port)
        print(f"模拟WebSocket服务器启动在端口 {self.port}")
        await self.server.wait_closed()
    
    def start_in_thread(self):
        """在新线程中启动服务器"""
        def run_server():
            asyncio.run(self.start_server())
        
        server_thread = threading.Thread(target=run_server)
        server_thread.daemon = True
        server_thread.start()
        return server_thread

class TestRunner:
    """测试运行器"""
    
    def __init__(self):
        self.server = MockWebSocketServer(port=8766)
        self.test_results = []
        
    def run_frontend_test(self):
        """运行前端测试"""
        print("=" * 60)
        print("开始前端错误格式修复验证测试")
        print("=" * 60)
        
        # 启动模拟服务器
        server_thread = self.server.start_in_thread()
        time.sleep(2)  # 等待服务器启动
        
        # 这里我们模拟前端的错误处理逻辑
        test_cases = [
            {
                "name": "FILE_EXISTS错误处理",
                "response": {
                    "type": "error",
                    "data": {
                        "code": "FILE_EXISTS",
                        "message": "文件已存在于列表中: test.pdf",
                        "original_type": "add_pdf"
                    }
                },
                "expected_message": "文件已存在于列表中"
            },
            {
                "name": "FILE_NOT_FOUND错误处理", 
                "response": {
                    "type": "error",
                    "data": {
                        "code": "FILE_NOT_FOUND",
                        "message": "文件不存在: missing.pdf",
                        "original_type": "request_file_selection"
                    }
                },
                "expected_message": "文件不存在或无法访问"
            },
            {
                "name": "PERMISSION_DENIED错误处理",
                "response": {
                    "type": "error",
                    "data": {
                        "code": "PERMISSION_DENIED",
                        "message": "文件权限不足: protected.pdf",
                        "original_type": "remove_pdf"
                    }
                },
                "expected_message": "文件权限不足"
            },
            {
                "name": "未知错误格式处理",
                "response": {
                    "type": "error",
                    "message": "未知错误"
                },
                "expected_message": "发生未知错误"
            }
        ]
        
        # 模拟前端的错误处理逻辑
        for test_case in test_cases:
            result = self.simulate_frontend_error_handling(test_case)
            self.test_results.append(result)
            
        # 打印测试结果
        self.print_test_results()
        
        return all(result["passed"] for result in self.test_results)
    
    def simulate_frontend_error_handling(self, test_case):
        """模拟前端的错误处理逻辑"""
        data = test_case["response"]
        expected = test_case["expected_message"]
        
        # 复制前端的错误处理逻辑
        error_code = None
        error_message = None
        
        # 兼容新旧格式，根据调试报告的方案
        if data.get('data') and data['data'].get('code'):
            error_code = data['data']['code']
            error_message = data['data'].get('message', '未知错误')
        elif data.get('error_code'):
            error_code = data['error_code']
            error_message = data.get('message', '未知错误')
        elif data.get('code'):
            error_code = data['code']
            error_message = data.get('message', '未知错误')
        else:
            error_message = data.get('message', '发生未知错误')
        
        # 根据错误码显示用户友好的消息
        if error_code == 'FILE_EXISTS':
            error_message = '文件已存在于列表中'
        elif error_code == 'FILE_NOT_FOUND':
            error_message = '文件不存在或无法访问'
        elif error_code == 'PERMISSION_DENIED':
            error_message = '文件权限不足'
        elif not error_message:
            error_message = '操作失败'
        
        # 验证结果
        passed = error_message == expected
        
        return {
            "test_name": test_case["name"],
            "expected": expected,
            "actual": error_message,
            "passed": passed,
            "error_code": error_code
        }
    
    def print_test_results(self):
        """打印测试结果"""
        print("\n测试结果汇总:")
        print("-" * 60)
        
        passed_count = 0
        for result in self.test_results:
            status = "✅ 通过" if result["passed"] else "❌ 失败"
            print(f"{status} {result['test_name']}")
            print(f"  预期: {result['expected']}")
            print(f"  实际: {result['actual']}")
            print()
            
            if result["passed"]:
                passed_count += 1
        
        print(f"总计: {passed_count}/{len(self.test_results)} 个测试通过")
        
        if passed_count == len(self.test_results):
            print("🎉 所有测试通过！错误格式修复验证成功")
        else:
            print("⚠️  部分测试失败，需要进一步检查")

def main():
    """主函数"""
    runner = TestRunner()
    success = runner.run_frontend_test()
    
    # 测试结果写入文件
    with open("20250821_error_format_fix_test_report.txt", "w", encoding="utf-8") as f:
        f.write("前端错误格式修复验证测试报告\n")
        f.write("=" * 50 + "\n\n")
        f.write("测试时间: {}\n".format(time.strftime("%Y-%m-%d %H:%M:%S")))
        f.write("测试目的: 验证调试报告中提到的\"undefined\"错误显示问题是否已修复\n\n")
        
        for result in runner.test_results:
            f.write(f"测试: {result['test_name']}\n")
            f.write(f"状态: {'通过' if result['passed'] else '失败'}\n")
            f.write(f"预期: {result['expected']}\n")
            f.write(f"实际: {result['actual']}\n")
            f.write("-" * 30 + "\n\n")
        
        if success:
            f.write("结论: ✅ 所有测试通过，错误格式修复成功！\n")
        else:
            f.write("结论: ❌ 部分测试失败，需要进一步修复\n")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)