"""
PDF文件HTTP请求处理器

继承自SimpleHTTPRequestHandler，提供PDF文件的HTTP访问服务，
支持CORS、Range请求、健康检查等功能。
"""

import http.server
import os
import mimetypes
from pathlib import Path
from ..config.settings import (
    HEALTH_CHECK_PATH, PDF_BASE_PATH, CORS_ENABLED,
    CORS_ORIGINS, CORS_METHODS, CORS_HEADERS,
    DEFAULT_DATA_DIR, SERVER_NAME
)
from ..utils.logging_config import get_logger


class PDFFileHandler(http.server.SimpleHTTPRequestHandler):
    """
    PDF文件HTTP请求处理器

    处理PDF文件的HTTP请求，支持以下功能：
    - PDF文件的GET请求处理
    - CORS跨域支持
    - Range请求支持（继承自SimpleHTTPRequestHandler）
    - 健康检查端点
    - 预检请求处理
    """

    # 类级别的基础目录设置
    base_dir = DEFAULT_DATA_DIR

    def __init__(self, *args, **kwargs):
        """
        初始化处理器

        Args:
            *args: 传递给父类的位置参数
            **kwargs: 传递给父类的关键字参数
        """
        self.logger = get_logger('PDFFileHandler')
        # 设置服务目录为基础目录
        super().__init__(*args, directory=str(self.base_dir), **kwargs)

    @classmethod
    def set_base_directory(cls, directory):
        """
        设置服务器的基础目录

        Args:
            directory (str|Path): 服务目录路径
        """
        cls.base_dir = Path(directory)

    def do_OPTIONS(self):
        """
        处理HTTP OPTIONS预检请求

        主要用于CORS跨域请求的预检验证。
        """
        self.logger.debug(f"处理OPTIONS请求: {self.path}")
        self.send_response(200, "OK")
        self._add_cors_headers()
        self.end_headers()

    def do_GET(self):
        """
        处理HTTP GET请求

        根据请求路径分发到不同的处理方法：
        - /health: 健康检查
        - /pdfs/: PDF文件访问
        - 其他: 404错误
        """
        self.logger.debug(f"处理GET请求: {self.path}")

        if self.path == HEALTH_CHECK_PATH:
            self.handle_health_check()
        elif self.path.startswith(PDF_BASE_PATH):
            self.handle_pdf_request()
        else:
            self.logger.warning(f"请求的路径不存在: {self.path}")
            self.send_error(404, "Not Found")

    def handle_health_check(self):
        """
        处理健康检查请求

        返回JSON格式的服务状态信息。
        """
        self.logger.debug("处理健康检查请求")
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self._add_cors_headers()
        self.end_headers()

        response_data = f'{{"status": "ok", "service": "{SERVER_NAME}"}}'
        self.wfile.write(response_data.encode('utf-8'))

    def handle_pdf_request(self):
        """
        处理PDF文件请求

        移除路径前缀后，委托给父类的GET处理方法。
        """
        # 移除/pdfs前缀，转换为相对路径
        original_path = self.path
        self.path = self.path[len(PDF_BASE_PATH) - 1:]  # 保留开头的/

        self.logger.debug(f"PDF请求路径转换: {original_path} -> {self.path}")

        try:
            # 委托给父类处理文件请求
            super().do_GET()
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            self.logger.error(f"处理PDF请求时出错: {e}")
            self.logger.error(f"错误堆栈: {error_traceback}")
            self.send_error(500, "Internal Server Error")

    def end_headers(self):
        """
        结束HTTP头部，添加CORS支持

        重写父类方法以添加CORS头部。
        """
        if CORS_ENABLED:
            self._add_cors_headers()
        super().end_headers()

    def _add_cors_headers(self):
        """
        添加CORS相关的HTTP头部

        Private method to add CORS headers based on configuration.
        """
        if not CORS_ENABLED:
            return

        # 设置允许的来源
        if '*' in CORS_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', '*')
        else:
            origin = self.headers.get('Origin')
            if origin in CORS_ORIGINS:
                self.send_header('Access-Control-Allow-Origin', origin)

        # 设置允许的方法
        if CORS_METHODS:
            methods = ', '.join(CORS_METHODS)
            self.send_header('Access-Control-Allow-Methods', methods)

        # 设置允许的头部
        if CORS_HEADERS:
            headers = ', '.join(CORS_HEADERS)
            self.send_header('Access-Control-Allow-Headers', headers)

    def log_message(self, format, *args):
        """
        重写日志消息方法

        将HTTP访问日志重定向到我们的日志系统。

        Args:
            format (str): 日志格式字符串
            *args: 格式化参数
        """
        message = format % args
        # 安全获取客户端地址，避免解包错误
        try:
            client_address = self.address_string()
        except (ValueError, TypeError):
            # 如果address_string()返回元组或其他格式，使用client_address属性
            try:
                client_address = f"{self.client_address[0]}:{self.client_address[1]}"
            except (AttributeError, IndexError, TypeError):
                client_address = "unknown"
        self.logger.info(f"[{client_address}] {message}")

    def guess_type(self, path):
        """
        重写文件类型猜测方法

        确保PDF文件返回正确的MIME类型。

        Args:
            path (str): 文件路径

        Returns:
            tuple: (mime_type, encoding)
        """
        # 安全地调用父类方法，处理可能的返回值格式差异
        try:
            result = super().guess_type(path)
            if isinstance(result, tuple):
                if len(result) >= 2:
                    mime_type, encoding = result[0], result[1]
                elif len(result) == 1:
                    mime_type, encoding = result[0], None
                else:
                    mime_type, encoding = None, None
            else:
                mime_type, encoding = result, None
        except (ValueError, TypeError) as e:
            self.logger.warning(f"父类guess_type方法异常: {e}, 使用默认值")
            mime_type, encoding = None, None

        # 确保PDF文件返回正确的MIME类型
        if path.lower().endswith('.pdf'):
            mime_type = 'application/pdf'

        return mime_type, encoding