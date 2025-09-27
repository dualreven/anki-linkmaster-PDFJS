#!/usr/bin/env python3
"""
Anki LinkMaster PDFJS 后端服务启动器

轻量级后端服务管理器，负责：
- 端口识别和管理 (命令行参数、配置文件、默认值、端口可用性检测)
- 进程管理 (创建、追踪、关闭)
- 服务控制 (start、stop、status)

从ai_launcher.py拆分的后端专用功能。
"""

import sys
import os
import json
import socket
import subprocess
import signal
import time
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

# 设置项目根目录
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent.parent
sys.path.insert(0, str(project_root))

# 确保logs目录存在
logs_dir = project_root / 'logs'
logs_dir.mkdir(parents=True, exist_ok=True)

# 配置日志 - 同时输出到控制台和文件
log_file = logs_dir / 'backend-launcher.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('backend-launcher')


class BackendPortManager:
    """后端服务端口管理器"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.runtime_ports_file = project_root / 'logs' / 'runtime-ports.json'

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
        """检查端口是否可用"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, port))
                return True
        except socket.error:
            return False

    def find_available_port(self, service_name: str, preferred_port: Optional[int] = None) -> int:
        """为服务查找可用端口"""
        if preferred_port and self.is_port_available(preferred_port):
            return preferred_port

        start_port, end_port = self.port_ranges.get(service_name, (8000, 9000))
        default_port = self.default_ports.get(service_name, start_port)

        # 先尝试默认端口
        if self.is_port_available(default_port):
            return default_port

        # 在范围内搜索
        for port in range(start_port, end_port + 1):
            if self.is_port_available(port):
                return port

        raise RuntimeError(f"无法找到可用端口给服务 {service_name}")

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
        """保存端口到配置文件"""
        try:
            self.runtime_ports_file.parent.mkdir(parents=True, exist_ok=True)

            # 更新元数据
            ports['_metadata'] = {
                'last_updated': time.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_by': 'backend-launcher',
                'version': '1.0'
            }

            with open(self.runtime_ports_file, 'w', encoding='utf-8') as f:
                json.dump(ports, f, ensure_ascii=False, indent=2)
            logger.info(f"端口配置已保存: {ports}")
        except Exception as e:
            logger.error(f"保存端口配置失败: {e}")

    def resolve_ports(self, args: argparse.Namespace) -> Dict[str, int]:
        """解析端口配置 (命令行 > 配置文件 > 默认值)"""
        # 1. 从配置文件加载
        runtime_ports = self.load_runtime_ports()

        # 2. 解析端口，优先级：命令行 > 配置文件 > 默认值
        ports = {}

        # 消息中心服务器端口（WebSocket）
        msgCenter_port = (args.msgCenter_port if hasattr(args, 'msgCenter_port') and args.msgCenter_port else
                         runtime_ports.get('msgCenter_port', self.default_ports['msgCenter_port']))
        ports['msgCenter_port'] = self.find_available_port('msgCenter_port', msgCenter_port)

        # PDF文件服务器端口
        pdfFileServer_port = (args.pdfFileServer_port if hasattr(args, 'pdfFileServer_port') and args.pdfFileServer_port else
                             runtime_ports.get('pdfFile_port', self.default_ports['pdfFile_port']))
        ports['pdfFile_port'] = self.find_available_port('pdfFile_port', pdfFileServer_port)

        logger.info(f"解析后的端口配置: {ports}")
        return ports


class BackendProcessManager:
    """后端进程管理器"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.logs_dir = project_root / 'logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        # 进程信息文件路径
        self.processes_info_file = self.logs_dir / 'backend-processes-info.json'

    def save_process_info(self, service_name: str, pid: int, port: int) -> None:
        """保存进程信息到JSON文件"""
        try:
            # 读取现有信息
            processes_info = self.load_processes_info()

            # 更新服务信息
            processes_info[service_name] = {
                "port": port,
                "pid": pid
            }

            # 保存到文件
            with open(self.processes_info_file, 'w', encoding='utf-8') as f:
                json.dump(processes_info, f, ensure_ascii=False, indent=2)

            logger.info(f"已保存 {service_name} 进程信息: PID={pid}, Port={port}")
        except Exception as e:
            logger.error(f"保存进程信息失败 {service_name}: {e}")

    def load_processes_info(self) -> Dict[str, Dict[str, int]]:
        """加载所有进程信息"""
        try:
            if self.processes_info_file.exists():
                with open(self.processes_info_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.debug(f"加载进程信息失败: {e}")
        return {}

    def remove_process_info(self, service_name: str) -> None:
        """从进程信息文件中删除服务信息"""
        try:
            processes_info = self.load_processes_info()
            if service_name in processes_info:
                del processes_info[service_name]

                # 如果没有进程信息了，删除整个文件
                if not processes_info:
                    if self.processes_info_file.exists():
                        self.processes_info_file.unlink()
                        logger.debug(f"已删除空的进程信息文件")
                else:
                    # 保存更新后的信息
                    with open(self.processes_info_file, 'w', encoding='utf-8') as f:
                        json.dump(processes_info, f, ensure_ascii=False, indent=2)

                logger.debug(f"已删除 {service_name} 进程信息")
        except Exception as e:
            logger.debug(f"删除进程信息失败 {service_name}: {e}")

    def load_pid(self, service_name: str) -> Optional[int]:
        """从进程信息文件加载进程ID"""
        processes_info = self.load_processes_info()
        service_info = processes_info.get(service_name, {})
        return service_info.get('pid')

    def is_process_running(self, pid: int) -> bool:
        """检查进程是否在运行"""
        try:
            if os.name == 'nt':  # Windows
                result = subprocess.run(['tasklist', '/FI', f'PID eq {pid}'],
                                      capture_output=True, text=True, timeout=5)
                return str(pid) in result.stdout
            else:  # Unix-like
                os.kill(pid, 0)
                return True
        except (subprocess.TimeoutExpired, ProcessLookupError, OSError):
            return False

    def kill_process(self, pid: int) -> bool:
        """终止进程"""
        try:
            if os.name == 'nt':  # Windows
                subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                             capture_output=True, timeout=10)
            else:  # Unix-like
                os.kill(pid, signal.SIGTERM)
                time.sleep(2)
                if self.is_process_running(pid):
                    os.kill(pid, signal.SIGKILL)

            logger.info(f"进程已终止: PID {pid}")
            return True
        except Exception as e:
            logger.error(f"终止进程失败 PID {pid}: {e}")
            return False

    def start_service(self, service_name: str, port: int) -> bool:
        """启动服务"""
        # 先停止已有进程
        self.stop_service(service_name)

        # 构建启动命令
        if service_name == 'msgCenter_server':
            cmd = [sys.executable, '-m', 'src.backend.msgCenter_server.standard_server',
                   '--port', str(port)]
        elif service_name == 'pdfFile-server':
            cmd = [sys.executable, '-m', 'src.backend.pdfFile_server',
                   '--port', str(port)]
        else:
            logger.error(f"未知服务: {service_name}")
            return False

        try:
            # 启动进程
            process = subprocess.Popen(
                cmd,
                cwd=self.project_root,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )

            # 检查进程是否成功启动
            time.sleep(1)
            if process.poll() is None:
                self.save_process_info(service_name, process.pid, port)
                logger.info(f"服务启动成功: {service_name} (PID: {process.pid}, Port: {port})")
                return True
            else:
                logger.error(f"服务启动失败: {service_name}")
                return False

        except Exception as e:
            logger.error(f"启动服务异常 {service_name}: {e}")
            return False

    def stop_service(self, service_name: str) -> bool:
        """停止服务"""
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
        """获取服务状态"""
        pid = self.load_pid(service_name)
        if not pid:
            return False, None

        if self.is_process_running(pid):
            return True, pid
        else:
            self.remove_process_info(service_name)
            return False, None


class BackendLauncher:
    """后端服务启动器主类"""

    def __init__(self):
        self.project_root = project_root
        self.port_manager = BackendPortManager(self.project_root)
        self.process_manager = BackendProcessManager(self.project_root)

    def start_services(self, args: argparse.Namespace) -> bool:
        """启动所有服务"""
        logger.info("=== 启动后端服务 ===")

        # 解析端口
        ports = self.port_manager.resolve_ports(args)

        # 启动服务
        success_count = 0
        services = ['msgCenter_server', 'pdfFile-server']

        for service in services:
            # 映射服务名到端口键
            if service == 'msgCenter_server':
                port_key = 'msgCenter_port'
            elif service == 'pdfFile-server':
                port_key = 'pdfFile_port'
            else:
                port_key = f"{service}_port"
            port = ports.get(port_key)

            if port and self.process_manager.start_service(service, port):
                success_count += 1
            else:
                logger.error(f"启动失败: {service}")

        # 保存端口配置
        if success_count > 0:
            self.port_manager.save_runtime_ports(ports)

        if success_count == len(services):
            logger.info("✅ 所有后端服务启动成功")
            return True
        else:
            logger.error(f"❌ 部分服务启动失败 ({success_count}/{len(services)})")
            return False

    def stop_services(self) -> bool:
        """停止所有服务"""
        logger.info("=== 停止后端服务 ===")

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
        """显示服务状态"""
        status = {}
        ports = self.port_manager.load_runtime_ports()

        services = ['msgCenter_server', 'pdfFile-server']

        for service in services:
            running, pid = self.process_manager.get_service_status(service)
            # 映射服务名到端口键
            if service == 'msgCenter_server':
                port_key = 'msgCenter_port'
            elif service == 'pdfFile-server':
                port_key = 'pdfFile_port'
            else:
                port_key = f"{service}_port"
            port = ports.get(port_key)

            if running and pid:
                status[service] = f"running (PID: {pid}, Port: {port})"
            else:
                status[service] = "stopped"

        return status


def parse_arguments() -> argparse.Namespace:
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="Anki LinkMaster PDFJS 后端服务启动器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python launcher.py start                                    # 启动所有后端服务
  python launcher.py start --msgCenter-port 8766            # 指定消息中心服务器端口
  python launcher.py start --pdfFileServer-port 8080         # 指定PDF文件服务器端口
  python launcher.py stop                                     # 停止所有服务
  python launcher.py status                                   # 查看服务状态
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    # start 命令
    start_parser = subparsers.add_parser('start', help='启动后端服务')
    start_parser.add_argument('--msgCenter-port', type=int, dest='msgCenter_port', help='消息中心服务器端口')
    start_parser.add_argument('--pdfFileServer-port', type=int, dest='pdfFileServer_port', help='PDF文件服务器端口')

    # stop 命令
    subparsers.add_parser('stop', help='停止后端服务')

    # status 命令
    subparsers.add_parser('status', help='查看服务状态')

    return parser.parse_args()


def main():
    """主函数"""
    args = parse_arguments()

    if not args.command:
        print("请指定命令: start, stop, 或 status")
        print("使用 --help 查看详细帮助")
        return 1

    launcher = BackendLauncher()

    try:
        if args.command == 'start':
            success = launcher.start_services(args)
            status = launcher.show_status()

            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)

            return 0 if success else 1

        elif args.command == 'stop':
            success = launcher.stop_services()
            status = launcher.show_status()

            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)

            return 0 if success else 1

        elif args.command == 'status':
            status = launcher.show_status()

            print("\n--- 服务状态 ---")
            print(json.dumps(status, ensure_ascii=False, indent=2))
            print("-" * 15)

            return 0

    except KeyboardInterrupt:
        logger.info("用户中断操作")
        return 1
    except Exception as e:
        logger.error(f"执行出错: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())