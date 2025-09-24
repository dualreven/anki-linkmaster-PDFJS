#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
命令行解析器 - 处理AI Launcher的命令行参数
支持持久服务和模块管理
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, Any

from ..core.service_manager import ServiceManager
from ..core.module_manager import ModuleManager


class CommandParser:
    """
    命令行解析器 - 统一处理所有命令行操作
    """

    def __init__(self):
        """
        初始化命令解析器
        """
        self.project_root = Path(__file__).parent.parent.parent.parent.absolute()
        self.service_manager = ServiceManager(self.project_root)
        self.module_manager = ModuleManager(self.project_root)

        # 设置模块管理器的服务管理器引用
        self.module_manager.set_service_manager(self.service_manager)

    def create_parser(self) -> argparse.ArgumentParser:
        """
        创建命令行参数解析器

        Returns:
            argparse.ArgumentParser: 配置好的解析器
        """
        parser = argparse.ArgumentParser(
            description="AI Launcher - 模块化服务启动器",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例用法:
  持久服务管理:
    python ai-launcher.py start                    # 启动所有持久服务
    python ai-launcher.py stop                     # 停止所有服务
    python ai-launcher.py status                   # 查看服务状态

  模块管理:
    python ai-launcher.py start --module test      # 启动测试模块
    python ai-launcher.py start --module debug     # 启动调试模块
    python ai-launcher.py stop --module test       # 停止测试模块
    python ai-launcher.py status --module          # 查看模块状态

  端口配置:
    python ai-launcher.py start --npm-port 3001 --ws-port 8766
            """
        )

        # 主要操作
        parser.add_argument(
            "action",
            choices=["start", "stop", "status", "restart", "logs"],
            nargs="?",
            default="start",
            help="要执行的操作"
        )

        # 模块参数（关键新增）
        parser.add_argument(
            "--module",
            type=str,
            help="指定要操作的模块名称（不影响持久服务）"
        )

        # 持久服务端口配置
        parser.add_argument(
            "--npm-port",
            type=int,
            default=3000,
            help="NPM开发服务器端口（默认: 3000）"
        )

        parser.add_argument(
            "--ws-port",
            type=int,
            default=8765,
            help="WebSocket服务器端口（默认: 8765）"
        )

        parser.add_argument(
            "--pdf-port",
            type=int,
            default=8080,
            help="PDF服务器端口（默认: 8080）"
        )

        # 模块特定参数
        parser.add_argument(
            "--duration",
            type=int,
            default=60,
            help="模块运行时长（秒，仅适用于某些模块）"
        )

        parser.add_argument(
            "--pdf-id",
            type=str,
            help="PDF ID for pdf-viewer module (creates unique viewer instance)"
        )

        # 日志相关
        parser.add_argument(
            "--logs",
            type=str,
            help="查看指定服务的日志"
        )

        parser.add_argument(
            "--log-lines",
            type=int,
            default=50,
            help="显示的日志行数（默认: 50）"
        )

        # 调试选项
        parser.add_argument(
            "--verbose",
            "-v",
            action="store_true",
            help="详细输出"
        )

        parser.add_argument(
            "--list-modules",
            action="store_true",
            help="列出所有可用模块"
        )

        return parser

    def execute_command(self, args) -> int:
        """
        执行解析后的命令

        Args:
            args: 解析后的命令参数

        Returns:
            int: 退出代码
        """
        try:
            # 列出模块
            if args.list_modules:
                return self._list_modules()

            # 模块操作模式
            if args.module:
                return self._handle_module_command(args)
            else:
                # 持久服务操作模式
                return self._handle_service_command(args)

        except KeyboardInterrupt:
            print("\\n操作被用户中断")
            return 1
        except Exception as e:
            print(f"操作失败: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
            return 1

    def _handle_service_command(self, args) -> int:
        """
        处理持久服务命令

        Args:
            args: 命令参数

        Returns:
            int: 退出代码
        """
        if args.action == "start":
            success = self.service_manager.start_all_services(
                npm_port=args.npm_port,
                ws_port=args.ws_port,
                pdf_port=args.pdf_port
            )
            return 0 if success else 1

        elif args.action == "stop":
            stopped_count = self.service_manager.stop_all_services()
            return 0

        elif args.action == "status":
            status = self.service_manager.check_services_status()
            return 0

        elif args.action == "restart":
            # 重启所有持久服务
            self.service_manager.stop_all_services()
            import time
            time.sleep(3)
            success = self.service_manager.start_all_services(
                npm_port=args.npm_port,
                ws_port=args.ws_port,
                pdf_port=args.pdf_port
            )
            return 0 if success else 1

        elif args.action == "logs":
            if args.logs:
                logs = self.service_manager.get_service_logs(args.logs, args.log_lines)
                print(logs)
            else:
                print("请使用 --logs <service_name> 指定要查看的服务")
                return 1
            return 0

        else:
            print(f"未知操作: {args.action}")
            return 1

    def _handle_module_command(self, args) -> int:
        """
        处理模块命令

        Args:
            args: 命令参数

        Returns:
            int: 退出代码
        """
        if args.action == "start":
            # 启动指定模块（不影响持久服务）
            module_params = {
                "duration": args.duration
            }
            # 如果是pdf-viewer模块且指定了pdf-id，添加到参数中
            if args.module == "pdf-viewer" and hasattr(args, 'pdf_id') and args.pdf_id:
                module_params["pdf_id"] = args.pdf_id
            success = self.module_manager.start_module(args.module, **module_params)
            return 0 if success else 1

        elif args.action == "stop":
            success = self.module_manager.stop_module(args.module)
            return 0 if success else 1

        elif args.action == "status":
            if args.module == "all" or args.module is True:
                # 查看所有模块状态
                status = self.module_manager.check_modules_status()
            else:
                # 查看指定模块状态
                running_modules = self.module_manager.list_running_modules()
                if args.module in running_modules:
                    print(f"模块 {args.module} 正在运行")
                else:
                    print(f"模块 {args.module} 未运行")
            return 0

        elif args.action == "logs":
            logs = self.module_manager.get_module_logs(args.module, args.log_lines)
            print(logs)
            return 0

        else:
            print(f"模块不支持操作: {args.action}")
            return 1

    def _list_modules(self) -> int:
        """
        列出所有可用模块

        Returns:
            int: 退出代码
        """
        available_modules = self.module_manager.list_available_modules()
        running_modules = self.module_manager.list_running_modules()

        print("=== 可用模块 ===")
        for module in available_modules:
            status = "运行中" if module in running_modules else "未运行"
            print(f"  {module:<15} [{status}]")

        print(f"\\n总计: {len(available_modules)} 个模块可用，{len(running_modules)} 个正在运行")
        return 0


def main():
    """
    主入口函数
    """
    parser_instance = CommandParser()
    parser = parser_instance.create_parser()

    # 解析命令行参数
    args = parser.parse_args()

    # 特殊处理：如果只指定了--module但没有指定具体模块名，显示模块状态
    if hasattr(args, 'module') and args.module is not None and args.action == "status":
        if args.module == "":
            # 显示所有模块状态
            args.module = "all"

    # 执行命令
    exit_code = parser_instance.execute_command(args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()