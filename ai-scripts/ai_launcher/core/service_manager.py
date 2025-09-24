#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
服务管理器 - 管理持久服务的生命周期
负责启动、停止、状态检查持久服务
"""

import time
from pathlib import Path
from typing import Dict, List, Any
import logging

from .process_manager import ProcessManager
from .logging_manager import LoggingManager
from .port_manager import PortManager
from ..services.persistent.npm_service import NpmService
from ..services.persistent.ws_service import WebSocketService
from ..services.persistent.pdf_service import PdfService


class ServiceManager:
    """
    服务管理器 - 管理持久服务（npm、websocket、pdf）
    """

    def __init__(self, project_root: Path):
        """
        初始化服务管理器

        Args:
            project_root: 项目根目录
        """
        self.project_root = project_root
        self.logs_dir = project_root / "logs"

        # 初始化管理器
        self.process_manager = ProcessManager(self.logs_dir)
        self.logging_manager = LoggingManager(self.logs_dir)
        self.port_manager = PortManager(project_root)

        # 设置主日志
        self.logger = self.logging_manager.setup_main_logging("ai-launcher")

        # 初始化持久服务
        self.services = {
            "npm": NpmService(project_root),
            "websocket": WebSocketService(project_root),
            "pdf": PdfService(project_root)
        }

        # 服务启动顺序（考虑依赖关系）
        self.startup_order = ["websocket", "pdf", "npm"]

    def start_all_services(self, npm_port: int = None,
                          ws_port: int = None, pdf_port: int = None) -> bool:
        """
        启动所有持久服务

        Args:
            npm_port: NPM服务端口 (可选，由端口管理器智能分配)
            ws_port: WebSocket服务端口 (可选，由端口管理器智能分配)
            pdf_port: PDF服务端口 (可选，由端口管理器智能分配)

        Returns:
            bool: 是否全部启动成功
        """
        self.logger.info("===================================")
        self.logger.info("AI Launcher - 智能端口分配服务架构")
        self.logger.info("===================================")

        # 检查并停止已存在的持久服务
        existing_processes = self.process_manager.load_process_info("persistent")
        if existing_processes:
            self.logger.info("检测到已存在的持久服务，先停止旧服务...")
            self.stop_all_services()
            time.sleep(2)  # 等待进程完全停止

        # 智能端口分配
        self.logger.info("开始智能端口分配...")
        requested_ports = {}
        if npm_port is not None:
            requested_ports["npm_port"] = npm_port
        if ws_port is not None:
            requested_ports["ws_port"] = ws_port
        if pdf_port is not None:
            requested_ports["pdf_port"] = pdf_port

        # 获取分配的端口
        allocated_ports = self.port_manager.allocate_ports(requested_ports)

        # 验证端口分配
        is_valid, errors = self.port_manager.validate_port_allocation(allocated_ports)
        if not is_valid:
            self.logger.error("端口分配验证失败:")
            for error in errors:
                self.logger.error(f"  - {error}")
            return False

        success_count = 0
        process_info_list = []

        # 服务启动参数 - 使用分配的端口
        service_params = {
            "npm": {"port": allocated_ports["npm_port"]},
            "websocket": {"port": allocated_ports["ws_port"]},
            "pdf": {"port": allocated_ports["pdf_port"]}
        }

        self.logger.info("最终端口分配:")
        for service_name, params in service_params.items():
            self.logger.info(f"  {service_name}: {params['port']}")

        # 按顺序启动服务
        for service_name in self.startup_order:
            service = self.services[service_name]
            params = service_params[service_name]

            self.logger.info(f"启动 {service.name}...")

            if service.start(self.logging_manager, **params):
                success_count += 1
                time.sleep(1)  # 等待服务稳定

                # 收集进程信息
                process_info = service.get_process_info(**params)
                if process_info:
                    process_info_list.append(process_info)

                self.logger.info(f"{service.name} 启动成功")
            else:
                self.logger.error(f"{service.name} 启动失败")

        # 保存进程信息到持久服务文件
        if process_info_list:
            self.process_manager.save_process_info(process_info_list, "persistent")

        self.logger.info("===================================")
        self.logger.info(f"服务启动完成: {success_count}/{len(self.startup_order)}")
        self.logger.info("===================================")

        if success_count == len(self.startup_order):
            self.logger.info("所有持久服务启动成功！")
            self.logger.info(f"前端服务: http://localhost:{allocated_ports['npm_port']}")
            self.logger.info(f"WebSocket服务: ws://localhost:{allocated_ports['ws_port']}")
            self.logger.info(f"PDF API服务: http://localhost:{allocated_ports['pdf_port']}")
            self.logger.info("日志文件:")
            for service_name in self.startup_order:
                service = self.services[service_name]
                self.logger.info(f"  - {service.name}.log")
            self.logger.info("  - ai-launcher.log")
            self.logger.info("端口配置已保存到 logs/runtime-ports.json")
            self.logger.info("持久服务在后台运行。使用 'python ai-launcher.py stop' 停止。")
            return True
        else:
            self.logger.error("部分持久服务启动失败！")
            # 启动失败时，重置端口配置
            self.port_manager.release_ports()
            return False

    def stop_all_services(self) -> int:
        """
        停止所有持久服务

        Returns:
            int: 停止的服务数量
        """
        self.logger.info("停止所有持久服务...")
        return self.process_manager.stop_all_processes("persistent")

    def check_services_status(self) -> Dict[str, Any]:
        """
        检查所有持久服务状态

        Returns:
            Dict[str, Any]: 服务状态信息
        """
        self.logger.info("检查持久服务状态...")
        return self.process_manager.check_processes_status("persistent")

    def start_missing_services(self, npm_port: int = 3000,
                              ws_port: int = 8765, pdf_port: int = 8080) -> bool:
        """
        仅启动未运行的基础服务（智能启动）

        Args:
            npm_port: NPM服务端口
            ws_port: WebSocket服务端口
            pdf_port: PDF服务端口

        Returns:
            bool: 是否启动成功
        """
        # 检查当前服务状态
        status = self.check_services_status()
        running_services = set()

        for process in status.get("processes", []):
            if process.get("running", False):
                running_services.add(process.get("name", ""))

        # 确定需要启动的服务
        services_to_start = []
        for service_name in self.startup_order:
            service = self.services[service_name]
            if service.name not in running_services:
                services_to_start.append(service_name)

        if not services_to_start:
            self.logger.info("所有基础服务已运行，无需启动新服务")
            return True

        self.logger.info(f"需要启动的服务: {services_to_start}")

        # 服务启动参数
        service_params = {
            "npm": {"port": npm_port},
            "websocket": {"port": ws_port},
            "pdf": {"port": pdf_port}
        }

        success_count = 0
        process_info_list = self.process_manager.load_process_info("persistent")

        # 仅启动缺失的服务
        for service_name in services_to_start:
            service = self.services[service_name]
            params = service_params[service_name]

            self.logger.info(f"启动 {service.name}...")

            if service.start(self.logging_manager, **params):
                success_count += 1
                time.sleep(1)  # 等待服务稳定

                # 收集进程信息
                process_info = service.get_process_info(**params)
                if process_info:
                    process_info_list.append(process_info)

                self.logger.info(f"{service.name} 启动成功")
            else:
                self.logger.error(f"{service.name} 启动失败")

        # 更新进程信息文件
        if process_info_list:
            self.process_manager.save_process_info(process_info_list, "persistent")

        if success_count == len(services_to_start):
            self.logger.info(f"所有缺失服务启动成功 ({success_count}/{len(services_to_start)})")
            return True
        else:
            self.logger.error(f"部分服务启动失败 ({success_count}/{len(services_to_start)})")
            return False

    def restart_service(self, service_name: str, **kwargs) -> bool:
        """
        重启指定服务

        Args:
            service_name: 服务名称
            **kwargs: 启动参数

        Returns:
            bool: 是否重启成功
        """
        if service_name not in self.services:
            self.logger.error(f"Unknown service: {service_name}")
            return False

        service = self.services[service_name]
        self.logger.info(f"重启服务: {service.name}")

        # 停止服务
        if not service.stop(self.process_manager):
            self.logger.error(f"Failed to stop {service.name}")
            return False

        time.sleep(2)  # 等待进程完全停止

        # 启动服务
        if service.start(self.logging_manager, **kwargs):
            self.logger.info(f"{service.name} 重启成功")

            # 更新进程信息
            process_info = service.get_process_info(**kwargs)
            if process_info:
                # 重新加载并更新进程信息列表
                process_list = self.process_manager.load_process_info("persistent")
                # 移除旧的同名服务信息
                process_list = [p for p in process_list if p.get("name") != service.name]
                # 添加新的服务信息
                process_list.append(process_info)
                self.process_manager.save_process_info(process_list, "persistent")

            return True
        else:
            self.logger.error(f"{service.name} 重启失败")
            return False

    def get_service_logs(self, service_name: str, lines: int = 50) -> str:
        """
        获取服务日志

        Args:
            service_name: 服务名称
            lines: 读取行数

        Returns:
            str: 日志内容
        """
        if service_name not in self.services:
            return f"Unknown service: {service_name}"

        service = self.services[service_name]
        return self.logging_manager.get_log_content(service.name, lines)

    def cleanup_old_logs(self, days: int = 7) -> int:
        """
        清理旧日志文件

        Args:
            days: 保留天数

        Returns:
            int: 清理的文件数量
        """
        return self.logging_manager.cleanup_old_logs(days)

    def get_all_services(self) -> Dict[str, Any]:
        """
        获取所有服务信息

        Returns:
            Dict[str, Any]: 服务信息
        """
        service_info = {}
        for name, service in self.services.items():
            service_info[name] = {
                "name": service.name,
                "type": service.get_service_type(),
                "default_port": service.get_default_port(),
                "dependencies": service.get_startup_dependencies(),
                "config_template": service.get_configuration_template()
            }
        return service_info