"""
HTTP文件服务器核心实现

提供HTTP服务器的启动、停止和管理功能。
支持单线程阻塞模式和多线程非阻塞模式。
"""

import os
import sys
import socketserver
import threading
import time
from pathlib import Path
from ..handlers.pdf_handler import PDFFileHandler
from ..config.settings import DEFAULT_PORT, DEFAULT_DATA_DIR
from ..utils.logging_config import get_logger


def run_server(port=DEFAULT_PORT, directory=None, blocking=True):
    """
    启动HTTP服务器（阻塞模式）

    Args:
        port (int): 服务器监听端口
        directory (str|Path): 服务目录路径
        blocking (bool): 是否阻塞运行，默认True

    Raises:
        OSError: 端口被占用或其他网络错误
        Exception: 其他服务器启动错误
    """
    logger = get_logger('http_server')

    # 确定服务目录
    if directory is None:
        directory = DEFAULT_DATA_DIR
    else:
        directory = Path(directory)

    logger.info(f"PDF服务器准备启动...")
    logger.info(f"端口: {port}")
    logger.info(f"服务目录: {directory}")

    # 确保服务目录存在
    directory.mkdir(parents=True, exist_ok=True)

    # 设置处理器的基目录
    PDFFileHandler.set_base_directory(directory)

    try:
        # 切换到服务目录（SimpleHTTPRequestHandler要求）
        original_cwd = os.getcwd()
        os.chdir(directory)

        # 创建TCP服务器
        logger.info(f"正在创建TCP服务器... 端口: {port}")
        with socketserver.TCPServer(("", port), PDFFileHandler) as httpd:
            logger.info(f"TCP服务器创建成功")
            logger.info(f"PDF服务器成功启动于 http://localhost:{port}/pdfs/")

            if blocking:
                try:
                    logger.info(f"开始监听请求...")
                    httpd.serve_forever()
                except KeyboardInterrupt:
                    logger.info("收到中断信号，正在停止服务器...")
                finally:
                    # 恢复原始工作目录
                    os.chdir(original_cwd)
            else:
                # 非阻塞模式，返回服务器实例
                return httpd

    except OSError as e:
        logger.error(f"端口 {port} 启动失败: {e}. 可能已被占用。")
        # 恢复原始工作目录
        try:
            os.chdir(original_cwd)
        except:
            pass
        raise
    except Exception as e:
        logger.error(f"服务器启动时发生未知错误: {e}", exc_info=True)
        # 恢复原始工作目录
        try:
            os.chdir(original_cwd)
        except:
            pass
        raise


class HttpFileServer:
    """
    HTTP文件服务器包装类

    提供面向对象的服务器管理接口，支持启动、停止和状态查询。
    主要用于与其他系统组件的集成。
    """

    def __init__(self, port=DEFAULT_PORT, directory=None):
        """
        初始化HTTP文件服务器

        Args:
            port (int): 服务器端口，默认8080
            directory (str|Path): 服务目录路径，默认使用配置中的路径
        """
        self.port = port
        self.directory = Path(directory) if directory else DEFAULT_DATA_DIR
        self.server = None
        self.server_thread = None
        self.logger = get_logger('HttpFileServer')
        self._is_running = False

    def start(self):
        """
        启动HTTP服务器（非阻塞）

        在后台线程中启动服务器，不会阻塞调用线程。

        Returns:
            bool: 启动是否成功
        """
        if self._is_running:
            self.logger.warning("服务器已经在运行中")
            return True

        try:
            # 在单独线程中启动服务器
            self.server_thread = threading.Thread(
                target=self._run_server_thread,
                daemon=True
            )
            self.server_thread.start()

            # 等待服务器启动
            time.sleep(0.5)

            if self._is_running:
                self.logger.info(f"HttpFileServer started on port {self.port}")
                return True
            else:
                self.logger.error("服务器启动失败")
                return False

        except Exception as e:
            self.logger.error(f"Failed to start HttpFileServer: {e}")
            return False

    def stop(self):
        """
        停止HTTP服务器

        优雅地关闭服务器并清理资源。
        """
        if not self._is_running:
            self.logger.warning("服务器未在运行")
            return

        try:
            if self.server:
                self.server.shutdown()
                self.server.server_close()
                self.logger.info("HttpFileServer stopped")

            self._is_running = False
            self.server = None

        except Exception as e:
            self.logger.error(f"Error stopping HttpFileServer: {e}")

    def is_running(self):
        """
        检查服务器是否正在运行

        Returns:
            bool: 服务器运行状态
        """
        return self._is_running

    def get_status(self):
        """
        获取服务器状态信息

        Returns:
            dict: 包含服务器状态的字典
        """
        return {
            'running': self._is_running,
            'port': self.port,
            'directory': str(self.directory),
            'url': f"http://localhost:{self.port}/pdfs/" if self._is_running else None
        }

    def _run_server_thread(self):
        """
        在后台线程中运行服务器

        Private method to run the server in a background thread.
        """
        try:
            # 确保服务目录存在
            self.directory.mkdir(parents=True, exist_ok=True)

            # 设置处理器的基目录
            PDFFileHandler.set_base_directory(self.directory)

            # 切换到服务目录
            original_cwd = os.getcwd()
            os.chdir(self.directory)

            # 创建并启动服务器
            self.server = socketserver.TCPServer(("", self.port), PDFFileHandler)
            self._is_running = True

            self.logger.info(f"服务器线程启动，监听端口 {self.port}")
            self.server.serve_forever()

        except Exception as e:
            self.logger.error(f"服务器线程运行时出错: {e}")
        finally:
            self._is_running = False
            # 恢复原始工作目录
            try:
                os.chdir(original_cwd)
            except:
                pass