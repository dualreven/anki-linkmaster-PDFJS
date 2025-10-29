# -*- coding: utf-8 -*-
import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from .ports import BackendPortManager
from .processes import BackendProcessManager

logger = logging.getLogger('backend-launcher')


class LegacyBackendLauncher:
    """
    旧版 CLI 启动器（子进程方式）
    说明：保持与原 src/backend/launcher.py 中 LegacyBackendLauncher 的行为一致，
    仅抽取至独立模块。
    """

    def __init__(self, project_root: Optional[Path] = None):
        # project_root 由调用方决定（保持与原入口一致）
        self.project_root = project_root or Path(__file__).resolve().parents[3]
        self.port_manager = BackendPortManager(self.project_root)
        self.process_manager = BackendProcessManager(self.project_root, self.port_manager)

    def start_services(self, args: argparse.Namespace) -> bool:
        logger.info("=== 启动后端服务 ===")
        services = ['msgCenter_server', 'pdfFile-server']

        # 清理已跟踪的服务进程
        logger.info("检查并清理已跟踪的服务进程...")
        for service in services:
            existing_pid = self.process_manager.load_pid(service)
            if existing_pid:
                if self.process_manager.is_process_running(existing_pid):
                    logger.info(f"🔄 清理已运行的服务: {service} (PID: {existing_pid})")
                    self.process_manager.stop_service(service)
                else:
                    logger.info(f"清理失效的进程信息: {service} (PID: {existing_pid})")
                    self.process_manager.remove_process_info(service)

        # 解析端口配置
        ports = self.port_manager.resolve_ports(args)

        # 启动服务
        success_count = 0
        for service in services:
            port_key = 'msgCenter_port' if service == 'msgCenter_server' else 'pdfFile_port'
            port = ports.get(port_key)

            db_path = getattr(args, 'db_path', None)
            runtime_mode = getattr(args, 'runtime_mode', None)
            ankiaddon_root_path = getattr(args, 'ankiaddon_root_path', None)
            data_dir = getattr(args, 'data_dir', None)

            if port and self.process_manager.start_service(
                service,
                port,
                db_path=db_path if service == 'msgCenter_server' else None,
                runtime_mode=runtime_mode if service == 'msgCenter_server' else None,
                ankiaddon_root_path=ankiaddon_root_path if service == 'msgCenter_server' else None,
                data_dir=data_dir if service == 'msgCenter_server' else None,
            ):
                success_count += 1
            else:
                if service == 'pdfFile-server':
                    logger.warning("pdfFile-server 启动失败，尝试切换端口后重试…")
                    try:
                        retries = 3
                        for i in range(retries):
                            preferred = (port + 1 + i) if port else None
                            cand = self.port_manager.find_available_port('pdfFile_port', preferred_port=preferred)
                            if cand == port:
                                continue
                            logger.info(f"重试使用端口 {cand} 启动 pdfFile-server …")
                            if self.process_manager.start_service(service, cand):
                                ports[port_key] = cand
                                success_count += 1
                                logger.info(f"✅ pdfFile-server 已改用端口 {cand} 启动成功")
                                break
                        else:
                            logger.error("多次尝试切换端口后仍启动失败: pdfFile-server")
                    except Exception as exc:
                        logger.error(f"自动切换端口重试时出错: {exc}")
                else:
                    logger.error(f"启动失败: {service}")

        if success_count > 0:
            self.port_manager.save_runtime_ports(ports)

        if success_count == len(services):
            logger.info("✅ 所有后端服务启动成功")
            return True
        else:
            logger.error(f"❌ 部分服务启动失败 ({success_count}/{len(services)})")
            return False

    def stop_services(self) -> bool:
        logger.info("=== 停止所有服务 ===")
        services = ['msgCenter_server', 'pdfFile-server']
        success_count = 0
        for service in services:
            if self.process_manager.stop_service(service):
                success_count += 1
        if success_count == len(services):
            logger.info("✅ 所有后端服务已停止")
            return True
        else:
            logger.warning(f"⚠️ 部分服务停止失败 ({success_count}/{len(services)})")
            return False

    def show_status(self) -> Dict[str, Any]:
        logger.info("=== 检查后端服务状态 ===")
        status: Dict[str, Any] = {}
        ports = self.port_manager.load_runtime_ports()
        services = ['msgCenter_server', 'pdfFile-server']

        for service in services:
            running, pid = self.process_manager.get_service_status(service)
            port_key = 'msgCenter_port' if service == 'msgCenter_server' else 'pdfFile_port'
            port = ports.get(port_key)

            if running and pid:
                status_str = f"✅ running (PID: {pid}, Port: {port})"
                if port and self.port_manager.is_port_listening(port):
                    logger.info(f"  {service}: {status_str}")
                else:
                    logger.warning(f"  {service}: ⚠️ 进程运行但端口 {port} 未监听")
                    status_str = f"⚠️ abnormal (PID: {pid}, Port: {port} - not listening)"
                status[service] = status_str
            else:
                status[service] = "❌ stopped"
                logger.info(f"  {service}: ❌ stopped")
                if port and not self.port_manager.is_port_available(port):
                    owner = self.port_manager.get_port_owner(port)
                    if owner:
                        logger.warning(f"    ⚠️ 端口 {port} 被占用: {owner}")

        ws_ports_to_check = [8765, 8766, 8767, 8783]
        logger.info("\n=== WebSocket端口状态检查 ===")
        for port in ws_ports_to_check:
            if not self.port_manager.is_port_available(port):
                owner = self.port_manager.get_port_owner(port)
                if port in [ports.get('msgCenter_port'), ports.get('pdfFile_port')]:
                    logger.info(f"  端口 {port}: 被本项目服务使用")
                else:
                    logger.warning(f"  端口 {port}: 被占用 - {owner or '未知进程'}")
        return status

