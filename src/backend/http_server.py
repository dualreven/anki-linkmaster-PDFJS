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
        """启动HTTP服务器（增强诊断：尝试多个端口，最终回退到端口0由系统分配）"""
        try:
            import socket as _socket
            from pathlib import Path
            import datetime
            import platform

            # 端口可用性检测（快速检测预设端口是否可绑定）
            try:
                s = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
                s.setsockopt(_socket.SOL_SOCKET, _socket.SO_REUSEADDR, 1)
                s.bind(('127.0.0.1', int(self.port)))
                s.close()
                initial_port_check = True
            except Exception as e:
                initial_port_check = False
                logger.debug(f"初始端口 {self.port} 绑定检测失败: {e}")

            listen_ok = False
            listen_attempts = []

            # 候选端口：首选 self.port，再尝试常见备用端口，不要最后尝试 0（系统分配会导致端口不一致）
            try_ports = [int(self.port), 8082]

            for attempt_port in try_ports:
                listen_attempts.append(f"尝试端口: {attempt_port}")
                # 尝试多种 listen 签名以提高兼容性
                try:
                    from PyQt6.QtNetwork import QHostAddress
                    # 优先使用 QHostAddress.SpecialAddress.AnyIPv4
                    try:
                        listen_ok = self.server.listen(QHostAddress.SpecialAddress.AnyIPv4, attempt_port)
                        listen_attempts.append(f"listen(QHostAddress.SpecialAddress.AnyIPv4, {attempt_port}) -> {listen_ok}")
                    except Exception as ex1:
                        listen_attempts.append(f"listen(QHostAddress.SpecialAddress.AnyIPv4, {attempt_port}) raised {type(ex1).__name__}: {ex1}")
                        listen_ok = False
                        # 回退到 QHostAddress('127.0.0.1')
                        try:
                            listen_ok = self.server.listen(QHostAddress('127.0.0.1'), attempt_port)
                            listen_attempts.append(f"listen(QHostAddress('127.0.0.1'), {attempt_port}) -> {listen_ok}")
                        except Exception as ex2:
                            listen_attempts.append(f"listen(QHostAddress('127.0.0.1'), {attempt_port}) raised {type(ex2).__name__}: {ex2}")
                            listen_ok = False
                except Exception as e_qa:
                    # 如果无法导入 QHostAddress，也尝试无 QHostAddress 的签名
                    listen_attempts.append(f"无法导入 QHostAddress: {e_qa}")
                    listen_ok = False

                if not listen_ok:
                    try:
                        # 有些绑定接受直接传入端口
                        listen_ok = self.server.listen(attempt_port)
                        listen_attempts.append(f"listen({attempt_port}) -> {listen_ok}")
                    except Exception as ex2:
                        listen_attempts.append(f"listen({attempt_port}) raised {type(ex2).__name__}: {ex2}")
                        listen_ok = False

                if not listen_ok and attempt_port == 0:
                    # 最后尝试无参 listen()（有绑定在创建后需要无参）
                    try:
                        listen_ok = self.server.listen()
                        listen_attempts.append(f"listen() -> {listen_ok}")
                    except Exception as ex3:
                        listen_attempts.append(f"listen() raised {type(ex3).__name__}: {ex3}")
                        listen_ok = False

                if listen_ok:
                    # 更新实际端口（若 QTcpServer 提供 serverPort）
                    try:
                        actual_port = None
                        try:
                            actual_port = self.server.serverPort()
                        except Exception:
                            actual_port = attempt_port
                        # 如果 serverPort() 返回 0 for ephemeral, keep it
                        self.port = actual_port
                        listen_attempts.append(f"绑定成功: 实际端口 {self.port}")
                    except Exception as e_up:
                        listen_attempts.append(f"更新实际端口失败: {e_up}")
                    break

            if listen_ok:
                logger.info(f"HTTP文件服务器启动成功，端口: {self.port}")
                logger.info(f"文件服务地址: http://localhost:{self.port}/pdfs/")
                # 将实际监听端口写入到 logs/http-server-port.txt，供外部进程或启动器读取并同步代理配置
                try:
                    from pathlib import Path
                    Path('logs').mkdir(parents=True, exist_ok=True)
                    with open(Path('logs') / 'http-server-port.txt', 'w', encoding='utf-8') as pf:
                        pf.write(str(self.port))
                    logger.debug(f"已将实际端口写入 logs/http-server-port.txt: {self.port}")
                except Exception as port_e:
                    logger.warning(f"写入端口文件失败: {port_e}")
                return True

            # 失败路径：写入诊断日志
            try:
                Path('logs').mkdir(parents=True, exist_ok=True)
                diag = []
                diag.append(f"=== HTTP server start diagnostic at {datetime.datetime.now().isoformat()} ===")
                diag.append(f"attempted_ports: {try_ports}")
                diag.append(f"initial_port_check: {initial_port_check}")
                try:
                    is_listening = getattr(self.server, 'isListening', lambda: 'N/A')()
                except Exception as e:
                    is_listening = f"unavailable: {e}"
                diag.append(f"server.isListening(): {is_listening}")
                try:
                    addr = self.server.serverAddress().toString()
                    diag.append(f"server.serverAddress(): {addr}")
                except Exception as e:
                    diag.append(f"server.serverAddress(): unavailable: {e}")
                diag.append("listen_attempts:")
                diag.extend(listen_attempts)
                diag.append(f"platform: {platform.platform()}")
                diag.append(f"python: {platform.python_version()}")
                diag.append("")  # 结尾空行

                with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                    fh.write("\n".join(diag) + "\n\n")
            except Exception as e:
                logger.warning(f"写入诊断日志失败: {e}")

            logger.error("HTTP文件服务器启动失败（诊断已写入 logs/http-server-error.log）")
            return False

        except Exception:
            try:
                import traceback
                from pathlib import Path
                Path('logs').mkdir(parents=True, exist_ok=True)
                tb = traceback.format_exc()
                with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                    fh.write(f"==== HTTP server start exception at {__import__('datetime').datetime.now().isoformat()} ====\n")
                    fh.write(tb + "\n\n")
            except Exception:
                pass
            logger.exception("HTTP服务器启动异常")
            return False
    
    def handle_new_connection(self):
        """处理新的TCP连接"""
        socket = self.server.nextPendingConnection()
        if socket:
            socket.readyRead.connect(lambda: self.handle_request(socket))
            socket.disconnected.connect(socket.deleteLater)
    
    def handle_request(self, socket):
        """处理HTTP请求（含请求头解析）"""
        try:
            data = socket.readAll().data().decode('utf-8', errors='ignore')
            lines = data.split('\r\n')
            
            if not lines or not lines[0]:
                return
            
            # 解析请求行
            request_line = lines[0].split()
            if len(request_line) < 2:
                return
            
            method = request_line[0]
            path = request_line[1]
            
            # 解析请求头（简单解析，key -> lowercased）
            headers = {}
            idx = 1
            while idx < len(lines) and lines[idx]:
                parts = lines[idx].split(':', 1)
                if len(parts) == 2:
                    headers[parts[0].strip().lower()] = parts[1].strip()
                idx += 1
            
            if method == 'GET':
                if path.startswith('/pdfs/'):
                    self.handle_pdf_request(socket, path, headers)
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
            # 写入详细堆栈到专用日志，便于定位请求阶段的错误
            try:
                import traceback
                from pathlib import Path
                Path('logs').mkdir(parents=True, exist_ok=True)
                tb = traceback.format_exc()
                with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                    fh.write(f"==== handle_request exception at {__import__('datetime').datetime.now().isoformat()} ====\n")
                    fh.write(tb + "\n\n")
            except Exception as log_e:
                logger.warning(f"写入请求异常日志失败: {log_e}")
            try:
                self.send_response(socket, 500, 'Internal Server Error', '{"error": "Internal server error"}')
            except Exception:
                # 如果响应发送也失败，确保socket清理
                try:
                    socket.disconnectFromHost()
                except Exception:
                    pass
    
    def handle_pdf_request(self, socket, path, request_headers):
        """处理PDF文件请求，支持 HTTP Range"""
        try:
            filename = path.replace('/pdfs/', '')
            file_path = os.path.join(self.base_dir, 'data', 'pdfs', filename)
            
            if not os.path.exists(file_path):
                logger.warning(f"文件不存在: {file_path}")
                self.send_response(socket, 404, 'Not Found', '{"error": "File not found"}')
                return
            
            file_size = os.path.getsize(file_path)
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            
            range_header = request_headers.get('range')
            # 默认 headers
            base_headers = {
                'Content-Type': mime_type,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Accept-Ranges': 'bytes'
            }
            
            if range_header:
                # 解析 Range: bytes=start-end
                import re
                m = re.match(r'bytes=(\d*)-(\d*)', range_header)
                if not m:
                    # 无法解析的 Range，返回 416
                    logger.warning(f"无法解析的 Range 头: {range_header}")
                    headers = {'Content-Range': f"bytes */{file_size}", **base_headers}
                    self.send_response(socket, 416, 'Range Not Satisfiable', '{"error":"Range not satisfiable"}', headers)
                    return
                
                start_str, end_str = m.group(1), m.group(2)
                if start_str == '':
                    # suffix-byte-range-spec: bytes=-N (last N bytes)
                    suffix_length = int(end_str) if end_str else 0
                    if suffix_length == 0:
                        headers = {'Content-Range': f"bytes */{file_size}", **base_headers}
                        self.send_response(socket, 416, 'Range Not Satisfiable', '{"error":"Range not satisfiable"}', headers)
                        return
                    start = max(0, file_size - suffix_length)
                    end = file_size - 1
                else:
                    start = int(start_str)
                    end = int(end_str) if end_str else file_size - 1
                
                if start >= file_size or start < 0 or end < start:
                    headers = {'Content-Range': f"bytes */{file_size}", **base_headers}
                    self.send_response(socket, 416, 'Range Not Satisfiable', '{"error":"Range not satisfiable"}', headers)
                    return
                
                end = min(end, file_size - 1)
                chunk_size = end - start + 1
                
                # 读取指定区间
                with open(file_path, 'rb') as f:
                    f.seek(start)
                    chunk = f.read(chunk_size)
                
                headers = {
                    **base_headers,
                    'Content-Range': f'bytes {start}-{end}/{file_size}',
                    'Content-Length': str(len(chunk))
                }
                
                logger.info(f"提供部分内容: {filename} bytes {start}-{end}/{file_size}")
                self.send_response(socket, 206, 'Partial Content', chunk, headers)
                return
            
            # 无 Range 请求，返回整个文件
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            headers = {
                **base_headers,
                'Content-Length': str(len(file_data))
            }
            
            logger.info(f"成功提供文件: {filename} ({len(file_data)} bytes)")
            self.send_response(socket, 200, 'OK', file_data, headers)
            
        except Exception as e:
            logger.error(f"文件请求处理失败: {str(e)}")
            # 写入详细堆栈到专用日志，便于定位文件请求阶段的错误
            try:
                import traceback
                from pathlib import Path
                Path('logs').mkdir(parents=True, exist_ok=True)
                tb = traceback.format_exc()
                with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                    fh.write(f"==== handle_pdf_request exception at {__import__('datetime').datetime.now().isoformat()} ====\n")
                    fh.write(tb + "\n\n")
            except Exception as log_e:
                logger.warning(f"写入请求异常日志失败: {log_e}")
            try:
                self.send_response(socket, 500, 'Internal Server Error', '{"error": "Internal server error"}')
            except Exception:
                try:
                    socket.disconnectFromHost()
                except Exception:
                    pass
    
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
        """发送HTTP响应。增加异常保护：在写入或断开阶段捕获异常并写入诊断日志，避免出现无日志的 500 情况。"""
        if headers is None:
            headers = {}
        
        if isinstance(body, str):
            body = body.encode('utf-8')
        
        # 确保关键头存在
        if 'Content-Type' not in headers:
            headers['Content-Type'] = 'text/plain; charset=utf-8'
        if 'Connection' not in headers:
            headers['Connection'] = 'close'
        
        response_lines = [
            f"HTTP/1.1 {status_code} {status_text}",
            f"Content-Length: {len(body)}"
        ]
        
        # 添加自定义头（保证头中的值为字符串）
        for key, value in headers.items():
            response_lines.append(f"{key}: {value}")
        
        response_lines.extend(['', ''])
        response_header = '\r\n'.join(response_lines)
        
        try:
            socket.write(response_header.encode('utf-8'))
            socket.write(body)
        except Exception as write_exc:
            # 将详细堆栈写入专用日志，便于后续定位
            try:
                import traceback
                from pathlib import Path
                Path('logs').mkdir(parents=True, exist_ok=True)
                tb = traceback.format_exc()
                with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                    fh.write(f"==== send_response write exception at {__import__('datetime').datetime.now().isoformat()} ====\n")
                    fh.write(tb + "\n\n")
            except Exception:
                # 如果写日志也失败，则记录到标准 logger
                logger.exception("send_response 写入阶段记录异常失败")
        finally:
            # 无论如何尝试断开连接（并捕获断开异常）
            try:
                socket.disconnectFromHost()
            except Exception as disc_exc:
                try:
                    import traceback
                    from pathlib import Path
                    Path('logs').mkdir(parents=True, exist_ok=True)
                    tb = traceback.format_exc()
                    with open(Path('logs') / 'http-server-error.log', 'a', encoding='utf-8') as fh:
                        fh.write(f"==== send_response disconnect exception at {__import__('datetime').datetime.now().isoformat()} ====\n")
                        fh.write(tb + "\n\n")
                except Exception:
                    logger.exception("send_response 断开阶段记录异常失败")
    
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