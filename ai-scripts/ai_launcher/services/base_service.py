#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务基类 - 定义服务接口和通用功能
所有具体服务都继承自此基类
"""

import os
import sys
import subprocess
import threading
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, Optional, List
import logging


class BaseService(ABC):
    """
    服务基类 - 定义服务的统一接口
    """

    def __init__(self, name: str, project_root: Path):
        """
        初始化服务

        Args:
            name: 服务名称
            project_root: 项目根目录
        """
        self.name = name
        self.project_root = project_root
        self.process: Optional[subprocess.Popen] = None
        self.log_thread: Optional[threading.Thread] = None
        self.logger = logging.getLogger(f"ai-launcher.{name}")

    @abstractmethod
    def get_command(self, **kwargs) -> List[str]:
        """
        获取启动命令

        Args:
            **kwargs: 启动参数

        Returns:
            List[str]: 命令列表
        """
        pass

    @abstractmethod
    def get_working_directory(self) -> Path:
        """
        获取工作目录

        Returns:
            Path: 工作目录路径
        """
        pass

    @abstractmethod
    def get_default_port(self) -> Optional[int]:
        """
        获取默认端口

        Returns:
            Optional[int]: 默认端口号
        """
        pass

    @abstractmethod
    def validate_parameters(self, **kwargs) -> bool:
        """
        验证启动参数

        Args:
            **kwargs: 启动参数

        Returns:
            bool: 参数是否有效
        """
        pass

    def setup_environment(self, **kwargs) -> Dict[str, str]:
        """
        设置环境变量

        Args:
            **kwargs: 启动参数

        Returns:
            Dict[str, str]: 环境变量字典
        """
        # 默认使用系统环境变量
        return os.environ.copy()

    def start(self, log_manager, **kwargs) -> bool:
        """
        启动服务

        Args:
            log_manager: 日志管理器
            **kwargs: 启动参数

        Returns:
            bool: 是否启动成功
        """
        try:
            # 验证参数
            if not self.validate_parameters(**kwargs):
                self.logger.error(f"Invalid parameters for {self.name}")
                return False

            # 获取启动命令
            command = self.get_command(**kwargs)
            working_dir = self.get_working_directory()
            env = self.setup_environment(**kwargs)

            self.logger.info(f"Starting {self.name}...")
            self.logger.debug(f"Command: {' '.join(command)}")
            self.logger.debug(f"Working directory: {working_dir}")

            # 启动进程
            self.process = subprocess.Popen(
                command,
                cwd=str(working_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                stdin=subprocess.DEVNULL
            )

            # 创建日志写入器
            log_file = log_manager.create_service_log_file(self.name)
            self.log_thread = log_manager.create_log_writer(
                self.process, log_file, self.name
            )

            self.logger.info(f"{self.name} started successfully (PID: {self.process.pid})")
            return True

        except Exception as e:
            self.logger.error(f"Failed to start {self.name}: {e}")
            return False

    def stop(self, process_manager) -> bool:
        """
        停止服务

        Args:
            process_manager: 进程管理器

        Returns:
            bool: 是否停止成功
        """
        if self.process is None:
            self.logger.info(f"{self.name} is not running")
            return True

        pid = self.process.pid
        return process_manager.kill_process(pid, self.name)

    def get_process_info(self, **kwargs) -> Dict[str, Any]:
        """
        获取进程信息

        Args:
            **kwargs: 启动参数

        Returns:
            Dict[str, Any]: 进程信息
        """
        if self.process is None:
            return {}

        return {
            "name": self.name,
            "pid": self.process.pid,
            "port": kwargs.get("port", self.get_default_port()),
            "type": self.get_service_type(),
            "command": self.get_command(**kwargs)
        }

    def get_service_type(self) -> str:
        """
        获取服务类型

        Returns:
            str: 服务类型
        """
        return "unknown"

    def is_running(self, process_manager) -> bool:
        """
        检查服务是否在运行

        Args:
            process_manager: 进程管理器

        Returns:
            bool: 是否在运行
        """
        if self.process is None:
            return False

        return process_manager.is_pid_running(self.process.pid)

    def get_health_check_url(self, **kwargs) -> Optional[str]:
        """
        获取健康检查URL（如果适用）

        Args:
            **kwargs: 启动参数

        Returns:
            Optional[str]: 健康检查URL
        """
        return None

    def wait_for_startup(self, timeout: int = 30) -> bool:
        """
        等待服务启动完成

        Args:
            timeout: 超时时间（秒）

        Returns:
            bool: 是否启动成功
        """
        import time
        import requests

        health_url = self.get_health_check_url()
        if health_url is None:
            # 没有健康检查URL，只等待进程启动
            time.sleep(2)
            return self.process is not None and self.process.poll() is None

        # 有健康检查URL，轮询检查
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(health_url, timeout=1)
                if response.status_code == 200:
                    return True
            except Exception:
                pass
            time.sleep(1)

        return False

    def get_startup_dependencies(self) -> List[str]:
        """
        获取启动依赖的服务列表

        Returns:
            List[str]: 依赖的服务名称列表
        """
        return []

    def get_configuration_template(self) -> Dict[str, Any]:
        """
        获取配置模板

        Returns:
            Dict[str, Any]: 配置模板
        """
        return {
            "name": self.name,
            "enabled": True,
            "auto_restart": False,
            "startup_timeout": 30,
            "shutdown_timeout": 10,
            "port": self.get_default_port(),
            "dependencies": self.get_startup_dependencies()
        }