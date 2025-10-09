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

from core_utils.process_utils import kill_process_tree, is_process_running

# 确保logs目录存在
logs_dir = project_root / 'logs'
logs_dir.mkdir(parents=True, exist_ok=True)

# 配置日志 - 同时输出到控制台和文件
log_file = logs_dir / 'backend-launcher.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='w', encoding='utf-8'),  # 使用 'w' 模式每次重启清空日志
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
        """检查端口是否可用（未被占用）

        Returns:
            True: 端口可用（未被占用）
            False: 端口不可用（已被占用/正在监听）
        """
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind((host, port))
                return True
        except socket.error:
            return False

    def is_port_listening(self, port: int, host: str = "127.0.0.1", timeout: float = 0.5) -> bool:
        """检查端口是否正在监听（可以连接）

        Returns:
            True: 端口正在监听（可以建立连接）
            False: 端口未监听（无法建立连接）
        """
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout)
                result = s.connect_ex((host, port))
                return result == 0  # 0 表示连接成功
        except socket.error:
            return False

    def get_port_owner(self, port: int) -> Optional[str]:
        """获取占用端口的进程信息"""
        try:
            if os.name == 'nt':  # Windows
                result = subprocess.run(
                    ['netstat', '-ano'],
                    capture_output=True,
                    text=True,
                    check=False
                )
                for line in result.stdout.split('\n'):
                    if f':{port} ' in line and 'LISTENING' in line:
                        parts = line.split()
                        if parts:
                            pid = parts[-1]
                            try:
                                # 获取进程名称
                                task_result = subprocess.run(
                                    ['tasklist', '/FI', f'PID eq {pid}', '/FO', 'CSV'],
                                    capture_output=True,
                                    text=True,
                                    check=False
                                )
                                lines = task_result.stdout.strip().split('\n')
                                if len(lines) > 1:
                                    process_name = lines[1].split(',')[0].strip('"')
                                    return f"{process_name} (PID: {pid})"
                            except:
                                return f"Unknown Process (PID: {pid})"
            else:  # Linux/Mac
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

        # 在范围内搜索
        logger.info(f"搜索可用端口范围 {start_port}-{end_port} 给服务 {service_name}")
        for port in range(start_port, end_port + 1):
            if self.is_port_available(port):
                logger.info(f"✅ 找到可用端口 {port} 给服务 {service_name}")
                return port

        raise RuntimeError(f"❌ 无法找到可用端口给服务 {service_name} (范围: {start_port}-{end_port})")

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

    def __init__(self, project_root: Path, port_manager: Optional['BackendPortManager'] = None):
        self.project_root = project_root
        self.logs_dir = project_root / 'logs'
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.port_manager = port_manager

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
        return is_process_running(pid)

    def kill_process(self, pid: int) -> bool:
        """终止进程"""
        return kill_process_tree(pid)

    def start_service(self, service_name: str, port: int) -> bool:
        """启动服务

        注意: 调用此方法前应确保没有同名服务在运行
        """
        # 构建启动命令
        if service_name == 'msgCenter_server':
            cmd = [sys.executable, '-m', 'src.backend.msgCenter_server.standard_server',
                   '--port', str(port)]
        elif service_name == 'pdfFile-server':
            cmd = [sys.executable, '-m', 'src.backend.pdfFile_server',
                   '--port', str(port)]
        else:
            logger.error(f"❌ 未知服务: {service_name}")
            return False

        try:
            logger.info(f"🚀 正在启动服务 {service_name} 在端口 {port}...")

            # 为每个服务创建独立的日志文件（使用 'w' 模式每次重启清空日志）
            service_log_file = self.logs_dir / f"{service_name}.log"
            log_handle = open(service_log_file, 'w', encoding='utf-8')

            # 启动进程，输出重定向到服务日志文件
            process = subprocess.Popen(
                cmd,
                cwd=self.project_root,
                stdout=log_handle,
                stderr=log_handle,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )

            # 检查进程是否成功启动
            # PDF文件服务器需要更长的启动时间（切换目录、初始化TCP服务器等）
            wait_time = 3.0 if service_name == 'pdfFile-server' else 1.5
            time.sleep(wait_time)
            if process.poll() is None:
                self.save_process_info(service_name, process.pid, port)
                logger.info(f"✅ 服务启动成功: {service_name} (PID: {process.pid}, Port: {port})")
                # 验证端口是否真的被监听（使用连接测试）
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
        self.process_manager = BackendProcessManager(self.project_root, self.port_manager)

    def start_services(self, args: argparse.Namespace) -> bool:
        """启动所有服务"""
        logger.info("=== 启动后端服务 ===")

        # 第一步: 先停止所有已跟踪的服务进程
        services = ['msgCenter_server', 'pdfFile-server']
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

        # 第二步: 解析端口配置
        ports = self.port_manager.resolve_ports(args)

        # 第三步: 启动服务
        success_count = 0
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
                # 对 pdfFile-server 增强：若启动失败，自动尝试切换到下一个可用端口
                if service == 'pdfFile-server':
                    logger.warning("pdfFile-server 启动失败，尝试切换端口后重试…")
                    try:
                        # 基于当前端口向上查找优先可用端口
                        retries = 3
                        new_port = port
                        for i in range(retries):
                            preferred = (port + 1 + i) if port else None
                            cand = self.port_manager.find_available_port('pdfFile_port', preferred_port=preferred)
                            # 避免重复同一端口
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

        # 保存端口配置（可能包含自动切换后的端口）
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
        logger.info("=== 检查后端服务状态 ===")
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
                status_str = f"✅ running (PID: {pid}, Port: {port})"

                # 验证端口是否真的被监听（使用连接测试）
                if port and self.port_manager.is_port_listening(port):
                    logger.info(f"  {service}: {status_str}")
                else:
                    logger.warning(f"  {service}: ⚠️ 进程运行但端口 {port} 未监听")
                    status_str = f"⚠️ abnormal (PID: {pid}, Port: {port} - not listening)"

                status[service] = status_str
            else:
                status[service] = "❌ stopped"
                logger.info(f"  {service}: ❌ stopped")

                # 检查端口是否被其他进程占用
                if port and not self.port_manager.is_port_available(port):
                    owner = self.port_manager.get_port_owner(port)
                    if owner:
                        logger.warning(f"    ⚠️ 端口 {port} 被占用: {owner}")

        # 检查是否有其他进程占用了WebSocket相关端口
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
