# -*- coding: utf-8 -*-
import json
import locale
import logging
import os
import socket
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger('backend-launcher')


def _resolve_logs_dir(base: Path) -> Path:
    """
    解析日志目录，支持通过 logs/gui-launcher-config.json 覆盖。
    优先读取 base/logs/gui-launcher-config.json 中的 paths.logs_dir，
    若声明有效路径则使用该目录；否则回退 base/logs。
    """
    try:
        cfg = base / 'logs' / 'gui-launcher-config.json'
        if cfg.exists():
            data = json.loads(cfg.read_text(encoding='utf-8') or '{}')
            logs_dir_decl = ((data.get('paths') or {}).get('logs_dir') or '').strip()
            if logs_dir_decl and logs_dir_decl.lower() not in ('none', 'null', 'undefined'):
                p = Path(logs_dir_decl).expanduser()
                p.mkdir(parents=True, exist_ok=True)
                return p
    except Exception:
        pass
    d = base / 'logs'
    d.mkdir(parents=True, exist_ok=True)
    return d


class BackendPortManager:
    """后端服务端口管理器"""

    def __init__(self, project_root: Path, *, logs_dir: Optional[Path] = None):
        self.project_root = project_root
        # 统一：若调用方提供 logs_dir，则 runtime-ports.json 必须写入该目录；否则回退到项目根 logs
        base_logs = Path(logs_dir) if logs_dir else (project_root / 'logs')
        self.runtime_ports_file = Path(base_logs) / 'runtime-ports.json'

        # 默认端口配置
        self.default_ports = {
            "msgCenter_port": 8765,
            "pdfFile_port": 8080
        }

        # 端口搜索范围
        self.port_ranges = {
            "msgCenter_port": (8765, 8800),
            "pdfFile_port": (8080, 8120)
        }

    def is_port_available(self, port: int, host: str = "127.0.0.1") -> bool:
        """检查端口是否可用（未被占用）"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex((host, port)) != 0
        except socket.error:
            return False

    def is_port_listening(self, port: int, host: str = "127.0.0.1", timeout: float = 0.5) -> bool:
        """检查端口是否正在监听（可以连接）"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout)
                return s.connect_ex((host, port)) == 0
        except socket.error:
            return False

    def get_port_owner(self, port: int) -> Optional[str]:
        """获取占用端口的进程信息（跨平台尽力而为，失败返回 None）"""
        try:
            system_encoding = locale.getpreferredencoding() or 'utf-8'
            if os.name == 'nt':  # Windows
                result = subprocess.run(
                    ['netstat', '-ano'],
                    capture_output=True,
                    encoding=system_encoding,
                    errors='replace',
                    check=False
                )
                for line in result.stdout.split('\n'):
                    if f':{port} ' in line and 'LISTENING' in line:
                        parts = line.split()
                        if parts:
                            pid = parts[-1]
                            try:
                                task_result = subprocess.run(
                                    ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV'],
                                    capture_output=True,
                                    encoding=system_encoding,
                                    errors='replace',
                                    check=False
                                )
                                lines = task_result.stdout.strip().split('\n')
                                if len(lines) > 1:
                                    process_name = lines[1].split(',')[0].strip('"')
                                    return f"{process_name} (PID: {pid})"
                            except Exception:
                                return f"Unknown Process (PID: {pid})"
            else:
                result = subprocess.run(
                    ['lsof', '-i', f':{port}'],
                    capture_output=True,
                    text=True,
                    check=False
                )
                lines = result.stdout.strip().split('\n')
                if len(lines) > 1:
                    parts = lines[1].split()
                    if len(parts) >= 2:
                        return f"{parts[0]} (PID: {parts[1]})"
        except Exception as e:
            logger.debug(f"无法获取端口 {port} 的占用信息: {e}")
        return None

    def find_available_port(self, service_name: str, preferred_port: Optional[int] = None) -> int:
        """为服务查找可用端口"""
        if preferred_port:
            if self.is_port_available(preferred_port):
                logger.info(f"✅ 端口 {preferred_port} 可用于服务 {service_name}")
                return preferred_port
            else:
                owner = self.get_port_owner(preferred_port)
                if owner:
                    logger.warning(f"⚠️ 端口 {preferred_port} 已被占用: {owner}")
                else:
                    logger.warning(f"⚠️ 端口 {preferred_port} 不可用")

        start_port, end_port = self.port_ranges.get(service_name, (8000, 9000))
        default_port = self.default_ports.get(service_name, start_port)

        # 先尝试默认端口
        if self.is_port_available(default_port):
            logger.info(f"✅ 使用默认端口 {default_port} 给服务 {service_name}")
            return default_port
        else:
            owner = self.get_port_owner(default_port)
            if owner:
                logger.warning(f"⚠️ 默认端口 {default_port} 已被占用: {owner}")

        logger.info(f"搜索可用端口范围 {start_port}-{end_port} 给服务 {service_name}")
        for port in range(start_port, end_port + 1):
            if self.is_port_available(port):
                logger.info(f"✅ 找到可用端口 {port} 给服务 {service_name}")
                return port

        raise RuntimeError(f"❌ 无法找到可用端口给服务 {service_name} (范围: {start_port}-{end_port})")

    def find_available_port_strict(self, service_name: str, port: int) -> int:
        """
        严格模式端口分配：不兜底，失败即报错

        Args:
            service_name: 服务名称（用于错误提示）
            port: 必须指定的端口

        Returns:
            int: 可用的端口号（与输入相同）

        Raises:
            ValueError: port 为 None 或无效
            RuntimeError: port 被占用
        """
        if port is None:
            raise ValueError(
                f"端口未指定：{service_name}\n"
                f"请通过 GUI 或 CLI 参数 --{service_name.replace('_', '-')} 传入"
            )

        if not isinstance(port, int) or port <= 0 or port > 65535:
            raise ValueError(
                f"端口无效：{service_name} = {port}\n"
                f"端口必须是 1-65535 之间的整数"
            )

        if self.is_port_available(port):
            logger.info(f"✅ 端口 {port} 可用于 {service_name}")
            return port

        # 端口被占用 → 报错（不兜底）
        owner = self.get_port_owner(port)
        raise RuntimeError(
            f"❌ 端口 {port} 已被占用 (service={service_name})\n"
            f"占用进程：{owner or 'Unknown'}\n"
            f"解决方案：\n"
            f"  1. 关闭占用进程\n"
            f"  2. 或通过 --{service_name.replace('_', '-')} 指定其他端口"
        )

    def load_runtime_ports(self) -> Dict[str, Any]:
        """从配置文件加载端口"""
        try:
            if self.runtime_ports_file.exists():
                with open(self.runtime_ports_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    logger.info(f"从配置文件加载端口: {data}")
                    return data
        except Exception as e:
            logger.warning(f"加载端口配置文件失败: {e}")
        return {}

    def save_runtime_ports(self, ports: Dict[str, Any]) -> None:
        """保存端口到配置文件（合并模式，保留其他服务的端口配置）"""
        try:
            self.runtime_ports_file.parent.mkdir(parents=True, exist_ok=True)

            existing_ports = self.load_runtime_ports()
            for key, value in ports.items():
                existing_ports[key] = value
            existing_ports['_metadata'] = {
                'last_updated': time.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_by': 'backend-launcher',
                'version': '1.0'
            }

            with open(self.runtime_ports_file, 'w', encoding='utf-8') as f:
                json.dump(existing_ports, f, ensure_ascii=False, indent=2)
            logger.info(f"端口配置已保存: {existing_ports}")
        except Exception as e:
            logger.error(f"保存端口配置失败: {e}")

    def resolve_ports(self, args) -> Dict[str, int]:
        """解析端口配置 (命令行 > 配置文件 > 默认值)"""
        runtime_ports = self.load_runtime_ports()
        ports: Dict[str, int] = {}
        msgCenter_port = (getattr(args, 'msgCenter_port', None) or
                          runtime_ports.get('msgCenter_port', self.default_ports['msgCenter_port']))
        ports['msgCenter_port'] = self.find_available_port('msgCenter_port', msgCenter_port)

        pdfFileServer_port = (getattr(args, 'pdfFileServer_port', None) or
                              runtime_ports.get('pdfFile_port', self.default_ports['pdfFile_port']))
        ports['pdfFile_port'] = self.find_available_port('pdfFile_port', pdfFileServer_port)

        # vite_port：只在开发模式时需要（命令行 > 配置文件）
        vite_port_arg = getattr(args, 'vite_port', None)
        vite_port_config = runtime_ports.get('vite_port') or runtime_ports.get('npm_port')  # 兼容旧键名
        if vite_port_arg or vite_port_config:
            ports['vite_port'] = vite_port_arg or vite_port_config

        logger.info(f"解析后的端口配置: {ports}")
        return ports

