#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
进程管理器 - 跨平台进程管理功能
处理进程启动、停止、状态检查和PID文件管理
"""

import os
import sys
import json
import time
import signal
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging


class ProcessManager:
    """
    进程管理器 - 负责所有进程相关操作
    """

    def __init__(self, logs_dir: Path):
        """
        初始化进程管理器

        Args:
            logs_dir: 日志目录路径
        """
        self.logs_dir = logs_dir
        self.persistent_process_file = logs_dir / "process-info-persistent.json"
        self.modules_process_file = logs_dir / "process-info-modules.json"

        # 确保日志目录存在
        self.logs_dir.mkdir(exist_ok=True)

        self.logger = logging.getLogger("ai-launcher.process-manager")

    def is_pid_running(self, pid: int) -> bool:
        """
        检查指定PID是否正在运行

        Args:
            pid: 进程ID

        Returns:
            bool: 进程是否在运行
        """
        if not isinstance(pid, int) or pid <= 0:
            return False

        try:
            if sys.platform == "win32":
                # Windows: 使用tasklist命令
                result = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {pid}"],
                    capture_output=True, text=True, check=False
                )
                return str(pid) in (result.stdout or "")
            else:
                # Unix/Linux: 发送0信号检查进程存在
                os.kill(pid, 0)
                return True
        except Exception:
            return False

    def kill_process(self, pid: int, service_name: str = "unknown") -> bool:
        """
        终止指定进程

        Args:
            pid: 进程ID
            service_name: 服务名称（用于日志）

        Returns:
            bool: 是否成功终止
        """
        if not self.is_pid_running(pid):
            self.logger.info(f"{service_name} (PID: {pid}) - already stopped")
            return True

        try:
            if sys.platform == "win32":
                # Windows: 使用taskkill终止进程树
                result = subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    check=False, capture_output=True
                )
                success = result.returncode == 0
            else:
                # Unix: 发送SIGTERM信号
                os.kill(pid, signal.SIGTERM)
                success = True

            if success:
                self.logger.info(f"Stopped {service_name} (PID: {pid})")
            else:
                self.logger.warning(f"Failed to stop {service_name} (PID: {pid})")

            return success

        except Exception as e:
            self.logger.error(f"Failed to stop {service_name} (PID: {pid}): {e}")
            return False

    def save_process_info(self, process_list: List[Dict[str, Any]],
                         process_type: str = "persistent") -> bool:
        """
        保存进程信息到文件

        Args:
            process_list: 进程信息列表
            process_type: 进程类型 ("persistent" 或 "modules")

        Returns:
            bool: 是否保存成功
        """
        try:
            process_file = (self.persistent_process_file
                          if process_type == "persistent"
                          else self.modules_process_file)

            with open(process_file, 'w', encoding='utf-8') as f:
                json.dump(process_list, f, indent=2, ensure_ascii=False)

            return True

        except Exception as e:
            self.logger.error(f"Failed to save {process_type} process info: {e}")
            return False

    def load_process_info(self, process_type: str = "persistent") -> List[Dict[str, Any]]:
        """
        从文件加载进程信息

        Args:
            process_type: 进程类型 ("persistent" 或 "modules")

        Returns:
            List[Dict]: 进程信息列表
        """
        try:
            process_file = (self.persistent_process_file
                          if process_type == "persistent"
                          else self.modules_process_file)

            if process_file.exists():
                with open(process_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []

        except Exception as e:
            self.logger.error(f"Failed to load {process_type} process info: {e}")
            return []

    def cleanup_process_file(self, process_type: str = "persistent") -> bool:
        """
        清理进程信息文件

        Args:
            process_type: 进程类型 ("persistent" 或 "modules")

        Returns:
            bool: 是否清理成功
        """
        try:
            process_file = (self.persistent_process_file
                          if process_type == "persistent"
                          else self.modules_process_file)

            if process_file.exists():
                process_file.unlink()
                self.logger.info(f"{process_type.capitalize()} process info file cleaned up")

            return True

        except Exception as e:
            self.logger.error(f"Failed to cleanup {process_type} process info file: {e}")
            return False

    def stop_all_processes(self, process_type: str = "persistent") -> int:
        """
        停止所有指定类型的进程

        Args:
            process_type: 进程类型 ("persistent" 或 "modules")

        Returns:
            int: 停止的进程数量
        """
        process_list = self.load_process_info(process_type)

        if not process_list:
            self.logger.info(f"No {process_type} services found to stop")
            return 0

        stopped_count = 0
        for process_info in process_list:
            pid = process_info.get("pid")
            service_name = process_info.get("name", "unknown")

            if self.kill_process(pid, service_name):
                stopped_count += 1

        # 清理进程信息文件
        self.cleanup_process_file(process_type)

        self.logger.info(f"Stopped {stopped_count} {process_type} services")
        return stopped_count

    def check_processes_status(self, process_type: str = "persistent") -> Dict[str, Any]:
        """
        检查进程状态

        Args:
            process_type: 进程类型 ("persistent" 或 "modules")

        Returns:
            Dict: 状态信息
        """
        process_list = self.load_process_info(process_type)

        if not process_list:
            return {
                "total": 0,
                "running": 0,
                "stopped": 0,
                "processes": []
            }

        running_count = 0
        status_list = []

        for process_info in process_list:
            pid = process_info.get("pid")
            service_name = process_info.get("name", "unknown")
            port = process_info.get("port")

            is_running = self.is_pid_running(pid)
            if is_running:
                running_count += 1
                self.logger.info(f"✓ {service_name} (PID: {pid}, Port: {port}) - Running")
            else:
                self.logger.warning(f"✗ {service_name} (PID: {pid}) - Stopped")

            status_list.append({
                "name": service_name,
                "pid": pid,
                "port": port,
                "running": is_running
            })

        total_count = len(process_list)
        stopped_count = total_count - running_count

        self.logger.info(f"{process_type.capitalize()} services running: {running_count}/{total_count}")

        return {
            "total": total_count,
            "running": running_count,
            "stopped": stopped_count,
            "processes": status_list
        }