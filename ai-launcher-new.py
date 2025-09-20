#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版AI Launcher - 独立服务架构
只启动三个核心服务：npm run dev、ws-server、pdf-server
实现分离的日志系统
"""

import os
import sys
import json
import time
import argparse
import subprocess
import signal
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging
import re

class ServiceManager:
    """
    服务管理器 - 管理独立服务的启动、停止和日志
    """

    def __init__(self):
        self.script_path = Path(__file__).parent.absolute()
        self.logs_dir = self.script_path / "logs"
        self.process_info_file = self.logs_dir / "process-info.json"

        # 确保日志目录存在
        self.logs_dir.mkdir(exist_ok=True)

        # 服务进程字典
        self.services: Dict[str, Dict[str, Any]] = {}

        # 设置主日志
        self._setup_main_logging()

    def _setup_main_logging(self):
        """设置ai-launcher主日志"""
        log_file = self.logs_dir / "ai-launcher.log"

        # 清空日志文件
        with open(log_file, 'w', encoding='utf-8') as f:
            timestamp = datetime.now(timezone.utc).isoformat()
            f.write(f'{timestamp} [INFO] ai-launcher: AI Launcher启动\n')

        # 配置日志
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] ai-launcher: %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )

        self.logger = logging.getLogger("ai-launcher")

    def _strip_ansi_codes(self, text: str) -> str:
        """移除ANSI转义码"""
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)

    def _create_log_writer(self, process, log_file: Path, service_name: str):
        """创建日志写入器"""
        def log_writer():
            try:
                with open(log_file, "w", encoding="utf-8") as f:
                    # 写入启动标记
                    timestamp = datetime.now(timezone.utc).isoformat()
                    f.write(f'{timestamp} [INFO] {service_name}: 服务启动\n')
                    f.flush()

                    while True:
                        line = process.stdout.readline()
                        if not line:
                            break
                        # 清理ANSI码并写入
                        clean_line = self._strip_ansi_codes(line)
                        f.write(clean_line)
                        f.flush()

            except Exception as e:
                self.logger.error(f"Log writer for {service_name} failed: {e}")

        thread = threading.Thread(target=log_writer, daemon=True, name=f"{service_name}-logger")
        thread.start()
        return thread

    def start_npm_dev(self, port: int = 3000) -> bool:
        """启动npm run dev服务"""
        self.logger.info(f"Starting npm run dev on port {port}...")

        log_file = self.logs_dir / "npm-dev-vite.log"

        # 设置环境变量
        env = os.environ.copy()
        env["VITE_PORT"] = str(port)

        try:
            # 启动npm dev进程
            if sys.platform == "win32":
                process = subprocess.Popen(
                    ["cmd.exe", "/c", "npm run dev"],
                    cwd=str(self.script_path),
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    stdin=subprocess.DEVNULL
                )
            else:
                process = subprocess.Popen(
                    ["npm", "run", "dev"],
                    cwd=str(self.script_path),
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    stdin=subprocess.DEVNULL
                )

            # 创建日志写入器
            log_thread = self._create_log_writer(process, log_file, "npm-dev-vite")

            # 保存服务信息
            self.services["npm-dev"] = {
                "name": "npm-dev-vite",
                "process": process,
                "pid": process.pid,
                "port": port,
                "log_file": str(log_file),
                "log_thread": log_thread
            }

            self.logger.info(f"npm run dev started successfully (PID: {process.pid})")
            return True

        except Exception as e:
            self.logger.error(f"Failed to start npm run dev: {e}")
            return False

    def start_ws_server(self, port: int = 8765) -> bool:
        """启动WebSocket服务器"""
        self.logger.info(f"Starting WebSocket server on port {port}...")

        try:
            # 构建命令
            python_executable = sys.executable
            ws_server_path = self.script_path / "src" / "backend" / "services" / "ws-server.py"

            cmd = [
                python_executable,
                str(ws_server_path),
                "--host", "127.0.0.1",
                "--port", str(port),
                "--log-file", str(self.logs_dir / "ws-server.log")
            ]

            # 启动进程
            process = subprocess.Popen(
                cmd,
                cwd=str(self.script_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                stdin=subprocess.DEVNULL
            )

            # 保存服务信息 (WebSocket服务器有自己的日志，不需要额外日志写入器)
            self.services["ws-server"] = {
                "name": "ws-server",
                "process": process,
                "pid": process.pid,
                "port": port,
                "log_file": str(self.logs_dir / "ws-server.log")
            }

            self.logger.info(f"WebSocket server started successfully (PID: {process.pid})")
            return True

        except Exception as e:
            self.logger.error(f"Failed to start WebSocket server: {e}")
            return False

    def start_pdf_server(self, port: int = 8080) -> bool:
        """启动PDF文件服务器"""
        self.logger.info(f"Starting PDF server on port {port}...")

        try:
            # 构建命令
            python_executable = sys.executable
            pdf_server_path = self.script_path / "src" / "backend" / "services" / "pdf-server.py"

            cmd = [
                python_executable,
                str(pdf_server_path),
                "--host", "127.0.0.1",
                "--port", str(port),
                "--log-file", str(self.logs_dir / "pdf-server.log")
            ]

            # 启动进程
            process = subprocess.Popen(
                cmd,
                cwd=str(self.script_path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                stdin=subprocess.DEVNULL
            )

            # 保存服务信息 (PDF服务器有自己的日志，不需要额外日志写入器)
            self.services["pdf-server"] = {
                "name": "pdf-server",
                "process": process,
                "pid": process.pid,
                "port": port,
                "log_file": str(self.logs_dir / "pdf-server.log")
            }

            self.logger.info(f"PDF server started successfully (PID: {process.pid})")
            return True

        except Exception as e:
            self.logger.error(f"Failed to start PDF server: {e}")
            return False

    def _is_pid_running(self, pid: int) -> bool:
        """检查PID是否在运行"""
        if not isinstance(pid, int) or pid <= 0:
            return False
        try:
            if sys.platform == "win32":
                result = subprocess.run(
                    ["tasklist", "/FI", f"PID eq {pid}"],
                    capture_output=True, text=True, check=False
                )
                return str(pid) in (result.stdout or "")
            else:
                os.kill(pid, 0)
                return True
        except Exception:
            return False

    def check_status(self):
        """检查所有服务状态"""
        self.logger.info("Checking service status...")

        if not self.services:
            self.logger.info("No services are running")
            return

        for service_name, service_info in self.services.items():
            pid = service_info.get("pid")
            if self._is_pid_running(pid):
                port = service_info.get("port")
                self.logger.info(f"✓ {service_name} (PID: {pid}, Port: {port}) - Running")
            else:
                self.logger.warning(f"✗ {service_name} (PID: {pid}) - Stopped")

    def stop_all_services(self):
        """停止所有服务"""
        self.logger.info("Stopping all services...")

        for service_name, service_info in self.services.items():
            try:
                process = service_info.get("process")
                pid = service_info.get("pid")

                if process and self._is_pid_running(pid):
                    if sys.platform == "win32":
                        # Windows: 使用taskkill终止进程树
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(pid)],
                            check=False, capture_output=True
                        )
                    else:
                        # Unix: 发送SIGTERM信号
                        process.terminate()

                    self.logger.info(f"Stopped {service_name} (PID: {pid})")

            except Exception as e:
                self.logger.error(f"Failed to stop {service_name}: {e}")

        # 清空服务列表
        self.services.clear()
        self.logger.info("All services stopped")

    def save_process_info(self):
        """保存进程信息到文件"""
        try:
            process_list = []
            for service_name, service_info in self.services.items():
                process_list.append({
                    "name": service_info["name"],
                    "pid": service_info["pid"],
                    "port": service_info.get("port"),
                    "log_file": service_info["log_file"],
                    "type": service_name
                })

            with open(self.process_info_file, 'w', encoding='utf-8') as f:
                json.dump(process_list, f, indent=2, ensure_ascii=False)

        except Exception as e:
            self.logger.error(f"Failed to save process info: {e}")

    def load_process_info(self):
        """从文件加载进程信息"""
        try:
            if self.process_info_file.exists():
                with open(self.process_info_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return []
        except Exception as e:
            self.logger.error(f"Failed to load process info: {e}")
            return []

    def start_all_services(self, npm_port: int = 3000, ws_port: int = 8765, pdf_port: int = 8080):
        """启动所有服务"""
        self.logger.info("===================================")
        self.logger.info("AI Launcher - 独立服务架构")
        self.logger.info("===================================")

        success_count = 0

        # 启动npm dev
        if self.start_npm_dev(npm_port):
            success_count += 1
            time.sleep(2)  # 等待npm dev启动

        # 启动WebSocket服务器
        if self.start_ws_server(ws_port):
            success_count += 1
            time.sleep(1)

        # 启动PDF服务器
        if self.start_pdf_server(pdf_port):
            success_count += 1
            time.sleep(1)

        # 保存进程信息
        self.save_process_info()

        self.logger.info("===================================")
        self.logger.info(f"Services started: {success_count}/3")
        self.logger.info("===================================")

        if success_count == 3:
            self.logger.info("All services started successfully!")
            self.logger.info(f"Frontend: http://localhost:{npm_port}")
            self.logger.info(f"WebSocket: ws://localhost:{ws_port}")
            self.logger.info(f"PDF API: http://localhost:{pdf_port}")
            self.logger.info("Log files:")
            self.logger.info(f"  - npm-dev-vite.log")
            self.logger.info(f"  - ws-server.log")
            self.logger.info(f"  - pdf-server.log")
            self.logger.info(f"  - ai-launcher.log")
            return True
        else:
            self.logger.error("Some services failed to start!")
            return False


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="AI Launcher - 独立服务架构")
    parser.add_argument("action", choices=["start", "stop", "status"],
                       nargs="?", default="start", help="操作类型")
    parser.add_argument("--npm-port", type=int, default=3000, help="npm dev端口")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket端口")
    parser.add_argument("--pdf-port", type=int, default=8080, help="PDF服务器端口")

    args = parser.parse_args()

    # 创建服务管理器
    manager = ServiceManager()

    try:
        if args.action == "start":
            # 启动所有服务
            if manager.start_all_services(args.npm_port, args.ws_port, args.pdf_port):
                # 等待中断信号
                def signal_handler(sig, frame):
                    print("\n收到中断信号，正在停止所有服务...")
                    manager.stop_all_services()
                    sys.exit(0)

                signal.signal(signal.SIGINT, signal_handler)

                # 保持运行并定期检查状态
                while True:
                    time.sleep(30)
                    manager.check_status()
            else:
                return 1

        elif args.action == "stop":
            manager.stop_all_services()

        elif args.action == "status":
            manager.check_status()

    except KeyboardInterrupt:
        print("\n收到中断信号，正在停止所有服务...")
        manager.stop_all_services()
    except Exception as e:
        manager.logger.error(f"Unexpected error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())