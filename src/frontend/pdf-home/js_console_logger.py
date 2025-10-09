#!/usr/bin/env python3
"""
JavaScript Console Logger for PDF-Home

基于Qt javaScriptConsoleMessage的JavaScript控制台日志记录器，
提供稳定的日志记录功能，无需网络连接。

特点：
1. 依赖Qt内置的javaScriptConsoleMessage回调
2. 无网络操作，启动稳定性高
3. 支持所有控制台级别的消息捕获
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
    """JavaScript控制台日志记录器."""

    def __init__(self, debug_port: int = 9222, log_file: Optional[str] = None):
        super().__init__()
        self.debug_port = debug_port  # 保留参数兼容性，但不使用
        self.log_file = log_file or str(Path.cwd() / 'logs' / 'pdf-home-js.log')
        self.running = False
        self._file_handler: Optional[logging.FileHandler] = None

        # 设置专用日志记录器
        self._setup_js_logger()

    def _setup_js_logger(self) -> None:
        """设置JavaScript控制台输出的专用日志记录器."""
        self.js_logger = logging.getLogger('pdf-home.js-console')
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
            self.js_logger.info('[BOOT] JSConsoleLogger initialized')
            print("Info: JSConsoleLogger initialized")

        except Exception as exc:
            print(f"Warning: Failed to setup JS logger file handler: {exc}")

    def start(self) -> bool:
        """启动JavaScript控制台日志记录器.

        Returns:
            bool: True (始终成功)
        """
        if self.running:
            return True

        self.running = True

        print(f"Info: Started JS console logger (port {self.debug_port} - compatibility mode)")
        self.js_logger.info('[START] JS console logger started')
        self.js_logger.info('[MODE] Using Qt javaScriptConsoleMessage for console capture')

        return True

    def stop(self) -> None:
        """停止日志记录器."""
        print("Info: Stopping JS console logger...")

        if self.running:
            self.js_logger.info('[STOP] JSConsoleLogger shutting down')

        self.running = False

        # 清理文件处理器
        if self._file_handler:
            try:
                self.js_logger.removeHandler(self._file_handler)
                self._file_handler.close()
                self._file_handler = None
            except Exception as exc:
                print(f"Warning: Error closing file handler: {exc}")

        print("Info: JS console logger stopped")

    def is_connected(self) -> bool:
        """检查是否已启动."""
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

            # 简化日志级别前缀（处理JavaScriptConsoleMessageLevel）
            if 'JavaScriptConsoleMessageLevel' in str(level):
                if 'InfoMessageLevel' in str(level):
                    display_level = 'INFO'
                elif 'WarningMessageLevel' in str(level):
                    display_level = 'WARN'
                elif 'ErrorMessageLevel' in str(level):
                    display_level = 'ERROR'
                else:
                    display_level = level_str
            else:
                display_level = level_str

            # 解析消息内容，避免重复的时间戳和日志级别
            import re
            parsed_message = str(message)

            # 过滤 Qt/DevTools 探查本地资源的噪音（不影响其它错误）
            try:
                if 'Not allowed to load local resource: file:///' in parsed_message:
                    return
            except Exception:
                pass

            # 检查是否已有时间戳格式 [YYYY-MM-DDTHH:MM:SS.xxxZ]
            timestamp_pattern = r'^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]'
            timestamp_match = re.match(timestamp_pattern, parsed_message)
            if timestamp_match:
                # 移除时间戳，因为日志系统会添加自己的时间戳
                parsed_message = parsed_message[len(timestamp_match.group(0)):].strip()

            # 检查是否已有日志级别标记 [INFO]、[WARN]、[ERROR]、[DEBUG] 等
            level_pattern = r'^\[([A-Z]+)\]'
            level_match = re.match(level_pattern, parsed_message)
            if level_match:
                embedded_level = level_match.group(1)
                # 如果消息内已有级别，使用它而不是Qt级别
                if embedded_level in ['INFO', 'WARN', 'WARNING', 'ERROR', 'DEBUG', 'CRITICAL']:
                    display_level = embedded_level if embedded_level != 'WARNING' else 'WARN'
                    # 移除消息中的级别标记，避免重复
                    parsed_message = parsed_message[len(level_match.group(0)):].strip()

            # 格式化消息（简化源文件路径，只保留文件名和行号）
            if source and line:
                # 只提取文件名，去掉完整URL路径
                import os
                if '/' in str(source):
                    source_filename = str(source).split('/')[-1]
                else:
                    source_filename = str(source)
                formatted_msg = f"[{source_filename}:{line}] {parsed_message}"
            else:
                formatted_msg = parsed_message

            # 映射到Python logging级别
            log_level = {
                'INFO': logging.INFO,
                'LOG': logging.INFO,
                'WARN': logging.WARNING,
                'WARNING': logging.WARNING,
                'ERROR': logging.ERROR,
                'CRITICAL': logging.CRITICAL,
                'DEBUG': logging.DEBUG
            }.get(display_level, logging.INFO)

            # 记录日志（不再手动添加级别标记，formatter会自动添加）
            self.js_logger.log(log_level, formatted_msg)

        except Exception as exc:
            print(f"Error: Failed to log message: {exc}")


def main():
    """测试JS控制台日志记录器."""
    import sys
    from src.qt.compat import QApplication

    # 创建Qt应用程序
    try:
        app = QApplication(sys.argv)
        logger = JSConsoleLogger()

        # 测试启动
        if logger.start():
            print("✅ JS console logger started successfully")

            # 测试手动记录消息
            logger.log_message("INFO", "Test message from logger")
            logger.log_message("ERROR", "Test error message", "test.js", 42)

            print("✅ Test messages logged")

            # 测试停止
            logger.stop()
            print("✅ JS console logger stopped successfully")

        else:
            print("❌ Failed to start JS console logger")
            sys.exit(1)

        print("🎉 All tests passed!")
        sys.exit(0)

    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)


if __name__ == '__main__':
    main()
