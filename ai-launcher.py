#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Anki LinkMaster PDFJS - AI Launcher (Python Version)
Python equivalent of ai-launcher.ps1
"""

import os
import sys
import json
import time
import argparse
import subprocess
import signal
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

class AILauncher:
    def __init__(self):
        self.script_path = Path(__file__).parent.absolute()
        self.process_info_file = self.script_path / "logs" / "process-info.json"
        self.logs_dir = self.script_path / "logs"
        
        # Ensure logs directory exists
        self.logs_dir.mkdir(exist_ok=True)
    
    def parse_arguments(self) -> argparse.Namespace:
        """Parse command line arguments"""
        parser = argparse.ArgumentParser(
            description="Anki LinkMaster PDFJS - AI Launcher",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  python ai-launcher.py start --module pdf-home --port 3001
  python ai-launcher.py start --module pdf-viewer --pdf-path "C:\\path\\to\\file.pdf"
  python ai-launcher.py start --module pdf-viewer
  python ai-launcher.py start
  python ai-launcher.py stop
  python ai-launcher.py status
  python ai-launcher.py logs
            """
        )
        
        parser.add_argument("action", choices=["start", "stop", "status", "logs"], 
                          nargs="?", default="start", help="Action to perform")
        parser.add_argument("--module", "-m", choices=["pdf-home", "pdf-viewer"], 
                          default="pdf-viewer", help="Frontend module to use")
        parser.add_argument("--port", "-p", type=int, default=3000, 
                          help="Vite dev server port")
        parser.add_argument("--pdf-path", type=str, default="", 
                          help="PDF file path to load (pdf-viewer module only)")
        parser.add_argument("--wait-time", "-w", type=int, default=10, 
                          help="Wait time for services to start")
        
        return parser.parse_args()
    
    def start_npm_dev(self, module: str, port: int, pdf_path: str = "") -> Dict[str, Any]:
        """Start npm run dev with custom port"""
        print(f"[1/3] Starting npm run dev on port {port} for module {module}...")
        
        log_file = self.logs_dir / "npm-dev.log"
        
        # Prepare index.html for Vite if PDF path is provided
        vite_entry_file = f"src/frontend/{module}/index.html"
        if pdf_path and module == "pdf-viewer":
            original_html_path = Path("src/frontend/pdf-viewer/index.html")
            temp_html_path = Path("src/frontend/pdf-viewer/index.temp.html")
            
            if original_html_path.exists():
                html_content = original_html_path.read_text(encoding="utf-8")
                injection_script = f'<script>window.PDF_PATH = "{pdf_path}";</script>'
                html_content = html_content.replace("</body>", f"{injection_script}\n</body>")
                
                temp_html_path.write_text(html_content, encoding="utf-8")
                vite_entry_file = str(temp_html_path)
        
        # Set environment variable for Vite module
        env = os.environ.copy()
        env["VITE_MODULE"] = module
        
        # Start npm dev process
        # On Windows, npm commands need to be executed through cmd.exe
        if sys.platform == "win32":
            # Use cmd.exe to execute npm command
            cmd = f'npm run dev -- --port {port}'
            process = subprocess.Popen(
                ["cmd.exe", "/c", cmd],
                cwd=str(self.script_path),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8"
            )
        else:
            # On Unix systems, execute npm directly
            process = subprocess.Popen(
                ["npm", "run", "dev", "--", "--port", str(port)],
                cwd=str(self.script_path),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8"
            )
        
        # Write output to log file
        def log_writer():
            with open(log_file, "w", encoding="utf-8") as f:
                while True:
                    line = process.stdout.readline()
                    if not line:
                        break
                    # Strip ANSI codes
                    clean_line = self.strip_ansi_codes(line)
                    f.write(clean_line)
                    f.flush()
        
        # Start log writer in background
        import threading
        log_thread = threading.Thread(target=log_writer, daemon=True)
        log_thread.start()
        
        process_info = {
            "type": "npm-dev",
            "pid": process.pid,
            "log_file": str(log_file),
            "port": port,
            "process": process
        }
        
        return process_info
    
    def start_debug_py(self) -> Dict[str, Any]:
        """Start debug.py"""
        print("[2/3] Starting debug.py...")
        
        log_file = self.logs_dir / "debug.log"
        
        # Start debug.py process using virtual environment Python
        python_executable = os.path.join(self.script_path, ".venv", "Scripts", "python.exe")
        process = subprocess.Popen(
            [python_executable, "debug.py", "--port", "9222"],
            cwd=str(self.script_path),
            stdout=open(log_file, "w", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8"
        )
        
        process_info = {
            "type": "debug-py",
            "pid": process.pid,
            "log_file": str(log_file),
            "process": process
        }
        
        return process_info
    
    def start_app_py(self, module: str, port: int, pdf_path: str = "") -> Dict[str, Any]:
        """Start app.py with module selection"""
        print(f"[3/3] Starting app.py with module: {module}...")
        
        log_file = self.logs_dir / "app.log"
        module_log_file = self.logs_dir / f"{module}.log"
        
        # Create module log header
        log_header = f"""=====================================
{module} Module Log
Started: {time.strftime("%Y-%m-%d %H:%M:%S")}
Vite Port: {port}
=====================================

"""
        module_log_file.write_text(log_header, encoding="utf-8")
        
        # Build command arguments
        cmd_args = ["python", "app.py", "--module", module, "--port", str(port)]
        if pdf_path and module == "pdf-viewer":
            cmd_args.extend(["--file-path", pdf_path])
        
        # Start app.py process using virtual environment Python
        python_executable = os.path.join(self.script_path, ".venv", "Scripts", "python.exe")
        cmd_args[0] = python_executable  # Replace "python" with full path
        process = subprocess.Popen(
            cmd_args,
            cwd=str(self.script_path),
            stdout=open(log_file, "w", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8"
        )
        
        process_info = {
            "type": "main-app",
            "pid": process.pid,
            "log_file": str(log_file),
            "module_log": str(module_log_file),
            "module": module,
            "port": port,
            "process": process
        }
        
        return process_info
    
    def stop_all_processes(self):
        """Stop all processes"""
        print("Stopping all services...")
        
        if self.process_info_file.exists():
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    process_infos = json.load(f)
                
                for info in process_infos:
                    try:
                        # Use os.kill to terminate the process
                        if "pid" in info:
                            pid = info["pid"]
                            try:
                                if sys.platform == "win32":
                                    # On Windows, use taskkill to terminate process tree
                                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], 
                                                 check=False, capture_output=True)
                                else:
                                    # On Unix, send SIGTERM to process group
                                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                                print(f"Stopped {info.get('type', 'unknown')} (PID: {pid})")
                            except (ProcessLookupError, OSError):
                                # Process already terminated
                                pass
                    except Exception as e:
                        print(f"Warning: Failed to stop {info.get('type', 'unknown')}: {e}")
                
                # Remove process info file
                self.process_info_file.unlink(missing_ok=True)
                
            except Exception as e:
                print(f"Warning: Error reading process info: {e}")
        
        print("All services stopped")
    
    def check_process_status(self):
        """Check process status"""
        print("Checking service status...")
        
        if self.process_info_file.exists():
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    process_infos = json.load(f)
                
                for info in process_infos:
                    pid = info.get("pid")
                    if pid:
                        try:
                            # Check if process exists
                            if sys.platform == "win32":
                                # On Windows, use tasklist
                                result = subprocess.run(
                                    ["tasklist", "/FI", f"PID eq {pid}"], 
                                    capture_output=True, text=True, check=False
                                )
                                is_running = str(pid) in result.stdout
                            else:
                                # On Unix, use ps
                                os.kill(pid, 0)
                                is_running = True
                        except (OSError, subprocess.CalledProcessError):
                            is_running = False
                        
                        if is_running:
                            print(f"Process {info.get('type', 'unknown')} (PID: {pid}) is running")
                        else:
                            print(f"Process {info.get('type', 'unknown')} (PID: {pid}) has stopped")
                
            except Exception as e:
                print(f"Warning: Error checking status: {e}")
        else:
            print("No process info found")
    
    def show_logs(self, module: str):
        """Show recent logs"""
        print("Showing recent logs:")
        print()
        
        log_files = [
            self.logs_dir / "npm-dev.log",
            self.logs_dir / "debug.log",
            self.logs_dir / "app.log",
            self.logs_dir / f"{module}.log"
        ]
        
        for log_file in log_files:
            if log_file.exists():
                print(f"--- {log_file.name} (last 10 lines) ---")
                try:
                    # Read last 10 lines
                    with open(log_file, "r", encoding="utf-8") as f:
                        lines = f.readlines()[-10:]
                    for line in lines:
                        print(line.rstrip())
                    print()
                except Exception as e:
                    print(f"Error reading {log_file}: {e}")
                    print()
    
    def strip_ansi_codes(self, text: str) -> str:
        """Strip ANSI escape codes from text"""
        import re
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)
    
    def run(self):
        """Main entry point"""
        args = self.parse_arguments()
        
        if args.action == "start":
            self.handle_start(args)
        elif args.action == "stop":
            self.handle_stop()
        elif args.action == "status":
            self.handle_status()
        elif args.action == "logs":
            self.handle_logs(args.module)
        else:
            print("Invalid action. Use --help for usage information.")

    def handle_start(self, args):
        """Handle start action"""
        print("===================================")
        print("Anki LinkMaster PDFJS - AI Launcher")
        print("===================================")
        print()
        
        # Stop existing processes first
        self.stop_all_processes()
        
        # Start all services
        process_infos = []
        
        # Start npm dev
        npm_info = self.start_npm_dev(args.module, args.port, args.pdf_path)
        process_infos.append({
            "type": npm_info["type"],
            "pid": npm_info["pid"],
            "log_file": npm_info["log_file"],
            "port": npm_info["port"]
        })
        time.sleep(5)
        
        # Start debug.py
        debug_info = self.start_debug_py()
        process_infos.append({
            "type": debug_info["type"],
            "pid": debug_info["pid"],
            "log_file": debug_info["log_file"]
        })
        time.sleep(2)
        
        # Start app.py
        app_info = self.start_app_py(args.module, args.port, args.pdf_path)
        process_infos.append({
            "type": app_info["type"],
            "pid": app_info["pid"],
            "log_file": app_info["log_file"],
            "module_log": app_info["module_log"],
            "module": app_info["module"],
            "port": app_info["port"]
        })
        
        # Save process info
        with open(self.process_info_file, "w", encoding="utf-8") as f:
            json.dump(process_infos, f, indent=2)
        
        print()
        print("===================================")
        print("All services started!")
        print("===================================")
        print()
        print("Services:")
        print(f"- npm dev server: http://localhost:{args.port}")
        print("- Debug console: Port 9222")
        print(f"- Main app: Module {args.module}")
        print()
        print("Log files:")
        print("- npm log: logs/npm-dev.log")
        print("- debug log: logs/debug.log")
        print("- app log: logs/app.log")
        print(f"- module log: logs/{args.module}.log")
        print()
        print(f"Waiting {args.wait_time} seconds for services to start...")
        
        # Wait for services
        for i in range(1, args.wait_time + 1):
            progress = (i / args.wait_time) * 100
            print(f"\rWaited {i}/{args.wait_time} seconds ({progress:.0f}%)", end="")
            time.sleep(1)
        print()
        
        print()
        print("Checking service status...")
        self.check_process_status()
        
        print()
        print("AI Integration Tips:")
        print("- Services are running in background")
        print("- Use 'python ai-launcher.py stop' to stop all services")
        print("- Log files are available in logs/* for debugging")
    
    def handle_stop(self):
        """Handle stop action"""
        self.stop_all_processes()
    
    def handle_status(self):
        """Handle status action"""
        self.check_process_status()
    
    def handle_logs(self, module: str):
        """Handle logs action"""
        self.show_logs(module)

if __name__ == "__main__":
    launcher = AILauncher()
    
    # If no arguments provided, show help
    if len(sys.argv) == 1:
        parser = argparse.ArgumentParser(
            description="Anki LinkMaster PDFJS - AI Launcher",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  python ai-launcher.py start --module pdf-home --port 3001
  python ai-launcher.py start --module pdf-viewer --pdf-path "C:\\path\\to\\file.pdf"
  python ai-launcher.py start --module pdf-viewer
  python ai-launcher.py start
  python ai-launcher.py stop
  python ai-launcher.py status
  python ai-launcher.py logs
            """
        )
        parser.add_argument("action", choices=["start", "stop", "status", "logs"], 
                          nargs="?", default="start", help="Action to perform")
        parser.add_argument("--module", "-m", choices=["pdf-home", "pdf-viewer"], 
                          default="pdf-viewer", help="Frontend module to use")
        parser.add_argument("--port", "-p", type=int, default=3000, 
                          help="Vite dev server port")
        parser.add_argument("--pdf-path", type=str, default="", 
                          help="PDF file path to load (pdf-viewer module only)")
        parser.add_argument("--wait-time", "-w", type=int, default=10, 
                          help="Wait time for services to start")
        parser.print_help()
    else:
        launcher.run()