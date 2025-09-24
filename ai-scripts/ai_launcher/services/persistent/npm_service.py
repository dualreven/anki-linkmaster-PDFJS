#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NPM开发服务 - Vite前端开发服务器
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from ..base_service import BaseService


class NpmService(BaseService):
    """
    NPM开发服务 - 负责启动Vite前端开发服务器
    """

    def __init__(self, project_root: Path):
        """
        初始化NPM服务

        Args:
            project_root: 项目根目录
        """
        super().__init__("npm-dev-vite", project_root)

    def get_command(self, **kwargs) -> List[str]:
        """
        获取npm run dev启动命令

        Args:
            **kwargs: 启动参数（可包含port等）

        Returns:
            List[str]: 启动命令
        """
        if sys.platform == "win32":
            return ["cmd.exe", "/c", "npm run dev"]
        else:
            return ["npm", "run", "dev"]

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
            int: 默认端口3000
        """
        return 3000

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

        # 检查package.json是否存在
        package_json = self.project_root / "package.json"
        if not package_json.exists():
            self.logger.error(f"package.json not found at {package_json}")
            return False

        return True

    def setup_environment(self, **kwargs) -> Dict[str, str]:
        """
        设置环境变量

        Args:
            **kwargs: 启动参数

        Returns:
            Dict[str, str]: 环境变量
        """
        env = super().setup_environment(**kwargs)

        # 设置Vite端口 - 强制使用ai-launcher指定的端口
        port = kwargs.get("port", self.get_default_port())
        if port:
            env["VITE_PORT"] = str(port)
            # 禁用Vite自动端口选择
            env["VITE_STRICT_PORT"] = "true"
            # 额外确保端口不被更改
            env["PORT"] = str(port)

        self.logger.info(f"NPM Service will use fixed port: {port}")
        return env

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
        port = kwargs.get("port", self.get_default_port())
        return f"http://localhost:{port}/pdf-home/"

    def get_startup_dependencies(self) -> List[str]:
        """
        获取启动依赖

        Returns:
            List[str]: 依赖服务列表（NPM服务通常没有依赖）
        """
        return []

    def get_configuration_template(self) -> Dict[str, any]:
        """
        获取配置模板

        Returns:
            Dict: NPM服务特定配置
        """
        config = super().get_configuration_template()
        config.update({
            "service_type": "frontend",
            "auto_port_selection": True,  # Vite会自动选择可用端口
            "build_command": "npm run build",
            "preview_command": "npm run preview",
            "health_check": {
                "enabled": True,
                "path": "/pdf-home/",
                "timeout": 5
            }
        })
        return config