#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试模块 - 示例临时模块
用于演示模块系统的使用方法
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional
from ..base_service import BaseService


class TestModule(BaseService):
    """
    测试模块 - 简单的测试模块示例
    """

    def __init__(self, project_root: Path):
        """
        初始化测试模块

        Args:
            project_root: 项目根目录
        """
        super().__init__("test-module", project_root)

    def get_command(self, **kwargs) -> List[str]:
        """
        获取测试模块启动命令

        Args:
            **kwargs: 启动参数

        Returns:
            List[str]: 启动命令
        """
        python_executable = sys.executable

        # 创建一个简单的测试脚本
        test_script_content = '''#!/usr/bin/env python3
import time
import sys

print("Test Module Started!")
print(f"Python version: {sys.version}")
print(f"Arguments: {sys.argv[1:]}")

try:
    while True:
        print(f"Test module running... {time.strftime('%Y-%m-%d %H:%M:%S')}")
        time.sleep(5)
except KeyboardInterrupt:
    print("Test module stopped")
'''

        # 创建临时测试脚本
        test_script_path = self.project_root / "temp_test_module.py"
        with open(test_script_path, 'w', encoding='utf-8') as f:
            f.write(test_script_content)

        duration = kwargs.get("duration", 60)  # 默认运行60秒

        return [python_executable, str(test_script_path), f"--duration={duration}"]

    def get_working_directory(self) -> Path:
        """
        获取工作目录

        Returns:
            Path: 项目根目录
        """
        return self.project_root

    def get_default_port(self) -> Optional[int]:
        """
        获取默认端口（测试模块不需要端口）

        Returns:
            None: 测试模块不使用端口
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
        duration = kwargs.get("duration", 60)

        # 检查持续时间
        if not isinstance(duration, int) or duration <= 0:
            self.logger.error(f"Invalid duration: {duration}. Must be a positive integer")
            return False

        if duration > 3600:  # 最长1小时
            self.logger.error(f"Duration too long: {duration}. Maximum is 3600 seconds")
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
            List[str]: 依赖服务列表（测试模块不依赖其他服务）
        """
        return []

    def get_configuration_template(self) -> Dict[str, any]:
        """
        获取配置模板

        Returns:
            Dict: 测试模块特定配置
        """
        config = super().get_configuration_template()
        config.update({
            "service_type": "test",
            "module_type": "example",
            "default_duration": 60,
            "max_duration": 3600,
            "cleanup_on_exit": True,
            "parameters": {
                "duration": {
                    "type": "int",
                    "default": 60,
                    "min": 1,
                    "max": 3600,
                    "description": "Module run duration in seconds"
                }
            }
        })
        return config

    def cleanup(self):
        """
        清理临时文件
        """
        try:
            test_script_path = self.project_root / "temp_test_module.py"
            if test_script_path.exists():
                test_script_path.unlink()
                self.logger.info("Cleaned up temporary test script")
        except Exception as e:
            self.logger.error(f"Failed to cleanup test script: {e}")

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