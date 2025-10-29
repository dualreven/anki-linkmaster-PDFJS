# -*- coding: utf-8 -*-
import json
import logging
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from .ports import BackendPortManager, _resolve_logs_dir

logger = logging.getLogger('backend-launcher')


def _is_process_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        if os.name == 'nt':
            # 通过 tasklist 判断
            proc = subprocess.run(
                ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV'],
                capture_output=True, encoding='utf-8', errors='replace', check=False
            )
            lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
            # 第一行是表头，长度>1 表示找到该 PID
            return len(lines) > 1
        else:
            # 向进程发送 0 信号测试是否存在
            os.kill(pid, 0)
            return True
    except Exception:
        return False


def _kill_process_tree(pid: int) -> bool:
    try:
        if os.name == 'nt':
            result = subprocess.run(
                ['taskkill', '/PID', str(pid), '/T', '/F'],
                capture_output=True, encoding='utf-8', errors='replace', check=False
            )
            return result.returncode == 0
        else:
            # 先尝试优雅终止
            try:
                os.kill(pid, signal.SIGTERM)
                time.sleep(0.5)
            except Exception:
                pass
            # 强制终止
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass
            return not _is_process_running(pid)
    except Exception:
        return False


class BackendProcessManager:
    """后端进程管理器"""

    def __init__(self, project_root: Path, port_manager: Optional[BackendPortManager] = None, logs_dir: Optional[Path] = None):
        self.project_root = project_root
        self.logs_dir = Path(logs_dir) if logs_dir else _resolve_logs_dir(self.project_root)
        self.port_manager = port_manager
        self.processes_info_file = self.logs_dir / 'backend-processes-info.json'

    def save_process_info(self, service_name: str, pid: int, port: int) -> None:
        try:
            processes_info = self.load_processes_info()
            processes_info[service_name] = {"port": port, "pid": pid}
            with open(self.processes_info_file, 'w', encoding='utf-8') as f:
                json.dump(processes_info, f, ensure_ascii=False, indent=2)
            logger.info(f"已保存 {service_name} 进程信息: PID={pid}, Port={port}")
        except Exception as e:
            logger.error(f"保存进程信息失败 {service_name}: {e}")

    def load_processes_info(self) -> Dict[str, Dict[str, int]]:
        try:
            if self.processes_info_file.exists():
                with open(self.processes_info_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.debug(f"加载进程信息失败: {e}")
        return {}

    def remove_process_info(self, service_name: str) -> None:
        try:
            processes_info = self.load_processes_info()
            if service_name in processes_info:
                del processes_info[service_name]
                if not processes_info:
                    if self.processes_info_file.exists():
                        self.processes_info_file.unlink()
                        logger.debug("已删除空的进程信息文件")
                else:
                    with open(self.processes_info_file, 'w', encoding='utf-8') as f:
                        json.dump(processes_info, f, ensure_ascii=False, indent=2)
                logger.debug(f"已删除 {service_name} 进程信息")
        except Exception as e:
            logger.debug(f"删除进程信息失败 {service_name}: {e}")

    def load_pid(self, service_name: str) -> Optional[int]:
        try:
            processes_info = self.load_processes_info()
            info = processes_info.get(service_name)
            if info and isinstance(info, dict):
                return int(info.get("pid")) if info.get("pid") is not None else None
        except Exception:
            return None
        return None

    def is_process_running(self, pid: int) -> bool:
        return _is_process_running(pid)

    def kill_process(self, pid: int) -> bool:
        return _kill_process_tree(pid)

    def start_service(self, service_name: str, port: int, *, db_path: Optional[str] = None,
                      runtime_mode: Optional[str] = None,
                      ankiaddon_root_path: Optional[str] = None,
                      data_dir: Optional[str] = None) -> bool:
        """启动服务（调用前应确保没有同名服务在运行）"""
        if service_name == 'msgCenter_server':
            # 使用包入口（__main__.py），而非直接模块文件
            cmd = [os.fspath(Path(os.sys.executable)), '-m', 'src.backend.msgCenter_server', '--port', str(port)]
            if db_path:
                cmd += ['--db-path', str(db_path)]
            if data_dir:
                cmd += ['--data-dir', str(data_dir)]
            if runtime_mode:
                cmd += ['--runtime-mode', str(runtime_mode)]
                if runtime_mode == 'anki' and ankiaddon_root_path:
                    cmd += ['--ankiaddon-root-path', str(ankiaddon_root_path)]
            if not db_path and not data_dir and not runtime_mode:
                cmd += ['--runtime-mode', 'single']
        elif service_name == 'pdfFile-server':
            cmd = [os.fspath(Path(os.sys.executable)), '-m', 'src.backend.pdfFile_server', '--port', str(port)]
        else:
            logger.error(f"❌ 未知服务: {service_name}")
            return False

        try:
            logger.info(f"🚀 正在启动服务 {service_name} 在端口 {port}...")
            service_log_file = self.logs_dir / f"{service_name}.log"
            log_handle = open(service_log_file, 'w', encoding='utf-8')

            creation_flags = 0
            if os.name == 'nt':
                try:
                    creation_flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore
                except AttributeError:
                    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore

            process = subprocess.Popen(
                cmd,
                cwd=self.project_root,
                stdout=log_handle,
                stderr=log_handle,
                stdin=subprocess.DEVNULL,
                creationflags=creation_flags
            )

            wait_time = 3.0 if service_name == 'pdfFile-server' else 1.5
            time.sleep(wait_time)
            if process.poll() is None:
                self.save_process_info(service_name, process.pid, port)
                logger.info(f"✅ 服务启动成功: {service_name} (PID: {process.pid}, Port: {port})")
                if self.port_manager and self.port_manager.is_port_listening(port):
                    logger.info(f"✅ 确认端口 {port} 正在监听")
                else:
                    logger.warning(f"⚠️ 服务已启动但端口 {port} 未监听，服务可能还在初始化")
                return True
            else:
                logger.error(f"❌ 服务启动失败: {service_name} (进程已退出)")
                return False
        except Exception as e:
            logger.error(f"❌ 启动服务异常 {service_name}: {e}")
            return False

    def stop_service(self, service_name: str) -> bool:
        pid = self.load_pid(service_name)
        if not pid:
            logger.debug(f"服务未运行: {service_name}")
            return True
        if not self.is_process_running(pid):
            logger.debug(f"进程已不存在: {service_name} (PID: {pid})")
            self.remove_process_info(service_name)
            return True
        success = self.kill_process(pid)
        if success:
            self.remove_process_info(service_name)
        return success

    def get_service_status(self, service_name: str) -> Tuple[bool, Optional[int]]:
        """检查服务状态 (running?, pid)"""
        pid = self.load_pid(service_name)
        if pid and self.is_process_running(pid):
            return True, pid
        return False, None
