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
    DEFAULT_DATA_DIR, DEFAULT_DIST_DIR, STATIC_ROUTE_PREFIXES, SERVER_NAME
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
        try:
            self.logger.info(f"[GET] {self.path}")
        except Exception:
            pass

        # 将根路径重定向到 /pdf-home/
        if self.path == "/":
            self.send_response(302)
            self.send_header("Location", "/pdf-home/")
            self.end_headers()
            return

        if self.path == HEALTH_CHECK_PATH:
            self.handle_health_check()
        elif self.path.startswith(PDF_BASE_PATH):
            self.handle_pdf_request()
        elif self._is_static_request(self.path):
            self.handle_static_request()
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

    def _is_static_request(self, path: str) -> bool:
        try:
            for prefix in STATIC_ROUTE_PREFIXES:
                if path.startswith(prefix):
                    return True
            # 允许直接访问 /index.html（落在 dist 根）
            if path == "/index.html":
                return True
        except Exception:
            return False
        return False

    def handle_static_request(self):
        """处理前端静态资源请求（生产 dist）。"""
        try:
            # 目录定位到 dist/latest
            self.directory = str(DEFAULT_DIST_DIR)

            # 规范化路径：/pdf-home/ 与 /pdf-viewer/ 目录请求默认转为 index.html
            if self.path.endswith("/") and (self.path.startswith("/pdf-home/") or self.path.startswith("/pdf-viewer/")):
                self.path = self.path + "index.html"

            # 将 /pdf-home/assets/* → /assets/*、/pdf-viewer/assets/* → /assets/*
            if self.path.startswith("/pdf-home/assets/"):
                self.path = "/assets/" + self.path[len("/pdf-home/assets/"):]
            elif self.path.startswith("/pdf-viewer/assets/"):
                self.path = "/assets/" + self.path[len("/pdf-viewer/assets/"):]

            # 将 /pdf-home/vendor/* → /vendor/*、/pdf-viewer/vendor/* → /vendor/*
            if self.path.startswith("/pdf-home/vendor/"):
                self.path = "/vendor/" + self.path[len("/pdf-home/vendor/"):]
            elif self.path.startswith("/pdf-viewer/vendor/"):
                self.path = "/vendor/" + self.path[len("/pdf-viewer/vendor/"):]

            # 将 /pdf-home/js/* → /js/*、/pdf-viewer/js/* → /js/*
            if self.path.startswith("/pdf-home/js/"):
                self.path = "/js/" + self.path[len("/pdf-home/js/"):]
            elif self.path.startswith("/pdf-viewer/js/"):
                self.path = "/js/" + self.path[len("/pdf-viewer/js/"):]

            # 记录映射后的目录与路径，便于调试
            try:
                self.logger.info(f"[STATIC] directory={self.directory} path={self.path}")
            except Exception:
                pass

            super().do_GET()
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            self.logger.error(f"处理静态资源请求时出错: {e}")
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
        重写文件类型猜测方法：返回一个合法的 MIME 字符串（而非元组）。

        注意：SimpleHTTPRequestHandler 期望的是 str 类型的 MIME 值。
        之前返回了 (mime, encoding) 元组，导致 Content-Type 形如
        "('application/javascript'" 被浏览器当作非法，从而触发模块脚本加载失败。
        """
        try:
            # 使用 mimetypes 直接推断（返回 (type, encoding)）
            mime_type, _ = mimetypes.guess_type(path)
        except Exception:
            mime_type = None

        p = str(path).lower()
        # 显式处理常见前端类型
        if p.endswith('.mjs') or p.endswith('.js'):
            return 'text/javascript'
        if p.endswith('.css'):
            return 'text/css'
        if p.endswith('.json'):
            return 'application/json'
        if p.endswith('.map'):
            return 'application/json'
        if p.endswith('.pdf'):
            return 'application/pdf'

        return mime_type or 'application/octet-stream'
