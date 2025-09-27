#!/usr/bin/env python3
"""
JavaScript Console Logger for PDF-Viewer - 简化版本

基于pdf-home简化版设计，专门为pdf-viewer模块定制，支持动态pdf-id命名。

特点：
1. 依赖Qt内置的javaScriptConsoleMessage回调
2. 无网络操作，启动稳定性高
3. 支持动态日志文件命名：pdf-viewer-<pdf-id>-js.log
4. 自动映射Qt日志级别到可读格式
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.qt.compat import QObject


class JSConsoleLogger(QObject):
    """JavaScript控制台日志记录器 - 专为PDF-Viewer设计."""

    def __init__(self, debug_port: int = 9223, log_file: Optional[str] = None, pdf_id: Optional[str] = None):
        super().__init__()
        self.debug_port = debug_port  # 保留参数兼容性，但不使用
        self.pdf_id = pdf_id or "empty"

        # 如果没有指定log_file，使用pdf-viewer命名约定
        if log_file:
            self.log_file = log_file
        else:
            self.log_file = str(Path.cwd() / 'logs' / f'pdf-viewer-{self.pdf_id}-js.log')

        self.running = False
        self._file_handler: Optional[logging.FileHandler] = None

        # 设置专用日志记录器
        self._setup_js_logger()

    def _setup_js_logger(self) -> None:
        """设置JavaScript控制台输出的专用日志记录器."""
        self.js_logger = logging.getLogger(f'pdf-viewer.js-console-{self.pdf_id}')
        self.js_logger.setLevel(logging.DEBUG)

        # 清除已有处理器
        self.js_logger.handlers.clear()

        # 创建文件处理器
        try:
            log_path = Path(self.log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)

            self._file_handler = logging.FileHandler(self.log_file, encoding='utf-8', mode='w')
            formatter = logging.Formatter('[%(asctime)s.%(msecs)03d][%(levelname)s] %(message)s',
                                        datefmt='%H:%M:%S')
            self._file_handler.setFormatter(formatter)
            self.js_logger.addHandler(self._file_handler)

            # 防止传播到根日志记录器
            self.js_logger.propagate = False

            # 写入启动标记
            self.js_logger.info(f'[BOOT] PDF-Viewer JSConsoleLogger initialized (pdf_id: {self.pdf_id}, network-free version)')
            print(f"Info: PDF-Viewer JSConsoleLogger initialized for pdf_id: {self.pdf_id}")

        except Exception as exc:
            print(f"Warning: Failed to setup PDF-Viewer JS logger file handler: {exc}")

    def start(self) -> bool:
        """启动简化版日志记录器（无网络操作）.

        Returns:
            bool: True (始终成功，因为没有网络操作)
        """
        if self.running:
            return True

        self.running = True

        print(f"Info: Started PDF-Viewer JS console logger (port {self.debug_port}, pdf_id: {self.pdf_id})")
        self.js_logger.info('[START] PDF-Viewer logger started (relies on MainWindow.javaScriptConsoleMessage)')

        # 提示用户这是简化版本
        self.js_logger.info('[NOTE] This version captures JS console via QWebEnginePage.javaScriptConsoleMessage')
        self.js_logger.info('[NOTE] Chrome DevTools Protocol features disabled for stability')

        return True

    def stop(self) -> None:
        """停止简化版日志记录器."""
        print(f"Info: Stopping PDF-Viewer JS console logger (pdf_id: {self.pdf_id})...")

        if self.running:
            self.js_logger.info('[STOP] PDF-Viewer JSConsoleLogger shutting down')

        self.running = False

        # 清理文件处理器
        if self._file_handler:
            try:
                self.js_logger.removeHandler(self._file_handler)
                self._file_handler.close()
                self._file_handler = None
            except Exception as exc:
                print(f"Warning: Error closing file handler: {exc}")

        print(f"Info: PDF-Viewer JS console logger stopped (pdf_id: {self.pdf_id})")

    def is_connected(self) -> bool:
        """检查是否"已连接"（简化版始终为True如果已启动）."""
        return self.running

    def log_message(self, level: str, message: str, source: str = "", line: int = 0) -> None:
        """手动记录一条消息（供MainWindow调用）.

        Args:
            level: 日志级别 (可以是Qt数字级别或字符串)
            message: 消息内容
            source: 来源文件（可选）
            line: 行号（可选）
        """
        if not self.running:
            return

        try:
            # Qt级别映射到可读字符串
            qt_level_mapping = {
                '0': 'INFO', 'InfoMessageLevel': 'INFO',
                '1': 'WARNING', 'WarningMessageLevel': 'WARNING',
                '2': 'ERROR', 'ErrorMessageLevel': 'ERROR',
                '3': 'CRITICAL', 'CriticalMessageLevel': 'CRITICAL'
            }

            # 获取映射后的级别名称
            level_str = qt_level_mapping.get(str(level), str(level).upper())

            # 格式化消息
            if source and line:
                formatted_msg = f"[{source}:{line}] {message}"
            else:
                formatted_msg = message

            # 映射到Python logging级别
            log_level = {
                'INFO': logging.INFO,
                'LOG': logging.INFO,
                'WARN': logging.WARNING,
                'WARNING': logging.WARNING,
                'ERROR': logging.ERROR,
                'CRITICAL': logging.CRITICAL,
                'DEBUG': logging.DEBUG
            }.get(level_str, logging.INFO)

            # 记录日志，显示映射后的级别名称
            self.js_logger.log(log_level, f"[{level_str}] {formatted_msg}")

        except Exception as exc:
            print(f"Error: Failed to log message: {exc}")


def main():
    """测试PDF-Viewer JS控制台日志记录器."""
    import sys
    from src.qt.compat import QApplication

    # 创建Qt应用程序
    try:
        app = QApplication(sys.argv)

        # 测试不同pdf_id
        test_pdf_id = sys.argv[1] if len(sys.argv) > 1 else "test-pdf"
        logger = JSConsoleLogger(pdf_id=test_pdf_id)

        # 测试启动
        if logger.start():
            print(f"✅ PDF-Viewer JS console logger started successfully for pdf_id: {test_pdf_id}")

            # 测试手动记录消息
            logger.log_message("INFO", f"Test message from PDF-Viewer logger (pdf_id: {test_pdf_id})")
            logger.log_message("ERROR", "Test error message", "app-core.js", 123)

            print("✅ Test messages logged")

            # 测试停止
            logger.stop()
            print("✅ PDF-Viewer JS console logger stopped successfully")

        else:
            print("❌ Failed to start PDF-Viewer JS console logger")
            sys.exit(1)

        print("🎉 All tests passed!")
        sys.exit(0)

    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)


if __name__ == '__main__':
    main()