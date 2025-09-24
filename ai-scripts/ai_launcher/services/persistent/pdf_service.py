#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF服务 - PDF文件传输服务器
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from ..base_service import BaseService


class PdfService(BaseService):
    """
    PDF服务 - 负责启动PDF文件传输服务器
    """

    def __init__(self, project_root: Path):
        """
        初始化PDF服务

        Args:
            project_root: 项目根目录
        """
        super().__init__("pdf-server", project_root)

    def get_command(self, **kwargs) -> List[str]:
        """
        获取PDF服务启动命令

        Args:
            **kwargs: 启动参数

        Returns:
            List[str]: 启动命令
        """
        python_executable = sys.executable
        pdf_server_path = self.project_root / "src" / "backend" / "services" / "pdf-server.py"

        host = kwargs.get("host", "127.0.0.1")
        port = kwargs.get("port", self.get_default_port())
        log_file = kwargs.get("log_file", self.project_root / "logs" / "pdf-server.log")

        return [
            python_executable,
            str(pdf_server_path),
            "--host", host,
            "--port", str(port),
            "--log-file", str(log_file)
        ]

    def get_working_directory(self) -> Path:
        """
        获取工作目录

        Returns:
            Path: 项目根目录
        """
        return self.project_root

    def get_default_port(self) -> Optional[int]:
        """
        获取默认端口

        Returns:
            int: 默认端口8080
        """
        return 8080

    def validate_parameters(self, **kwargs) -> bool:
        """
        验证启动参数

        Args:
            **kwargs: 启动参数

        Returns:
            bool: 参数是否有效
        """
        port = kwargs.get("port", self.get_default_port())

        # 检查端口范围
        if port is not None and (port < 1024 or port > 65535):
            self.logger.error(f"Invalid port: {port}. Must be between 1024-65535")
            return False

        # 检查PDF服务器脚本是否存在
        pdf_server_path = self.project_root / "src" / "backend" / "services" / "pdf-server.py"
        if not pdf_server_path.exists():
            self.logger.error(f"PDF server script not found at {pdf_server_path}")
            return False

        return True

    def get_service_type(self) -> str:
        """
        获取服务类型

        Returns:
            str: 服务类型
        """
        return "persistent"

    def get_health_check_url(self, **kwargs) -> Optional[str]:
        """
        获取健康检查URL

        Args:
            **kwargs: 启动参数

        Returns:
            str: 健康检查URL
        """
        host = kwargs.get("host", "127.0.0.1")
        port = kwargs.get("port", self.get_default_port())
        return f"http://{host}:{port}/api/health"

    def get_startup_dependencies(self) -> List[str]:
        """
        获取启动依赖

        Returns:
            List[str]: 依赖服务列表
        """
        return []  # PDF服务通常不依赖其他服务

    def wait_for_startup(self, timeout: int = 30) -> bool:
        """
        等待PDF服务启动完成

        Args:
            timeout: 超时时间（秒）

        Returns:
            bool: 是否启动成功
        """
        import time
        import requests

        if self.process is None:
            return False

        health_url = self.get_health_check_url()
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                response = requests.get(health_url, timeout=2)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        return True
            except Exception:
                pass

            time.sleep(1)

        return False

    def get_configuration_template(self) -> Dict[str, any]:
        """
        获取配置模板

        Returns:
            Dict: PDF服务特定配置
        """
        config = super().get_configuration_template()
        config.update({
            "service_type": "api",
            "protocol": "http",
            "max_file_size": "100MB",
            "allowed_extensions": [".pdf"],
            "upload_directory": "uploads/",
            "health_check": {
                "enabled": True,
                "path": "/api/health",
                "timeout": 5
            },
            "endpoints": [
                "/api/health",
                "/api/files",
                "/download/",
                "/pdf/"
            ]
        })
        return config