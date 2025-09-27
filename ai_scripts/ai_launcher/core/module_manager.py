#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
模块管理器 - 管理临时模块服务
负责启动、停止、管理临时模块，不影响持久服务
"""

import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

from .process_manager import ProcessManager
from .logging_manager import LoggingManager


class ModuleManager:
    """
    模块管理器 - 管理临时模块服务
    独立于持久服务，支持动态加载和管理
    """

    def __init__(self, project_root: Path):
        """
        初始化模块管理器

        Args:
            project_root: 项目根目录
        """
        self.project_root = project_root
        self.logs_dir = project_root / "logs"

        # 初始化管理器
        self.process_manager = ProcessManager(self.logs_dir)
        self.logging_manager = LoggingManager(self.logs_dir)

        # 设置日志
        self.logger = logging.getLogger("ai-launcher.module-manager")

        # 延迟初始化service_manager，避免循环导入
        self._service_manager = None

        # 可用模块注册表
        self.available_modules = {
            "test": self._create_test_module,
            "debug": self._create_debug_module,
            "pdf-home": self._create_pdf_home_module,
            "pdf-viewer": self._create_pdf_viewer_module,
            # 可以继续添加更多模块
        }

        # 当前运行的模块
        self.running_modules: Dict[str, Any] = {}

    def set_service_manager(self, service_manager):
        """
        设置服务管理器（避免循环导入）

        Args:
            service_manager: 服务管理器实例
        """
        self._service_manager = service_manager

    def _check_and_start_required_services(self, module_name: str) -> bool:
        """
        检查并启动模块所需的基础服务

        Args:
            module_name: 模块名称

        Returns:
            bool: 是否成功确保所有必需服务运行
        """
        if not self._service_manager:
            self.logger.warning("Service manager not available, skipping dependency check")
            return True

        # 检查当前基础服务状态
        self.logger.info("检查基础服务状态...")
        status = self._service_manager.check_services_status()

        # 解析状态信息，判断是否需要启动服务
        try:
            running_count = status.get("running", 0)
            total_count = status.get("total", 0)

            # 如果所有服务都在运行，则不需要启动
            if running_count > 0 and running_count == total_count:
                self.logger.info(f"基础服务已全部运行 ({running_count}/{total_count})，无需重新启动")
                return True

            # 如果有部分或全部服务未运行，则仅启动缺失的服务
            if running_count == 0:
                self.logger.info("检测到基础服务未启动，正在启动所有基础服务...")
            else:
                self.logger.info(f"检测到部分基础服务未运行 ({running_count}/{total_count})，正在启动缺失服务...")

            # 启动基础服务（仅启动未运行的服务）
            success = self._service_manager.start_missing_services()
            if success:
                self.logger.info("基础服务启动成功")
                # 等待服务完全启动
                import time
                time.sleep(3)
                return True
            else:
                self.logger.error("基础服务启动失败")
                return False

        except Exception as e:
            self.logger.error(f"检查基础服务时发生错误: {e}")
            # 尝试启动服务作为备用方案
            try:
                success = self._service_manager.start_missing_services()
                if success:
                    import time
                    time.sleep(3)
                    return True
            except Exception as e2:
                self.logger.error(f"启动基础服务失败: {e2}")
            return False

    def _sync_running_modules_state(self):
        """
        同步运行中模块的状态：从进程文件中检查实际运行的模块
        更新内存中的 running_modules 状态
        """
        try:
            # 从进程文件加载模块信息
            module_list = self.process_manager.load_process_info("modules")

            # 清空当前内存状态
            self.running_modules.clear()

            # 检查每个模块是否真的在运行，只保留运行中的模块
            running_module_processes = []
            for process_info in module_list:
                pid = process_info.get("pid")
                module_name = process_info.get("name", "").replace("-", "_")  # 转换名称格式

                # 从 service_name 中提取模块名称 (例如: "pdf-home" -> "pdf-home")
                service_name = process_info.get("name", "")
                if service_name in ["pdf-home", "pdf-viewer"]:  # 只处理我们关心的模块
                    if self.process_manager.is_pid_running(pid):
                        # 模块真的在运行，添加到内存状态
                        running_module_processes.append(process_info)

                        # 创建模块实例并添加到running_modules（用于后续操作）
                        if service_name == "pdf-home":
                            module_key = "pdf-home"
                        elif service_name == "pdf-viewer":
                            # 对于pdf-viewer，需要根据pdf_id生成不同的key
                            pdf_id = process_info.get("pdf_id")  # 从进程信息中获取pdf_id
                            module_key = self._get_pdf_viewer_module_key(pdf_id)
                        else:
                            continue

                        # pdf-home在available_modules中，pdf-viewer的各种实例也基于pdf-viewer模块
                        base_module = service_name if service_name in self.available_modules else "pdf-viewer"
                        if base_module in self.available_modules:
                            # 创建模块实例的引用（但不实际启动）
                            self.running_modules[module_key] = {
                                "pid": pid,
                                "name": service_name,
                                "pdf_id": process_info.get("pdf_id")  # 保存pdf_id信息
                            }
                            self.logger.debug(f"同步到运行中的模块: {module_key} (PID: {pid})")

            # 更新进程文件，移除已停止的模块
            if len(running_module_processes) != len(module_list):
                self.process_manager.save_process_info(running_module_processes, "modules")
                self.logger.debug(f"清理已停止的模块进程记录，保留 {len(running_module_processes)} 个运行中的模块")

        except Exception as e:
            self.logger.error(f"同步模块状态时发生错误: {e}")

    def _get_pdf_viewer_module_key(self, pdf_id=None):
        """
        获取PDF-Viewer模块的唯一键名

        Args:
            pdf_id: PDF ID，如果为None则表示空白viewer

        Returns:
            str: 模块的唯一键名
        """
        if pdf_id:
            return f"pdf-viewer-{pdf_id}"
        else:
            return "pdf-viewer-blank"

    def _stop_pdf_viewer_by_key(self, module_key):
        """
        根据模块键名停止特定的PDF-Viewer实例

        Args:
            module_key: 模块键名

        Returns:
            bool: 是否停止成功
        """
        if module_key not in self.running_modules:
            return True

        try:
            module_info = self.running_modules[module_key]

            if isinstance(module_info, dict):
                pid = module_info.get("pid")
                service_name = module_info.get("name")

                if self.process_manager.kill_process(pid, service_name):
                    del self.running_modules[module_key]

                    # 更新模块进程信息文件
                    module_list = self.process_manager.load_process_info("modules")
                    module_list = [m for m in module_list if not (
                        m.get("name") == service_name and m.get("pid") == pid
                    )]
                    self.process_manager.save_process_info(module_list, "modules")
                    return True
            return False

        except Exception as e:
            self.logger.error(f"停止PDF-Viewer实例时发生错误: {e}")
            return False

    def start_module(self, module_name: str, **kwargs) -> bool:
        """
        启动指定模块

        Args:
            module_name: 模块名称
            **kwargs: 启动参数

        Returns:
            bool: 是否启动成功
        """
        if module_name not in self.available_modules:
            self.logger.error(f"Unknown module: {module_name}")
            self.logger.info(f"Available modules: {list(self.available_modules.keys())}")
            return False

        # 首先同步模块状态：检查进程文件中是否有同名模块正在运行
        self._sync_running_modules_state()

        # 对于pdf-viewer模块，需要基于pdf-id进行唯一性检查
        if module_name == "pdf-viewer":
            module_key = self._get_pdf_viewer_module_key(kwargs.get("pdf_id"))
            if module_key in self.running_modules:
                self.logger.warning(f"PDF-Viewer with ID '{kwargs.get('pdf_id', 'blank')}' is already running, stopping it first...")
                # 先停止已运行的特定PDF-Viewer实例
                if not self._stop_pdf_viewer_by_key(module_key):
                    self.logger.error(f"Failed to stop existing PDF-Viewer instance")
                    return False
                self.logger.info(f"Successfully stopped existing PDF-Viewer instance")
        elif module_name in self.running_modules:
            self.logger.warning(f"Module {module_name} is already running, stopping it first...")
            # 先停止已运行的模块
            if not self.stop_module(module_name):
                self.logger.error(f"Failed to stop existing {module_name} module")
                return False
            self.logger.info(f"Successfully stopped existing {module_name} module")

        # 对于pdf-home和pdf-viewer模块，检查并启动基础服务
        if module_name in ["pdf-home", "pdf-viewer"]:
            self.logger.info(f"检查模块 {module_name} 的基础服务依赖...")
            if not self._check_and_start_required_services(module_name):
                self.logger.error(f"无法启动模块 {module_name} 所需的基础服务")
                return False

        self.logger.info(f"启动模块: {module_name}")

        try:
            # 创建模块实例
            module = self.available_modules[module_name](**kwargs)

            # 启动模块
            if module.start(self.logging_manager, **kwargs):
                # 对于pdf-viewer模块，使用特殊的key存储
                if module_name == "pdf-viewer":
                    module_key = self._get_pdf_viewer_module_key(kwargs.get("pdf_id"))
                else:
                    module_key = module_name

                self.running_modules[module_key] = module

                # 保存模块进程信息
                process_info = module.get_process_info(**kwargs)
                if process_info:
                    # 为pdf-viewer模块添加pdf_id信息
                    if module_name == "pdf-viewer":
                        process_info["pdf_id"] = kwargs.get("pdf_id")

                    # 加载现有模块信息
                    module_list = self.process_manager.load_process_info("modules")
                    module_list.append(process_info)
                    self.process_manager.save_process_info(module_list, "modules")

                self.logger.info(f"模块 {module_name} 启动成功")
                return True
            else:
                self.logger.error(f"模块 {module_name} 启动失败")
                return False

        except Exception as e:
            self.logger.error(f"Failed to start module {module_name}: {e}")
            return False

    def stop_module(self, module_name: str) -> bool:
        """
        停止指定模块

        Args:
            module_name: 模块名称

        Returns:
            bool: 是否停止成功
        """
        # 先同步模块状态
        self._sync_running_modules_state()

        if module_name not in self.running_modules:
            self.logger.warning(f"Module {module_name} is not running in memory")
            # 即使内存中没有，也尝试从进程文件中查找并停止
            return self._force_stop_module_by_name(module_name)

        self.logger.info(f"停止模块: {module_name}")

        try:
            module_info = self.running_modules[module_name]

            # 如果是字典格式（新的同步状态），直接通过PID停止进程
            if isinstance(module_info, dict):
                pid = module_info.get("pid")
                service_name = module_info.get("name")

                if self.process_manager.kill_process(pid, service_name):
                    # 从运行列表中移除
                    del self.running_modules[module_name]

                    # 更新模块进程信息文件
                    module_list = self.process_manager.load_process_info("modules")
                    # 移除该模块的信息
                    module_list = [m for m in module_list if m.get("name") != service_name]
                    self.process_manager.save_process_info(module_list, "modules")

                    self.logger.info(f"模块 {module_name} 停止成功")
                    return True
                else:
                    self.logger.error(f"模块 {module_name} 停止失败")
                    return False
            else:
                # 如果是模块实例（旧格式），使用原来的方法
                if module_info.stop(self.process_manager):
                    del self.running_modules[module_name]
                    module_list = self.process_manager.load_process_info("modules")
                    module_list = [m for m in module_list if m.get("name") != module_info.name]
                    self.process_manager.save_process_info(module_list, "modules")
                    self.logger.info(f"模块 {module_name} 停止成功")
                    return True
                else:
                    self.logger.error(f"模块 {module_name} 停止失败")
                    return False

        except Exception as e:
            self.logger.error(f"Failed to stop module {module_name}: {e}")
            return False

    def _force_stop_module_by_name(self, module_name: str) -> bool:
        """
        强制通过名称停止模块（从进程文件中查找）

        Args:
            module_name: 模块名称

        Returns:
            bool: 是否停止成功
        """
        try:
            module_list = self.process_manager.load_process_info("modules")
            service_name = module_name  # pdf-home -> pdf-home

            stopped_any = False
            remaining_modules = []

            for process_info in module_list:
                if process_info.get("name") == service_name:
                    pid = process_info.get("pid")
                    if self.process_manager.kill_process(pid, service_name):
                        self.logger.info(f"强制停止模块 {module_name} (PID: {pid})")
                        stopped_any = True
                    # 不论是否成功，都不加入remaining_modules（移除记录）
                else:
                    remaining_modules.append(process_info)

            # 更新进程文件
            self.process_manager.save_process_info(remaining_modules, "modules")

            return stopped_any

        except Exception as e:
            self.logger.error(f"强制停止模块时发生错误: {e}")
            return False

    def stop_all_modules(self) -> int:
        """
        停止所有模块

        Returns:
            int: 停止的模块数量
        """
        self.logger.info("停止所有模块...")
        stopped_count = self.process_manager.stop_all_processes("modules")

        # 清空运行模块列表
        self.running_modules.clear()

        return stopped_count

    def check_modules_status(self) -> Dict[str, Any]:
        """
        检查所有模块状态

        Returns:
            Dict[str, Any]: 模块状态信息
        """
        self.logger.info("检查模块状态...")
        return self.process_manager.check_processes_status("modules")

    def list_available_modules(self) -> List[str]:
        """
        获取可用模块列表

        Returns:
            List[str]: 可用模块名称列表
        """
        return list(self.available_modules.keys())

    def list_running_modules(self) -> List[str]:
        """
        获取运行中的模块列表

        Returns:
            List[str]: 运行中的模块名称列表
        """
        return list(self.running_modules.keys())

    def get_module_logs(self, module_name: str, lines: int = 50) -> str:
        """
        获取模块日志

        Args:
            module_name: 模块名称
            lines: 读取行数

        Returns:
            str: 日志内容
        """
        if module_name not in self.running_modules:
            return f"Module {module_name} is not running"

        module = self.running_modules[module_name]
        return self.logging_manager.get_log_content(module.name, lines)

    # 模块创建方法
    def _create_test_module(self, **kwargs):
        """创建测试模块"""
        from ..services.modules.test_module import TestModule
        return TestModule(self.project_root)

    def _create_debug_module(self, **kwargs):
        """创建调试模块"""
        from ..services.modules.debug_module import DebugModule
        return DebugModule(self.project_root)

    def _create_pdf_home_module(self, **kwargs):
        """创建pdf-home模块"""
        from ..services.modules.pdf_home_module import PDFHomeModule
        return PDFHomeModule(self.project_root)

    def _create_pdf_viewer_module(self, **kwargs):
        """创建pdf-viewer模块"""
        from ..services.modules.pdf_viewer_module import PDFViewerModule
        return PDFViewerModule(self.project_root)

    def register_module(self, name: str, creator_func):
        """
        注册新模块

        Args:
            name: 模块名称
            creator_func: 模块创建函数
        """
        self.available_modules[name] = creator_func
        self.logger.info(f"Registered new module: {name}")

    def unregister_module(self, name: str) -> bool:
        """
        注销模块

        Args:
            name: 模块名称

        Returns:
            bool: 是否注销成功
        """
        if name in self.available_modules:
            # 如果模块正在运行，先停止
            if name in self.running_modules:
                self.stop_module(name)

            del self.available_modules[name]
            self.logger.info(f"Unregistered module: {name}")
            return True
        else:
            self.logger.warning(f"Module {name} not found")
            return False