#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日志管理器 - 统一日志配置和管理
处理日志格式、ANSI码清理、日志轮转等功能
"""

import os
import sys
import re
import threading
import logging
from pathlib import Path
from typing import Optional, TextIO
from datetime import datetime, timezone


class LoggingManager:
    """
    日志管理器 - 负责所有日志相关操作
    """

    def __init__(self, logs_dir: Path):
        """
        初始化日志管理器

        Args:
            logs_dir: 日志目录路径
        """
        self.logs_dir = logs_dir
        self.logs_dir.mkdir(exist_ok=True)

    @staticmethod
    def strip_ansi_codes(text: str) -> str:
        """
        移除ANSI转义码

        Args:
            text: 包含ANSI码的文本

        Returns:
            str: 清理后的文本
        """
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    def setup_main_logging(self, log_name: str = "ai-launcher") -> logging.Logger:
        """
        设置主日志记录器

        Args:
            log_name: 日志名称

        Returns:
            logging.Logger: 配置好的日志记录器
        """
        log_file = self.logs_dir / f"{log_name}.log"

        # 清空日志文件并写入启动标记
        with open(log_file, 'w', encoding='utf-8') as f:
            timestamp = datetime.now(timezone.utc).isoformat()
            f.write(f'{timestamp} [INFO] {log_name}: AI Launcher启动\n')

        # 配置日志记录器
        logger = logging.getLogger(log_name)
        logger.setLevel(logging.INFO)

        # 清除已有的处理器
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)

        # 文件处理器
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
        file_handler.setFormatter(file_formatter)

        # 控制台处理器
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
        console_handler.setFormatter(console_formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

        return logger

    def create_log_writer(self, process, log_file: Path,
                         service_name: str) -> threading.Thread:
        """
        创建日志写入器线程

        Args:
            process: 子进程对象
            log_file: 日志文件路径
            service_name: 服务名称

        Returns:
            threading.Thread: 日志写入线程
        """
        def log_writer():
            """日志写入线程函数"""
            try:
                with open(log_file, "w", encoding="utf-8") as f:
                    # 写入启动标记
                    timestamp = datetime.now(timezone.utc).isoformat()
                    f.write(f'{timestamp} [INFO] {service_name}: 服务启动\n')
                    f.flush()

                    # 持续读取并写入日志
                    while True:
                        line = process.stdout.readline()
                        if not line:
                            break

                        # 清理ANSI码并写入
                        clean_line = self.strip_ansi_codes(line)
                        f.write(clean_line)
                        f.flush()

            except Exception as e:
                logger = logging.getLogger("ai-launcher.log-writer")
                logger.error(f"Log writer for {service_name} failed: {e}")

        thread = threading.Thread(
            target=log_writer,
            daemon=True,
            name=f"{service_name}-logger"
        )
        thread.start()
        return thread

    def create_service_log_file(self, service_name: str) -> Path:
        """
        创建服务日志文件路径

        Args:
            service_name: 服务名称

        Returns:
            Path: 日志文件路径
        """
        return self.logs_dir / f"{service_name}.log"

    def get_log_content(self, service_name: str,
                       lines: Optional[int] = None) -> str:
        """
        获取日志内容

        Args:
            service_name: 服务名称
            lines: 读取的行数（None表示全部）

        Returns:
            str: 日志内容
        """
        log_file = self.create_service_log_file(service_name)

        if not log_file.exists():
            return f"Log file for {service_name} not found"

        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                if lines is None:
                    return f.read()
                else:
                    # 读取最后N行
                    all_lines = f.readlines()
                    return ''.join(all_lines[-lines:])
        except Exception as e:
            return f"Error reading log for {service_name}: {e}"

    def cleanup_old_logs(self, days: int = 7) -> int:
        """
        清理旧日志文件

        Args:
            days: 保留天数

        Returns:
            int: 清理的文件数量
        """
        import time

        cutoff_time = time.time() - (days * 24 * 60 * 60)
        cleaned_count = 0

        try:
            for log_file in self.logs_dir.glob("*.log"):
                if log_file.stat().st_mtime < cutoff_time:
                    log_file.unlink()
                    cleaned_count += 1

            if cleaned_count > 0:
                logger = logging.getLogger("ai-launcher.log-cleanup")
                logger.info(f"Cleaned up {cleaned_count} old log files")

        except Exception as e:
            logger = logging.getLogger("ai-launcher.log-cleanup")
            logger.error(f"Failed to cleanup old logs: {e}")

        return cleaned_count

    def get_all_log_files(self) -> list[Path]:
        """
        获取所有日志文件列表

        Returns:
            List[Path]: 日志文件路径列表
        """
        return list(self.logs_dir.glob("*.log"))

    def rotate_log(self, service_name: str, max_size_mb: int = 10) -> bool:
        """
        日志轮转（如果文件过大）

        Args:
            service_name: 服务名称
            max_size_mb: 最大文件大小（MB）

        Returns:
            bool: 是否进行了轮转
        """
        log_file = self.create_service_log_file(service_name)

        if not log_file.exists():
            return False

        try:
            file_size_mb = log_file.stat().st_size / (1024 * 1024)

            if file_size_mb > max_size_mb:
                # 创建备份文件
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_file = self.logs_dir / f"{service_name}_{timestamp}.log"

                log_file.rename(backup_file)

                logger = logging.getLogger("ai-launcher.log-rotation")
                logger.info(f"Rotated log for {service_name}: {backup_file}")

                return True

        except Exception as e:
            logger = logging.getLogger("ai-launcher.log-rotation")
            logger.error(f"Failed to rotate log for {service_name}: {e}")

        return False