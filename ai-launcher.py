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

    def _venv_python(self) -> Optional[str]:
        """Return .venv python path if exists for current platform."""
        if sys.platform == "win32":
            path = self.script_path / ".venv" / "Scripts" / "python.exe"
        else:
            path = self.script_path / ".venv" / "bin" / "python"
        return str(path) if path.exists() else None

    def _can_import(self, python_exe: str, modules: List[str]) -> bool:
        """Check if given python can import all modules."""
        try:
            code = "import sys\n" + "\n".join([f"import {m}" for m in modules])
            result = subprocess.run([python_exe, "-c", code], capture_output=True, text=True)
            return result.returncode == 0
        except Exception:
            return False

    def _select_python(self, required_modules: List[str], override_path: Optional[str] = None) -> str:
        """Prefer .venv python if it can import required modules; otherwise fallback to sys.executable."""
        candidates: List[str] = []
        if override_path:
            candidates.append(override_path)
        venv_py = self._venv_python()
        if venv_py:
            candidates.append(venv_py)
        if sys.executable:
            candidates.append(sys.executable)
        # De-duplicate keeping order
        seen = set()
        ordered = []
        for c in candidates:
            if c and c not in seen:
                seen.add(c)
                ordered.append(c)
        # Try candidates
        for py in ordered:
            if self._can_import(py, required_modules):
                return py
        # Fallback to first available candidate
        return ordered[0] if ordered else (sys.executable or "python")
    
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
  python ai-launcher.py stop --module pdf-home
  python ai-launcher.py status
  python ai-launcher.py logs
            """
        )
        
        parser.add_argument("action", choices=["start", "stop", "status", "logs"], 
                          nargs="?", default="start", help="Action to perform")
        parser.add_argument("--module", "-m", choices=["pdf-home", "pdf-viewer"], 
                          default="pdf-viewer", help="Frontend module to use (for start action) or target module to stop (for stop action)")
        parser.add_argument("--port", "-p", type=int, default=3000, 
                          help="Vite dev server port")
        parser.add_argument("--http-port", type=int, default=8080,
                          help="Backend HTTP file server port (default: 8080)")
        parser.add_argument("--ws-port", type=int, default=8765,
                          help="Backend WebSocket server port (default: 8765)")
        parser.add_argument("--debug-port", type=int, default=9222,
                          help="Debug console collector port (default: 9222)")
        parser.add_argument("--python-exe", type=str, default="",
                          help="Override Python interpreter path for app/debug (optional)")
        parser.add_argument("--pdf-path", type=str, default="", 
                          help="PDF file path to load (pdf-viewer module only)")
        parser.add_argument("--wait-time", "-w", type=int, default=10, 
                          help="Wait time for services to start")
        
        return parser.parse_args()
    
    def _probe_http(self, port: int, path: str = "/") -> bool:
        """Return True if http://localhost:port/path responds quickly."""
        try:
            import urllib.request
            with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=0.5) as resp:
                return resp.status >= 200 and resp.status < 500
        except Exception:
            return False

    def _is_port_in_use(self, port: int) -> bool:
        """Check if a TCP port is in use on localhost."""
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return False
            except OSError:
                return True

    def _find_free_port(self, start_port: int = 0) -> int:
        """Find a free TCP port. If start_port>0, try from there upward."""
        import socket
        if start_port and not self._is_port_in_use(start_port):
            return start_port
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    def _ensure_http_port_hint(self, http_port: int):
        """Write logs/http-server-port.txt so Vite proxy knows backend HTTP port."""
        try:
            hint_file = self.logs_dir / "http-server-port.txt"
            hint_file.write_text(str(http_port), encoding="utf-8")
        except Exception:
            pass

    def _is_pid_running(self, pid: int) -> bool:
        """Check if a PID is currently running."""
        if not isinstance(pid, int) or pid <= 0:
            return False
        try:
            if sys.platform == "win32":
                result = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"], capture_output=True, text=True, check=False)
                return str(pid) in (result.stdout or "")
            else:
                os.kill(pid, 0)
                return True
        except Exception:
            return False

    def start_npm_dev(self, module: str, port: int, pdf_path: str = "") -> Dict[str, Any]:
        """Start npm run dev adapted to single-root Vite and optional PDF path injection"""
        print(f"[1/3] Starting npm run dev on port {port} for module {module}...")

        log_file = self.logs_dir / "npm-dev.log"

        # Reuse existing npm-dev from process-info if present and running
        try:
            if self.process_info_file.exists():
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    infos = json.load(f) or []
                for entry in infos:
                    if entry.get("type") == "npm-dev":
                        existing_pid = entry.get("pid")
                        if self._is_pid_running(existing_pid):
                            existing_port = entry.get("port") or self._detect_vite_port_from_log(port)
                            if existing_port:
                                print(f"Detected existing dev server via process-info on port {existing_port}, skipping npm run dev.")
                                return {
                                    "type": "npm-dev",
                                    "pid": -1,
                                    "log_file": str(log_file),
                                    "port": int(existing_port),
                                    "process": None
                                }
        except Exception:
            pass

        # Try to detect existing vite by probing configured and known ports, including detected log port
        detected_port = self._detect_vite_port_from_log(port)
        candidate_ports = [p for p in {port, 3000, 3001, detected_port} if p]
        for p in candidate_ports:
            if self._probe_http(p):
                print(f"Detected existing dev server on port {p}, skipping npm run dev.")
                return {
                    "type": "npm-dev",
                    "pid": -1,
                    "log_file": str(log_file),
                    "port": p,
                    "process": None
                }

        # Inject PDF path into pdf-viewer index.html (with markers) if provided
        if pdf_path and module == "pdf-viewer":
            original_html_path = Path("src/frontend/pdf-viewer/index.html")
            backup_html_path = Path("src/frontend/pdf-viewer/index.html.backup")
            if original_html_path.exists():
                try:
                    html_content = original_html_path.read_text(encoding="utf-8")
                    start_marker = "<!-- AI-LAUNCHER-PDF-PATH-START -->"
                    end_marker = "<!-- AI-LAUNCHER-PDF-PATH-END -->"
                    # Remove previous injected block if any
                    if start_marker in html_content and end_marker in html_content:
                        pre, rest = html_content.split(start_marker, 1)
                        _, post = rest.split(end_marker, 1)
                        html_content = pre + post
                    # Backup once (if not already)
                    if not backup_html_path.exists():
                        backup_html_path.write_text(html_content, encoding="utf-8")
                    # Inject new block before </body>
                    injection_block = (
                        f"{start_marker}\n"
                        f"<script>window.PDF_PATH = \"{pdf_path}\";</script>\n"
                        f"{end_marker}"
                    )
                    html_content = html_content.replace("</body>", f"{injection_block}\n</body>")
                    original_html_path.write_text(html_content, encoding="utf-8")
                    print(f"Injected PDF path into {original_html_path}")
                except Exception as e:
                    print(f"Warning: Failed to inject PDF path: {e}")

        # Set environment for Vite (single root: src/frontend)
        env = os.environ.copy()
        env["VITE_MODULE"] = module
        env["VITE_PORT"] = str(port)

        # Start npm dev process (avoid duplicate --port, rely on VITE_PORT + package script)
        if sys.platform == "win32":
            cmd = 'npm run dev'
            process = subprocess.Popen(
                ["cmd.exe", "/c", cmd],
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
    
    def start_debug_py(self, port: int, python_override: Optional[str] = None) -> Dict[str, Any]:
        """Start debug.py"""
        print("[2/3] Starting debug.py...")
        
        log_file = self.logs_dir / "debug.log"
        
        # Choose python that has debug dependencies available
        python_executable = self._select_python(["aiohttp", "websockets"], override_path=python_override)
        try:
            print(f"[debug.py] Using Python interpreter: {python_executable}")
            if python_override:
                print(f"[debug.py] Override provided: {python_override}")
        except Exception:
            pass
        process = subprocess.Popen(
            [python_executable, "debug.py", "--port", str(port)],
            cwd=str(self.script_path),
            stdout=open(log_file, "w", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            stdin=subprocess.DEVNULL
        )
        
        process_info = {
            "type": "debug-py",
            "pid": process.pid,
            "log_file": str(log_file),
            "process": process
        }
        
        return process_info
    
    def start_app_py(self, module: str, port: int, pdf_path: str = "", http_port: int = 8080, ws_port: int = 8765, python_override: Optional[str] = None, remote_debug_port: Optional[int] = None) -> Dict[str, Any]:
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
        
        # Choose python that has PyQt6 available for GUI app
        python_executable = self._select_python(["PyQt6"], override_path=python_override)
        cmd_args[0] = python_executable
        try:
            print(f"[app.py] Using Python interpreter: {python_executable}")
            if python_override:
                print(f"[app.py] Override provided: {python_override}")
            dbg_info = f", dbg:{remote_debug_port}" if remote_debug_port else ""
            print(f"[app.py] Ports - vite:{port}, http:{http_port}, ws:{ws_port}{dbg_info}")
            if pdf_path and module == "pdf-viewer":
                print(f"[app.py] PDF path: {pdf_path}")
            with open(module_log_file, "a", encoding="utf-8") as f:
                f.write(f"Python: {python_executable}\n")
                f.write(f"Ports: vite={port}, http={http_port}, ws={ws_port}{dbg_info}\n")
                if pdf_path and module == "pdf-viewer":
                    f.write(f"PDF: {pdf_path}\n")
        except Exception:
            pass
        # Prepare bootstrap: ensure 'PyQt6.sip' alias is available via sitecustomize, then preflight
        bootstrap_dir = self.script_path / "AItemp" / "_pybootstrap"
        try:
            bootstrap_dir.mkdir(parents=True, exist_ok=True)
            sitecustomize_path = bootstrap_dir / "sitecustomize.py"
            sitecustomize_code = (
                "# Auto-generated by ai-launcher to ensure PyQt6.sip alias\n"
                "try:\n"
                "    import PyQt6_sip as _p6s\n"
                "    import sys as _sys\n"
                "    _sys.modules.setdefault('PyQt6.sip', _p6s)\n"
                "except Exception:\n"
                "    pass\n"
            )
            sitecustomize_path.write_text(sitecustomize_code, encoding="utf-8")
        except Exception:
            pass
        try:
            preflight_code = (
                "import importlib, sys;\n"
                "mods=['PyQt6','PyQt6.QtWebEngineCore'];\n"
                "fails=[];\n"
                "for m in mods:\n"
                "    try:\n"
                "        importlib.import_module(m)\n"
                "    except Exception as e:\n"
                "        fails.append(f'{m}: {e}')\n"
                "print('IMPORT_OK' if not fails else 'IMPORT_FAIL');\n"
                "[print(x) for x in fails]\n"
            )
            pre_env = os.environ.copy()
            pre_env["PYTHONPATH"] = (str(bootstrap_dir) + os.pathsep + pre_env.get("PYTHONPATH", "")).rstrip(os.pathsep)
            pr = subprocess.run([python_executable, "-c", preflight_code], capture_output=True, text=True, env=pre_env)
            if pr.returncode != 0 or 'IMPORT_FAIL' in (pr.stdout or ''):
                msg = (pr.stdout or '') + (pr.stderr or '')
                try:
                    print("[app.py] Preflight import failed. Details below:")
                    print(msg)
                except Exception:
                    pass
                with open(log_file, "a", encoding="utf-8") as lf:
                    lf.write("[Preflight] PyQt6 import failed.\n")
                    lf.write(msg + "\n")
                with open(module_log_file, "a", encoding="utf-8") as mf:
                    mf.write("[Preflight] PyQt6 import failed.\n")
                    mf.write(msg + "\n")
                # Do not attempt to start app.py to avoid masking error with generic message
                return {
                    "type": "main-app",
                    "pid": -1,
                    "log_file": str(log_file),
                    "module_log": str(module_log_file),
                    "module": module,
                    "port": port,
                    "process": None
                }
        except Exception:
            pass
        # Pass backend ports to app via environment
        env = os.environ.copy()
        env["BACKEND_HTTP_PORT"] = str(http_port)
        env["BACKEND_WS_PORT"] = str(ws_port)
        # Pass Qt remote debugging port
        if remote_debug_port:
            env["QTWEBENGINE_REMOTE_DEBUGGING"] = str(remote_debug_port)
        else:
            env.setdefault("QTWEBENGINE_REMOTE_DEBUGGING", os.environ.get("QTWEBENGINE_REMOTE_DEBUGGING", "9222"))
        # Ensure bootstrap is active for the real app process too
        env["PYTHONPATH"] = (str(bootstrap_dir) + os.pathsep + env.get("PYTHONPATH", "")).rstrip(os.pathsep)
        # Also write hint file for Vite proxy
        self._ensure_http_port_hint(http_port)
        process = subprocess.Popen(
            cmd_args,
            cwd=str(self.script_path),
            env=env,
            stdout=open(log_file, "w", encoding="utf-8"),
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            stdin=subprocess.DEVNULL
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
    
    def stop_processes_by_module(self, target_module: Optional[str] = None):
        """Stop processes by module or all processes if target_module is None"""
        if target_module:
            print(f"Stopping {target_module} module services...")
        else:
            print("Stopping all services...")
        
        if self.process_info_file.exists():
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    process_infos = json.load(f)
                
                processes_to_stop = []
                remaining_processes = []
                
                for info in process_infos:
                    # Check if this process should be stopped
                    should_stop = False
                    process_type = info.get('type', '')
                    process_module = info.get('module')
                    if target_module is None:
                        # Stop all processes
                        should_stop = True
                    else:
                        # For module-specific stop: keep shared Vite (npm-dev) running
                        if process_type == 'npm-dev':
                            should_stop = False
                        elif process_module == target_module:
                            # Stop this module's app and debug processes
                            should_stop = True
                    
                    if should_stop:
                        processes_to_stop.append(info)
                    else:
                        remaining_processes.append(info)
                
                # Stop the selected processes
                for info in processes_to_stop:
                    try:
                        # Use os.kill to terminate the process
                        if "pid" in info:
                            pid = info["pid"]
                            try:
                                pid_int = int(pid)
                            except Exception:
                                pid_int = pid
                            # Ignore invalid or placeholder pids
                            if isinstance(pid_int, int) and pid_int <= 0:
                                continue
                            try:
                                if sys.platform == "win32":
                                    # On Windows, use taskkill to terminate process tree
                                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid_int)], 
                                                 check=False, capture_output=True)
                                else:
                                    # On Unix, send SIGTERM to process group
                                    os.killpg(os.getpgid(pid_int), signal.SIGTERM)
                                module_info = f" ({info.get('module', 'unknown')} module)" if info.get('module') else ""
                                print(f"Stopped {info.get('type', 'unknown')}{module_info} (PID: {pid_int})")
                            except (ProcessLookupError, OSError):
                                # Process already terminated
                                pass
                    except Exception as e:
                        print(f"Warning: Failed to stop {info.get('type', 'unknown')}: {e}")
                
                # Update process info file with remaining processes
                if target_module and remaining_processes:
                    with open(self.process_info_file, "w", encoding="utf-8") as f:
                        json.dump(remaining_processes, f, indent=2)
                elif target_module is None:
                    # Remove process info file when stopping all
                    self.process_info_file.unlink(missing_ok=True)
                
            except Exception as e:
                print(f"Warning: Error reading process info: {e}")
        
        if target_module:
            print(f"{target_module} module services stopped")
        else:
            print("All services stopped")
        
        # After normal tracked kills, also kill stale processes not tracked
        try:
            self._kill_stale_main_apps(target_module)
            self._kill_stale_debug(target_module)
        except Exception:
            pass
        
        # Restore pdf-viewer index.html if we injected PDF path earlier
        try:
            original_html_path = Path("src/frontend/pdf-viewer/index.html")
            backup_html_path = Path("src/frontend/pdf-viewer/index.html.backup")
            if backup_html_path.exists():
                # Prefer full restore from backup
                backup_content = backup_html_path.read_text(encoding="utf-8")
                original_html_path.write_text(backup_content, encoding="utf-8")
                backup_html_path.unlink(missing_ok=True)
            else:
                # Fallback: remove injected block by markers if present
                if original_html_path.exists():
                    html_content = original_html_path.read_text(encoding="utf-8")
                    start_marker = "<!-- AI-LAUNCHER-PDF-PATH-START -->"
                    end_marker = "<!-- AI-LAUNCHER-PDF-PATH-END -->"
                    if start_marker in html_content and end_marker in html_content:
                        pre, rest = html_content.split(start_marker, 1)
                        _, post = rest.split(end_marker, 1)
                        original_html_path.write_text(pre + post, encoding="utf-8")
        except Exception as e:
            print(f"Warning: Failed to restore index.html: {e}")
    
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
                                # Skip invalid pid values
                                if isinstance(pid, int) and pid > 0:
                                    os.kill(pid, 0)
                                is_running = True
                        except (OSError, subprocess.CalledProcessError):
                            is_running = False
                        
                        if is_running:
                            _t = info.get('type', 'unknown')
                            _m = info.get('module')
                            if _t == 'npm-dev':
                                # Show as npm-dev(vite server) without module suffix
                                print(f"Process npm-dev(vite server) (PID: {pid}) is running")
                            else:
                                _mstr = f" (module: {_m})" if _m else ""
                                print(f"Process {_t}{_mstr} (PID: {pid}) is running")
                        else:
                            _t = info.get('type', 'unknown')
                            _m = info.get('module')
                            if _t == 'npm-dev':
                                print(f"Process npm-dev(vite server) (PID: {pid}) has stopped")
                            else:
                                _mstr = f" (module: {_m})" if _m else ""
                                print(f"Process {_t}{_mstr} (PID: {pid}) has stopped")
                
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
            self.handle_stop(args)
        elif args.action == "status":
            self.handle_status()
        elif args.action == "logs":
            self.handle_logs(args.module)
        else:
            print("Invalid action. Use --help for usage information.")

    def _detect_vite_port_from_log(self, default_port: int) -> int:
        """Detect the actual Vite port from npm-dev.log if Vite switched ports."""
        log_file = self.logs_dir / "npm-dev.log"
        try:
            if not log_file.exists():
                return default_port
            content = log_file.read_text(encoding="utf-8", errors="ignore")
            # Look for line like: 'Local:   http://localhost:3001/'
            import re
            m = re.search(r"Local:\s+http://localhost:(\d+)/", content)
            if m:
                return int(m.group(1))
        except Exception:
            pass
        return default_port

    def _list_pids_by_cmdline(self, includes: List[str]) -> List[int]:
        """List PIDs of processes whose command line contains all include substrings.
        Best-effort cross-platform implementation without extra dependencies.
        """
        try:
            pids: List[int] = []
            if sys.platform == "win32":
                # Use PowerShell to query processes with command line
                # Build a -match expression combining all includes
                _parts = []
                for _s in includes:
                    _esc = _s.replace("'", "''")
                    _parts.append(f"$_.CommandLine -match [regex]::Escape('{_esc}')")
                match_expr = " -and ".join(_parts)
                ps_cmd = [
                    "powershell", "-NoProfile", "-Command",
                    f"Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -ne $null -and {match_expr} }} | Select-Object -ExpandProperty ProcessId"
                ]
                result = subprocess.run(ps_cmd, capture_output=True, text=True, check=False)
                for line in (result.stdout or "").splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        pids.append(int(line))
                    except ValueError:
                        continue
            else:
                # Unix-like: use ps to list pid and command
                result = subprocess.run(["ps", "-eo", "pid,args"], capture_output=True, text=True, check=False)
                for line in (result.stdout or "").splitlines():
                    try:
                        parts = line.strip().split(None, 1)
                        if len(parts) != 2:
                            continue
                        pid_str, cmd = parts
                        if all(s in cmd for s in includes):
                            pids.append(int(pid_str))
                    except Exception:
                        continue
            return list(sorted(set(pids)))
        except Exception:
            return []

    def _kill_pid_tree(self, pid: int):
        """Kill a process by PID (best-effort), including its children if possible."""
        try:
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], check=False, capture_output=True)
            else:
                # Send SIGTERM to the process group if possible; fallback to kill the PID
                try:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                except Exception:
                    os.kill(pid, signal.SIGTERM)
        except Exception:
            pass

    def _kill_stale_main_apps(self, target_module: Optional[str]):
        """Find and kill running app.py instances not tracked in process-info.json."""
        try:
            patterns = ["app.py"]
            if target_module:
                patterns.append(f"--module {target_module}")
            pids = self._list_pids_by_cmdline(patterns)
            # Exclude PIDs already tracked to avoid double work
            tracked = set()
            try:
                if self.process_info_file.exists():
                    with open(self.process_info_file, "r", encoding="utf-8") as f:
                        infos = json.load(f) or []
                        for e in infos:
                            pid = e.get("pid")
                            if isinstance(pid, int) and pid > 0 and e.get("type") == "main-app":
                                if not target_module or e.get("module") == target_module:
                                    tracked.add(pid)
            except Exception:
                pass
            for pid in pids:
                if pid in tracked:
                    continue
                self._kill_pid_tree(pid)
        except Exception:
            pass

    def _kill_stale_debug(self, target_module: Optional[str]):
        """Best-effort: kill stray debug.py processes when stopping all (module-agnostic)."""
        try:
            # We cannot reliably map debug.py to module; only kill on stop-all to avoid cross-module impact
            if target_module is not None:
                return
            pids = self._list_pids_by_cmdline(["debug.py", "--port"])  # our debug process always has --port
            # Exclude tracked debug pids
            tracked = set()
            try:
                if self.process_info_file.exists():
                    with open(self.process_info_file, "r", encoding="utf-8") as f:
                        infos = json.load(f) or []
                        for e in infos:
                            pid = e.get("pid")
                            if isinstance(pid, int) and pid > 0 and e.get("type") == "debug-py":
                                tracked.add(pid)
            except Exception:
                pass
            for pid in pids:
                if pid in tracked:
                    continue
                self._kill_pid_tree(pid)
        except Exception:
            pass

    def handle_start(self, args):
        """Handle start action"""
        print("===================================")
        print("Anki LinkMaster PDFJS - AI Launcher")
        print("===================================")
        print()
        
        # Stop existing processes for this module only
        self.stop_processes_by_module(args.module)
        
        # Start all services
        process_infos = []
        
        # Start npm dev
        # Ensure Vite proxy knows backend HTTP port
        self._ensure_http_port_hint(args.http_port)
        npm_info = self.start_npm_dev(args.module, args.port, args.pdf_path)
        # Only add npm-dev entry if we actually spawned a new one
        if npm_info.get("pid", -1) != -1:
            process_infos.append({
                "type": npm_info["type"],
                "pid": npm_info["pid"],
                "log_file": npm_info["log_file"],
                "port": npm_info["port"]
            })
        time.sleep(5)
        
        # Resolve non-conflicting backend and debug ports
        http_port = args.http_port
        if self._is_port_in_use(http_port):
            http_port = self._find_free_port(http_port + 1)
        ws_port = args.ws_port
        if self._is_port_in_use(ws_port):
            ws_port = self._find_free_port(ws_port + 1)
        debug_port = args.debug_port
        if self._is_port_in_use(debug_port):
            debug_port = self._find_free_port(debug_port + 1)
        remote_debug_port = debug_port
        
        # Start debug.py on a unique port
        debug_info = self.start_debug_py(debug_port, python_override=args.python_exe or None)
        process_infos.append({
            "type": debug_info["type"],
            "pid": debug_info["pid"],
            "log_file": debug_info["log_file"],
            "module": args.module,
            "debug_port": debug_port
        })
        time.sleep(2)
        
        # Start app.py with unique backend and remote debug ports
        app_info = self.start_app_py(
            args.module,
            args.port,
            args.pdf_path,
            http_port=http_port,
            ws_port=ws_port,
            python_override=args.python_exe or None,
            remote_debug_port=remote_debug_port
        )
        process_infos.append({
            "type": app_info["type"],
            "pid": app_info["pid"],
            "log_file": app_info["log_file"],
            "module_log": app_info["module_log"],
            "module": app_info["module"],
            "port": app_info["port"],
            "http_port": http_port,
            "ws_port": ws_port,
            "remote_debug_port": remote_debug_port
        })
        
        # Save/merge process info to avoid dropping other module entries
        existing_infos = []
        try:
            if self.process_info_file.exists():
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    existing_infos = json.load(f) or []
        except Exception:
            existing_infos = []
        # Remove old entries of current module (keep shared npm-dev entries)
        merged = []
        for entry in existing_infos:
            e_type = entry.get("type", "")
            e_module = entry.get("module")
            if e_module == args.module and e_type != "npm-dev":
                continue
            merged.append(entry)
        # Append new entries; skip any placeholder entries (pid <= 0)
        for entry in process_infos:
            try:
                if int(entry.get("pid", 0)) <= 0:
                    continue
            except Exception:
                pass
            merged.append(entry)
        # Deduplicate npm-dev entries: keep the first running one, else keep one
        npm_kept = False
        deduped = []
        for e in merged:
            if e.get("type") == "npm-dev":
                if not npm_kept:
                    # Prefer the first running npm-dev
                    if self._is_pid_running(e.get("pid")):
                        deduped.append(e)
                        npm_kept = True
                    else:
                        # tentatively keep; may be replaced by a running one later
                        deduped.append(e)
                        npm_kept = True
                else:
                    # Drop extra npm-dev entries
                    continue
            else:
                deduped.append(e)
        with open(self.process_info_file, "w", encoding="utf-8") as f:
            json.dump(deduped, f, indent=2)
        
        print()
        print("===================================")
        print("All services started!")
        print("===================================")
        print()
        # Try to detect actual vite port in case of collision (e.g., switched to 3001)
        detected_port = self._detect_vite_port_from_log(args.port)
        if detected_port != args.port:
            # Update saved process info on disk for npm-dev entry
            try:
                with open(self.process_info_file, "r", encoding="utf-8") as f:
                    infos = json.load(f)
                for entry in infos:
                    if entry.get("type") == "npm-dev":
                        entry["port"] = detected_port
                with open(self.process_info_file, "w", encoding="utf-8") as f:
                    json.dump(infos, f, indent=2)
            except Exception:
                pass

        print("Services:")
        print(f"- npm dev server: http://localhost:{detected_port}")
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
    
    def handle_stop(self, args):
        """Handle stop action"""
        # For stop action, use module parameter if explicitly provided, otherwise stop all
        target_module = None
        if hasattr(args, 'module') and hasattr(args, 'action') and args.action == 'stop':
            # Check if --module was explicitly provided (not just default)
            import sys
            if '--module' in sys.argv or '-m' in sys.argv:
                target_module = args.module
        self.stop_processes_by_module(target_module)
    
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
  python ai-launcher.py stop --module pdf-home
  python ai-launcher.py status
  python ai-launcher.py logs
            """
        )
        parser.add_argument("action", choices=["start", "stop", "status", "logs"], 
                          nargs="?", default="start", help="Action to perform")
        parser.add_argument("--module", "-m", choices=["pdf-home", "pdf-viewer"], 
                          default="pdf-viewer", help="Frontend module to use (for start action) or target module to stop (for stop action)")
        parser.add_argument("--port", "-p", type=int, default=3000, 
                          help="Vite dev server port")
        parser.add_argument("--pdf-path", type=str, default="", 
                          help="PDF file path to load (pdf-viewer module only)")
        parser.add_argument("--wait-time", "-w", type=int, default=10, 
                          help="Wait time for services to start")
        parser.print_help()
    else:
        launcher.run()