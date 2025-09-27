#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试模块 - 系统调试和诊断模块
提供系统信息收集、日志分析等功能
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from ..base_service import BaseService


class DebugModule(BaseService):
    """
    调试模块 - 系统调试和诊断工具
    """

    def __init__(self, project_root: Path):
        """
        初始化调试模块

        Args:
            project_root: 项目根目录
        """
        super().__init__("debug-module", project_root)

    def get_command(self, **kwargs) -> List[str]:
        """
        获取调试模块启动命令

        Args:
            **kwargs: 启动参数

        Returns:
            List[str]: 启动命令
        """
        python_executable = sys.executable

        # 创建调试脚本
        debug_script_content = '''#!/usr/bin/env python3
import os
import sys
import time
import json
import psutil
import platform
from pathlib import Path

def collect_system_info():
    """收集系统信息"""
    info = {
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "architecture": platform.architecture(),
            "processor": platform.processor()
        },
        "python": {
            "version": sys.version,
            "executable": sys.executable,
            "path": sys.path[:3]  # 只显示前3个路径
        },
        "system_resources": {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total if os.name != 'nt' else psutil.disk_usage('C:').total,
                "free": psutil.disk_usage('/').free if os.name != 'nt' else psutil.disk_usage('C:').free,
                "percent": psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:').percent
            }
        }
    }
    return info

def check_project_status(project_root):
    """检查项目状态"""
    project_path = Path(project_root)

    status = {
        "project_root": str(project_path),
        "exists": project_path.exists(),
        "logs_dir": {
            "exists": (project_path / "logs").exists(),
            "files": []
        },
        "services_dir": {
            "exists": (project_path / "src" / "backend" / "services").exists(),
            "files": []
        }
    }

    # 检查日志文件
    logs_dir = project_path / "logs"
    if logs_dir.exists():
        status["logs_dir"]["files"] = [f.name for f in logs_dir.glob("*.log")]

    # 检查服务文件
    services_dir = project_path / "src" / "backend" / "services"
    if services_dir.exists():
        status["services_dir"]["files"] = [f.name for f in services_dir.glob("*.py")]

    return status

def main():
    print("=== AI Launcher Debug Module ===")
    print("Collecting system information...")

    project_root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    # 收集系统信息
    system_info = collect_system_info()
    print("System Info:")
    print(json.dumps(system_info, indent=2))

    print("\\nChecking project status...")

    # 检查项目状态
    project_status = check_project_status(project_root)
    print("Project Status:")
    print(json.dumps(project_status, indent=2))

    print("\\nDebug module completed successfully!")

if __name__ == "__main__":
    main()
'''

        # 创建临时调试脚本
        debug_script_path = self.project_root / "temp_debug_module.py"
        with open(debug_script_path, 'w', encoding='utf-8') as f:
            f.write(debug_script_content)

        return [python_executable, str(debug_script_path), str(self.project_root)]

    def get_working_directory(self) -> Path:
        """
        获取工作目录

        Returns:
            Path: 项目根目录
        """
        return self.project_root

    def get_default_port(self) -> Optional[int]:
        """
        获取默认端口（调试模块不需要端口）

        Returns:
            None: 调试模块不使用端口
        """
        return None

    def validate_parameters(self, **kwargs) -> bool:
        """
        验证启动参数

        Args:
            **kwargs: 启动参数

        Returns:
            bool: 参数是否有效
        """
        # 检查是否安装了psutil
        try:
            import psutil
        except ImportError:
            self.logger.error("psutil module is required for debug module. Install with: pip install psutil")
            return False

        return True

    def get_service_type(self) -> str:
        """
        获取服务类型

        Returns:
            str: 服务类型
        """
        return "module"

    def get_startup_dependencies(self) -> List[str]:
        """
        获取启动依赖

        Returns:
            List[str]: 依赖服务列表
        """
        return []  # 调试模块不依赖其他服务

    def get_configuration_template(self) -> Dict[str, any]:
        """
        获取配置模板

        Returns:
            Dict: 调试模块特定配置
        """
        config = super().get_configuration_template()
        config.update({
            "service_type": "diagnostic",
            "module_type": "debug",
            "one_shot": True,  # 一次性运行
            "cleanup_on_exit": True,
            "required_packages": ["psutil"],
            "features": [
                "system_info_collection",
                "project_status_check",
                "log_analysis",
                "resource_monitoring"
            ]
        })
        return config

    def cleanup(self):
        """
        清理临时文件
        """
        try:
            debug_script_path = self.project_root / "temp_debug_module.py"
            if debug_script_path.exists():
                debug_script_path.unlink()
                self.logger.info("Cleaned up temporary debug script")
        except Exception as e:
            self.logger.error(f"Failed to cleanup debug script: {e}")

    def stop(self, process_manager) -> bool:
        """
        停止模块并清理

        Args:
            process_manager: 进程管理器

        Returns:
            bool: 是否停止成功
        """
        success = super().stop(process_manager)

        # 清理临时文件
        self.cleanup()

        return success