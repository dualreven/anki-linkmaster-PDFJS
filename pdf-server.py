#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立的PDF文件传输服务器
遵循项目的HTTP状态码规范和错误格式标准
负责处理PDF文件的上传、下载、页面传输等文件操作
"""

import os
import sys
import json
import logging
import argparse
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import traceback
import hashlib
import uuid


class PDFFileHandler(BaseHTTPRequestHandler):
    """
    PDF文件处理器
    遵循HTTP-STATUS-CODE-001和ERROR-FORMAT-COMM-001规范
    """

    def __init__(self, *args, **kwargs):
        self.logger = logging.getLogger("pdf-server")
        super().__init__(*args, **kwargs)

    def log_message(self, format, *args):
        """重写日志方法使用我们的logger"""
        self.logger.info(f"[HTTP] {self.address_string()} - {format % args}")

    def _send_json_response(self, status_code: int, data: Dict[str, Any] = None,
                           error: Dict[str, Any] = None, message: str = ""):
        """
        发送JSON格式的响应，遵循ERROR-FORMAT-COMM-001规范
        """
        response = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "success" if 200 <= status_code < 300 else "error",
            "code": status_code,
            "message": message,
            "data": data or {},
            "error": error
        }

        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

        response_json = json.dumps(response, ensure_ascii=False, indent=2)
        self.wfile.write(response_json.encode('utf-8'))

        # 记录响应日志
        self.logger.info(f"[RESPONSE] {status_code} {self.path} - {message}")

    def _send_file_response(self, file_path: Path, content_type: str = None):
        """
        发送文件响应
        """
        try:
            if not file_path.exists():
                self._send_json_response(404, error={"details": "File not found"}, message="File not found")
                return

            if not content_type:
                content_type, _ = mimetypes.guess_type(str(file_path))
                if not content_type:
                    content_type = 'application/octet-stream'

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(file_path.stat().st_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)

            self.logger.info(f"[FILE] Served {file_path} ({file_path.stat().st_size} bytes)")

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to serve file {file_path}: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="Internal server error")

    def do_OPTIONS(self):
        """处理CORS预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        """处理GET请求"""
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path
            query_params = parse_qs(parsed_url.query)

            self.logger.info(f"[REQUEST] GET {path}")

            if path == '/api/health':
                # 健康检查
                self._send_json_response(200, {"status": "healthy"}, message="PDF server is running")

            elif path == '/api/files':
                # 获取文件列表
                self._handle_list_files(query_params)

            elif path.startswith('/api/file/'):
                # 获取特定文件信息
                file_id = path.split('/')[-1]
                self._handle_get_file_info(file_id)

            elif path.startswith('/download/'):
                # 下载文件
                file_path = unquote(path[10:])  # 移除 '/download/' 前缀
                self._handle_download_file(file_path)

            elif path.startswith('/pdf/'):
                # PDF文件访问
                file_path = unquote(path[5:])  # 移除 '/pdf/' 前缀
                self._handle_pdf_access(file_path)

            else:
                self._send_json_response(404, error={"details": "Endpoint not found"}, message="Not found")

        except Exception as e:
            self.logger.error(f"[ERROR] GET request failed: {e}")
            traceback.print_exc()
            self._send_json_response(500, error={"details": str(e)}, message="Internal server error")

    def do_POST(self):
        """处理POST请求"""
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path

            self.logger.info(f"[REQUEST] POST {path}")

            if path == '/api/upload':
                # 上传文件
                self._handle_upload_file()
            else:
                self._send_json_response(404, error={"details": "Endpoint not found"}, message="Not found")

        except Exception as e:
            self.logger.error(f"[ERROR] POST request failed: {e}")
            traceback.print_exc()
            self._send_json_response(500, error={"details": str(e)}, message="Internal server error")

    def _handle_list_files(self, query_params: Dict[str, list]):
        """处理文件列表请求"""
        try:
            # 从配置中获取PDF目录（暂时硬编码，后续可配置）
            pdf_dirs = [
                Path("pdfs"),
                Path("data"),
                Path("temp")
            ]

            files = []
            for pdf_dir in pdf_dirs:
                if pdf_dir.exists():
                    for pdf_file in pdf_dir.glob("*.pdf"):
                        file_info = {
                            "id": hashlib.md5(str(pdf_file).encode()).hexdigest()[:8],
                            "filename": pdf_file.name,
                            "path": str(pdf_file),
                            "size": pdf_file.stat().st_size,
                            "modified": pdf_file.stat().st_mtime,
                            "directory": str(pdf_dir)
                        }
                        files.append(file_info)

            self._send_json_response(200, {"files": files}, message=f"Found {len(files)} PDF files")

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to list files: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="Failed to list files")

    def _handle_get_file_info(self, file_id: str):
        """获取特定文件信息"""
        try:
            # 简单的文件查找逻辑（实际应用中应该有文件索引）
            pdf_dirs = [Path("pdfs"), Path("data"), Path("temp")]

            for pdf_dir in pdf_dirs:
                if pdf_dir.exists():
                    for pdf_file in pdf_dir.glob("*.pdf"):
                        current_id = hashlib.md5(str(pdf_file).encode()).hexdigest()[:8]
                        if current_id == file_id:
                            file_info = {
                                "id": file_id,
                                "filename": pdf_file.name,
                                "path": str(pdf_file),
                                "size": pdf_file.stat().st_size,
                                "modified": pdf_file.stat().st_mtime,
                                "directory": str(pdf_dir),
                                "url": f"/pdf/{pdf_file.name}"
                            }
                            self._send_json_response(200, {"file": file_info}, message="File found")
                            return

            self._send_json_response(404, error={"details": "File not found"}, message="File not found")

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to get file info: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="Failed to get file info")

    def _handle_download_file(self, file_path: str):
        """处理文件下载"""
        try:
            # 安全检查：确保路径不包含危险字符
            if '..' in file_path or file_path.startswith('/'):
                self._send_json_response(400, error={"details": "Invalid file path"}, message="Invalid file path")
                return

            full_path = Path(file_path)
            if not full_path.exists():
                # 尝试在常见目录中查找
                search_dirs = [Path("pdfs"), Path("data"), Path("temp")]
                for search_dir in search_dirs:
                    potential_path = search_dir / file_path
                    if potential_path.exists():
                        full_path = potential_path
                        break

            self._send_file_response(full_path, 'application/pdf')

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to download file: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="Download failed")

    def _handle_pdf_access(self, file_path: str):
        """处理PDF文件访问"""
        try:
            # 类似下载，但专门用于PDF访问
            if '..' in file_path or file_path.startswith('/'):
                self._send_json_response(400, error={"details": "Invalid file path"}, message="Invalid file path")
                return

            full_path = Path(file_path)
            if not full_path.exists():
                search_dirs = [Path("pdfs"), Path("data"), Path("temp")]
                for search_dir in search_dirs:
                    potential_path = search_dir / file_path
                    if potential_path.exists():
                        full_path = potential_path
                        break

            self._send_file_response(full_path, 'application/pdf')

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to access PDF: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="PDF access failed")

    def _handle_upload_file(self):
        """处理文件上传"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, error={"details": "No content"}, message="No file content")
                return

            # 简单的上传处理（实际应用中需要更复杂的逻辑）
            upload_dir = Path("uploads")
            upload_dir.mkdir(exist_ok=True)

            filename = self.headers.get('X-Filename', f"upload_{uuid.uuid4().hex[:8]}.pdf")
            file_path = upload_dir / filename

            with open(file_path, 'wb') as f:
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(8192, remaining)
                    chunk = self.rfile.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)

            file_info = {
                "id": hashlib.md5(str(file_path).encode()).hexdigest()[:8],
                "filename": filename,
                "path": str(file_path),
                "size": file_path.stat().st_size
            }

            self._send_json_response(201, {"file": file_info}, message="File uploaded successfully")
            self.logger.info(f"[UPLOAD] File uploaded: {file_path} ({file_path.stat().st_size} bytes)")

        except Exception as e:
            self.logger.error(f"[ERROR] Failed to upload file: {e}")
            self._send_json_response(500, error={"details": str(e)}, message="Upload failed")


class PDFFileServer:
    """
    PDF文件服务器主类
    """

    def __init__(self, host="127.0.0.1", port=8080, log_file="logs/pdf-server.log"):
        self.host = host
        self.port = port
        self.log_file = Path(log_file)

        # 设置日志
        self._setup_logging()

        # HTTP服务器
        self.server = None

    def _setup_logging(self):
        """设置日志系统"""
        # 确保日志目录存在
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        # 配置日志格式
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )

        self.logger = logging.getLogger("pdf-server")

        # 清空日志文件并写入启动标记
        with open(self.log_file, 'w', encoding='utf-8') as f:
            timestamp = datetime.now(timezone.utc).isoformat()
            f.write(f'{timestamp} [INFO] pdf-server: PDF文件传输服务器启动\n')

    def start_server(self):
        """启动服务器"""
        try:
            self.logger.info(f"Starting PDF server on {self.host}:{self.port}")

            self.server = HTTPServer((self.host, self.port), PDFFileHandler)
            self.logger.info(f"PDF server started successfully on http://{self.host}:{self.port}")

            self.server.serve_forever()

        except KeyboardInterrupt:
            self.logger.info("PDF server interrupted by user")
            self.stop_server()
        except Exception as e:
            self.logger.error(f"Failed to start PDF server: {e}")
            raise

    def stop_server(self):
        """停止服务器"""
        if self.server:
            self.logger.info("Stopping PDF server...")
            self.server.shutdown()
            self.server.server_close()
            self.logger.info("PDF server stopped")


def main():
    """
    主函数
    """
    parser = argparse.ArgumentParser(description="PDF文件传输服务器")
    parser.add_argument("--host", default="127.0.0.1", help="服务器地址")
    parser.add_argument("--port", type=int, default=8080, help="服务器端口")
    parser.add_argument("--log-file", default="logs/pdf-server.log", help="日志文件路径")

    args = parser.parse_args()

    # 创建并启动服务器
    server = PDFFileServer(args.host, args.port, args.log_file)

    try:
        server.start_server()
    except KeyboardInterrupt:
        print("\n收到中断信号，正在停止服务器...")
    except Exception as e:
        print(f"服务器启动失败: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())