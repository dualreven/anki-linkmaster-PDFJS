#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anki LinkMaster PDFJS - AI专用启动器
功能：解决AI调用时终端阻塞问题，支持快速启动/停止所有服务
"""

import os
import sys
import subprocess
import time
import json
import signal
import psutil
import argparse
from pathlib import Path
from typing import List, Dict, Optional

class AILauncher:
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent
        self.logs_dir = self.project_root / "logs"
        self.process_info_file = self.logs_dir / "process_info.json"
        
        # 创建日志目录
        self.logs_dir.mkdir(exist_ok=True)
        
        # 进程信息
        self.processes: Dict[str, subprocess.Popen] = {}
        
    def start_npm_dev(self) -> bool:
        """启动 npm run dev"""
        print("[1/3] 启动 npm run dev...")
        try:
            log_file = self.logs_dir / "npm-dev.log"
            with open(log_file, "w", encoding="utf-8") as f:
                process = subprocess.Popen(
                    ["npm.cmd", "run", "dev"],
                    cwd=self.project_root,
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
                )
                self.processes["npm-dev"] = process
                self._save_process_info("npm-dev", process.pid, str(log_file))
                return True
        except Exception as e:
            print(f"启动 npm run dev 失败: {e}")
            return False
    
    def start_debug_py(self) -> bool:
        """启动 debug.py"""
        print("[2/3] 启动 debug.py...")
        try:
            log_file = self.logs_dir / "debug.log"
            with open(log_file, "w", encoding="utf-8") as f:
                process = subprocess.Popen(
                    [sys.executable, "debug.py", "--port", "9222"],
                    cwd=self.project_root,
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
                )
                self.processes["debug-py"] = process
                self._save_process_info("debug-py", process.pid, str(log_file))
                return True
        except Exception as e:
            print(f"启动 debug.py 失败: {e}")
            return False
    
    def start_app_py(self) -> bool:
        """启动 app.py"""
        print("[3/3] 启动 app.py...")
        try:
            log_file = self.logs_dir / "app.log"
            with open(log_file, "w", encoding="utf-8") as f:
                process = subprocess.Popen(
                    [sys.executable, "app.py"],
                    cwd=self.project_root,
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
                )
                self.processes["main-app"] = process
                self._save_process_info("main-app", process.pid, str(log_file))
                return True
        except Exception as e:
            print(f"启动 app.py 失败: {e}")
            return False
    
    def _save_process_info(self, name: str, pid: int, log_file: str):
        """保存进程信息到文件"""
        process_info = {
            "name": name,
            "pid": pid,
            "log_file": log_file,
            "start_time": time.time()
        }
        
        # 读取现有信息
        all_info = []
        if self.process_info_file.exists():
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    all_info = json.load(f)
            except:
                pass
        
        # 添加新信息
        all_info.append(process_info)
        
        # 保存
        with open(self.process_info_file, "w", encoding="utf-8") as f:
            json.dump(all_info, f, indent=2)
    
    def start_all(self, wait_time: int = 10) -> bool:
        """启动所有服务"""
        print("=" * 40)
        print("Anki LinkMaster PDFJS - AI专用启动器")
        print("=" * 40)
        print()
        
        # 先停止现有进程
        self.stop_all()
        
        # 启动服务
        success = True
        success &= self.start_npm_dev()
        time.sleep(5)  # 等待npm启动
        
        success &= self.start_debug_py()
        time.sleep(2)  # 等待debug启动
        
        success &= self.start_app_py()
        
        if success:
            print()
            print("=" * 40)
            print("所有服务已启动！")
            print("=" * 40)
            print()
            print("服务信息：")
            print("- npm dev server: http://localhost:3000")
            print("- Debug console: 端口 9222")
            print("- 主应用: 已启动")
            print()
            print("日志文件位置：")
            print("- npm日志: logs/npm-dev.log")
            print("- debug日志: logs/debug.log")
            print("- app日志: logs/app.log")
            print()
            
            # 等待服务启动
            print(f"等待 {wait_time} 秒让服务完全启动...")
            for i in range(wait_time):
                print(f"\r进度: [{'=' * (i * 10 // wait_time)}{' ' * (10 - i * 10 // wait_time)}] {i + 1}/{wait_time}秒", end="")
                time.sleep(1)
            print("\n")
            
            # 检查状态
            self.check_status()
            
            print("\nAI集成提示：")
            print("- 服务已在后台运行，不会阻塞当前终端")
            print("- 可以通过 'python ai-launcher.py stop' 停止所有服务")
            print("- 可以通过 'python ai-launcher.py status' 检查服务状态")
            
            return True
        else:
            print("部分服务启动失败！")
            return False
    
    def stop_all(self):
        """停止所有服务"""
        print("正在停止所有服务...")
        
        # 从文件读取进程信息
        if self.process_info_file.exists():
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    process_infos = json.load(f)
                    
                for info in process_infos:
                    try:
                        pid = info["pid"]
                        name = info["name"]
                        
                        # 终止进程
                        if sys.platform == "win32":
                            subprocess.run(["taskkill", "/F", "/PID", str(pid)], check=False, capture_output=True)
                        else:
                            os.kill(pid, signal.SIGTERM)
                        
                        print(f"已停止 {name} (PID: {pid})")
                    except Exception as e:
                        print(f"停止进程失败: {e}")
                
                # 删除进程信息文件
                self.process_info_file.unlink()
            except Exception as e:
                print(f"读取进程信息失败: {e}")
        
        # 清理残留进程
        self._cleanup_processes()
        
        print("所有服务已停止")
    
    def _cleanup_processes(self):
        """清理残留的 node 和 python 进程"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    # 检查是否是相关进程
                    if proc.info['name'] in ['node.exe', 'node', 'python.exe', 'python']:
                        # 检查命令行是否包含项目相关内容
                        cmdline = ' '.join(proc.info['cmdline'] or [])
                        if any(keyword in cmdline.lower() for keyword in ['anki', 'pdfjs', 'vite', 'npm run dev']):
                            proc.kill()
                            print(f"清理残留进程: {proc.info['name']} (PID: {proc.info['pid']})")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            print(f"清理进程时出错: {e}")
    
    def check_status(self):
        """检查服务状态"""
        print("检查服务状态...")
        
        if not self.process_info_file.exists():
            print("没有找到运行的服务信息")
            return
        
        try:
            with open(self.process_info_file, "r", encoding="utf-8") as f:
                process_infos = json.load(f)
            
            all_running = True
            for info in process_infos:
                pid = info["pid"]
                name = info["name"]
                
                if psutil.pid_exists(pid):
                    print(f"✓ {name} (PID: {pid}) - 正在运行")
                else:
                    print(f"✗ {name} (PID: {pid}) - 已停止")
                    all_running = False
            
            if all_running:
                print("\n所有服务都在正常运行")
            else:
                print("\n部分服务已停止，建议重新启动")
                
        except Exception as e:
            print(f"检查状态失败: {e}")
    
    def show_logs(self, lines: int = 20):
        """显示最近的日志"""
        print("显示最近的日志：\n")
        
        log_files = [
            self.logs_dir / "npm-dev.log",
            self.logs_dir / "debug.log",
            self.logs_dir / "app.log"
        ]
        
        for log_file in log_files:
            if log_file.exists():
                print(f"--- {log_file.name} (最后 {lines} 行) ---")
                try:
                    with open(log_file, "r", encoding="utf-8") as f:
                        content = f.readlines()
                        for line in content[-lines:]:
                            print(line.rstrip())
                except Exception as e:
                    print(f"读取日志失败: {e}")
                print()
    
    def monitor(self, interval: int = 5):
        """监控服务状态"""
        print(f"开始监控服务状态 (每 {interval} 秒检查一次)...")
        print("按 Ctrl+C 停止监控\n")
        
        try:
            while True:
                self.check_status()
                print(f"\n下次检查在 {interval} 秒后...\n")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n监控已停止")


def main():
    parser = argparse.ArgumentParser(description="Anki LinkMaster PDFJS AI专用启动器")
    parser.add_argument("action", nargs="?", default="start", 
                       choices=["start", "stop", "status", "logs", "monitor"],
                       help="要执行的操作")
    parser.add_argument("--wait", type=int, default=10,
                       help="启动后等待时间（秒）")
    parser.add_argument("--lines", type=int, default=20,
                       help="显示日志的行数")
    parser.add_argument("--interval", type=int, default=5,
                       help="监控间隔（秒）")
    
    args = parser.parse_args()
    
    launcher = AILauncher()
    
    if args.action == "start":
        launcher.start_all(args.wait)
    elif args.action == "stop":
        launcher.stop_all()
    elif args.action == "status":
        launcher.check_status()
    elif args.action == "logs":
        launcher.show_logs(args.lines)
    elif args.action == "monitor":
        launcher.monitor(args.interval)


if __name__ == "__main__":
    main()