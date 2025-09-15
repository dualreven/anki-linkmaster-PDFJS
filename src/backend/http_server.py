"""
PyQt6 HTTP文件服务器模块
提供PDF文件访问服务，解决跨域文件传输问题
基于QTcpServer的简单HTTP服务器实现
"""

from PyQt6.QtCore import QObject, pyqtSlot, QByteArray
from PyQt6.QtNetwork import QTcpServer, QTcpSocket
import os
import logging
import mimetypes

logger = logging.getLogger(__name__)

class HttpFileServer(QObject):
    """HTTP文件服务器，提供PDF文件访问服务"""
    
    def __init__(self, port=8080, base_dir=None):
        super().__init__()
        self.server = QTcpServer()
        self.port = port
        self.base_dir = base_dir or os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.server.newConnection.connect(self.handle_new_connection)
    
    def start(self):
        """启动HTTP服务器"""
        try:
            if self.server.listen(port=self.port):
                logger.info(f"HTTP文件服务器启动成功，端口: {self.port}")
                logger.info(f"文件服务地址: http://localhost:{self.port}/pdfs/")
                return True
            else:
                logger.error("HTTP文件服务器启动失败")
                return False
        except Exception as e:
            logger.error(f"HTTP服务器启动异常: {str(e)}")
            return False
    
    def handle_new_connection(self):
        """处理新的TCP连接"""
        socket = self.server.nextPendingConnection()
        if socket:
            socket.readyRead.connect(lambda: self.handle_request(socket))
            socket.disconnected.connect(socket.deleteLater)
    
    def handle_request(self, socket):
        """处理HTTP请求"""
        try:
            data = socket.readAll().data().decode('utf-8')
            lines = data.split('\r\n')
            
            if not lines or not lines[0]:
                return
            
            # 解析请求行
            request_line = lines[0].split()
            if len(request_line) < 2:
                return
            
            method = request_line[0]
            path = request_line[1]
            
            if method == 'GET':
                if path.startswith('/pdfs/'):
                    self.handle_pdf_request(socket, path)
                elif path == '/health':
                    self.handle_health_check(socket)
                else:
                    self.send_response(socket, 404, 'Not Found', '{"error": "Not found"}')
            elif method == 'OPTIONS':
                # 处理预检请求
                self.handle_options(socket)
            else:
                self.send_response(socket, 405, 'Method Not Allowed', '{"error": "Method not allowed"}')
                
        except Exception as e:
            logger.error(f"请求处理失败: {str(e)}")
            self.send_response(socket, 500, 'Internal Server Error', '{"error": "Internal server error"}')
    
    def handle_pdf_request(self, socket, path):
        """处理PDF文件请求"""
        try:
            filename = path.replace('/pdfs/', '')
            file_path = os.path.join(self.base_dir, 'data', 'pdfs', filename)
            
            if not os.path.exists(file_path):
                logger.warning(f"文件不存在: {file_path}")
                self.send_response(socket, 404, 'Not Found', '{"error": "File not found"}')
                return
            
            # 读取文件内容
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # 获取MIME类型
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            
            headers = {
                'Content-Type': mime_type,
                'Content-Length': str(len(file_data)),
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
            
            logger.info(f"成功提供文件: {filename} ({len(file_data)} bytes)")
            self.send_response(socket, 200, 'OK', file_data, headers)
            
        except Exception as e:
            logger.error(f"文件请求处理失败: {str(e)}")
            self.send_response(socket, 500, 'Internal Server Error', '{"error": "Internal server error"}')
    
    def handle_health_check(self, socket):
        """健康检查端点"""
        self.send_response(socket, 200, 'OK', '{"status": "ok", "service": "http-file-server"}')
    
    def handle_options(self, socket):
        """处理OPTIONS预检请求"""
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Length': '0'
        }
        self.send_response(socket, 200, 'OK', '', headers)
    
    def send_response(self, socket, status_code, status_text, body, headers=None):
        """发送HTTP响应"""
        if headers is None:
            headers = {}
        
        if isinstance(body, str):
            body = body.encode('utf-8')
        
        response_lines = [
            f"HTTP/1.1 {status_code} {status_text}",
            f"Content-Length: {len(body)}"
        ]
        
        # 添加自定义头
        for key, value in headers.items():
            response_lines.append(f"{key}: {value}")
        
        response_lines.extend(['', ''])
        response_header = '\r\n'.join(response_lines)
        
        socket.write(response_header.encode('utf-8'))
        socket.write(body)
        socket.disconnectFromHost()
    
    def stop(self):
        """停止HTTP服务器"""
        self.server.close()
        logger.info("HTTP文件服务器停止")

# 简单的测试函数
if __name__ == "__main__":
    import sys
    from PyQt6.QtCore import QCoreApplication
    
    app = QCoreApplication(sys.argv)
    server = HttpFileServer(port=8080)
    if server.start():
        print("HTTP服务器运行中...按Ctrl+C停止")
        app.exec()
    else:
        sys.exit(1)