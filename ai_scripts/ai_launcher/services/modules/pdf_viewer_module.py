#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Viewer模块 - 启动pdf-viewer应用
负责启动和管理pdf-viewer的PyQt界面
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from ..base_service import BaseService


class PDFViewerModule(BaseService):
    """
    PDF Viewer模块 - 负责启动pdf-viewer应用
    """

    def __init__(self, project_root: Path):
        """
        初始化PDF Viewer模块

        Args:
            project_root: 项目根目录
        """
        super().__init__("pdf-viewer", project_root)

    def get_command(self, **kwargs) -> List[str]:
        """
        获取pdf-viewer启动命令

        Args:
            **kwargs: 启动参数
                pdf_id: PDF ID (可选)
                port: Vite端口 (可选，默认3000)

        Returns:
            List[str]: 启动命令
        """
        python_executable = sys.executable
        app_script = self.project_root / "app.py"

        # 构建基础命令
        command = [python_executable, str(app_script), "--module", "pdf-viewer"]

        # 添加可选参数
        if "pdf_id" in kwargs:
            command.extend(["--pdf-id", str(kwargs["pdf_id"])])

        if "port" in kwargs:
            command.extend(["--port", str(kwargs["port"])])

        return command

    def get_log_file_name(self) -> str:
        """
        获取日志文件名

        Returns:
            str: 日志文件名
        """
        return "pdf-viewer-launcher.log"

    def get_process_info(self, **kwargs) -> Dict[str, any]:
        """
        获取进程信息

        Args:
            **kwargs: 启动参数

        Returns:
            Dict[str, any]: 进程信息
        """
        info = super().get_process_info(**kwargs)

        # 添加pdf-viewer特定信息
        if "pdf_id" in kwargs:
            info["pdf_id"] = kwargs["pdf_id"]

        return info

    def validate_environment(self) -> bool:
        """
        验证运行环境

        Returns:
            bool: 环境是否有效
        """
        # 检查app.py是否存在
        app_script = self.project_root / "app.py"
        if not app_script.exists():
            self.logger.error(f"app.py not found at {app_script}")
            return False

        # 检查src/backend目录
        backend_dir = self.project_root / "src" / "backend"
        if not backend_dir.exists():
            self.logger.error(f"Backend directory not found at {backend_dir}")
            return False

        return True

    def get_working_directory(self) -> Path:
        """
        获取工作目录

        Returns:
            Path: 工作目录路径
        """
        return self.project_root

    def get_default_port(self) -> Optional[int]:
        """
        获取默认端口

        Returns:
            Optional[int]: 默认端口号
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
        # 验证pdf_id格式（如果提供）
        if "pdf_id" in kwargs:
            pdf_id = kwargs["pdf_id"]
            if not isinstance(pdf_id, str) or not pdf_id.strip():
                self.logger.error("Invalid pdf_id format")
                return False

        # 验证端口号（如果提供）
        if "port" in kwargs:
            try:
                port = int(kwargs["port"])
                if port <= 0 or port > 65535:
                    self.logger.error(f"Invalid port number: {port}")
                    return False
            except (ValueError, TypeError):
                self.logger.error("Port must be a valid integer")
                return False

        return True

    def get_status_info(self) -> Dict[str, any]:
        """
        获取模块状态信息

        Returns:
            Dict[str, any]: 状态信息
        """
        status = super().get_status_info()

        # 添加pdf-viewer特定状态
        status["module_type"] = "pdf-viewer"
        status["description"] = "PDF Viewer查看界面"

        return status