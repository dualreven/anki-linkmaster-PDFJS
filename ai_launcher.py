#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AI Launcher (root CLI)

Commands:
  - start:  start vite (pnpm dev), backend services, and optional frontend module
  - stop:   stop vite, frontend, and backend services
  - status: print dev/frontend process info and backend status

Args:
  --vite-port <int>
  --msgServer-port <int>
  --pdfFileServer-port <int>   (also accept --pdfFileServer_port)
  --module <pdf-home|pdf-viewer>
  --pdf-id <string>

Logging:
  - Writes to logs/ai-launcher.log (UTF-8)

Notes:
  - All file I/O uses UTF-8 explicitly and writes with "\n" newlines
  - Frontend flag mapping: msgServer-port -> --ws-port, pdfFileServer-port -> --pdf-port
  - pdf-viewer does not accept --pdf-id; we record it to process info only
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent
LOGS_DIR = PROJECT_ROOT / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)


# Import modular helpers if available
sys.path.insert(0, str(PROJECT_ROOT))
try:
    from ai_scripts.ai_launcher.core.port_manager import PortManager
    from ai_scripts.ai_launcher.core.logging_manager import LoggingManager
    from ai_scripts.ai_launcher.services.persistent.npm_service import (
        NpmDevServerService,
    )
    from core_utils.process_utils import kill_process_tree, is_process_running
except Exception:  # pragma: no cover - allow fallback without crashing tests
    PortManager = None  # type: ignore
    LoggingManager = None  # type: ignore
    NpmDevServerService = None  # type: ignore
    kill_process_tree = None # type: ignore
    is_process_running = None # type: ignore


# ---- Logging ----
def _setup_logging() -> Any:
    """Create main logger writing to logs/ai-launcher.log (UTF-8)."""
    if LoggingManager is None:
        # Fallback minimal logging if modules missing
        import logging

        log_file = LOGS_DIR / "ai-launcher.log"
        # Ensure a clean file with explicit LF newline
        with open(log_file, "w", encoding="utf-8", newline="\n") as fp:
            fp.write("AI Launcher start\n")

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            handlers=[
                logging.FileHandler(log_file, encoding="utf-8"),
                logging.StreamHandler(sys.stdout),
            ],
        )
        return logging.getLogger("ai-launcher")

    lm = LoggingManager(LOGS_DIR)
    return lm.setup_main_logging("ai-launcher")


LOGGER = _setup_logging()


# ---- JSON helpers (UTF-8 + LF) ----
def write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fp:
        fp.write(text)
    tmp.replace(path)


def read_json(path: Path) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return {}


# ---- Port resolution ----
def _load_runtime_ports(project_root: Path) -> Dict[str, Any]:
    cfg = project_root / "logs" / "runtime-ports.json"
    if cfg.exists():
        try:
            return json.loads(cfg.read_text(encoding="utf-8"))
        except Exception as exc:
            LOGGER.warning("Failed reading runtime-ports.json: %s", exc)
    return {}


def resolve_vite_port(cli_port: Optional[int], project_root: Path = PROJECT_ROOT) -> int:
    """Resolve Vite port with priority: CLI > runtime-ports.json > npm-dev-vite.log > default."""
    if cli_port:
        return int(cli_port)

    # runtime-ports.json
    ports = _load_runtime_ports(project_root)
    port = ports.get("vite_port") or ports.get("npm_port")
    if port:
        try:
            return int(port)
        except Exception:
            pass

    # npm-dev-vite.log pattern
    vite_log = project_root / "logs" / "npm-dev-vite.log"
    if vite_log.exists():
        try:
            content = vite_log.read_text(encoding="utf-8")
        except Exception:
            content = ""
        m = re.search(r"Local:\s+http://localhost:(\d+)/", content)
        if m:
            try:
                return int(m.group(1))
            except Exception:
                pass

    # default
    return 3000


def _port_available(port: int, host: str = "127.0.0.1") -> bool:
    """
    Checks if a port is available for a new service to bind to.
    This is the reliable way, as opposed to checking for listening services.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind((host, port))
        return True
    except socket.error:
        return False
    except Exception:
        return False


def _allocate_ports(cli: argparse.Namespace) -> Dict[str, int]:
    requested: Dict[str, int] = {}
    if getattr(cli, "vite_port", None):
        requested["npm_port"] = int(cli.vite_port)
    if getattr(cli, "msgServer_port", None):
        requested["msgCenter_port"] = int(cli.msgServer_port)
    # accept both styles for pdf port
    pdf_cli = getattr(cli, "pdfFileServer_port", None) or getattr(cli, "pdfFileServer_port_alt", None)
    if pdf_cli:
        requested["pdfFile_port"] = int(pdf_cli)

    # If PortManager exists, use it for robust allocation
    if PortManager is not None:
        pm = PortManager(PROJECT_ROOT)
        # Merge with vite resolution priority (CLI>runtime>log>default)
        vite_port = resolve_vite_port(getattr(cli, "vite_port", None))
        requested.setdefault("npm_port", vite_port)
        ports = pm.allocate_ports(requested)
        valid, errors = pm.validate_port_allocation(ports)
        if not valid:
            for e in errors:
                LOGGER.warning("Port validation: %s", e)
        return ports

    # Fallback allocation without PortManager
    ports = _load_runtime_ports(PROJECT_ROOT)
    npm = resolve_vite_port(getattr(cli, "vite_port", None))
    msgCenter = int(requested.get("msgCenter_port") or ports.get("msgCenter_port") or ports.get("ws_port") or 8765)
    pdfFile = int(requested.get("pdfFile_port") or ports.get("pdfFile_port") or ports.get("pdf_port") or 8080)

    # availability checks
    if not _port_available(npm):
        # naive search forward
        for p in range(npm, npm + 50):
            if _port_available(p):
                npm = p
                break
    if not _port_available(msgCenter):
        for p in range(msgCenter, msgCenter + 50):
            if _port_available(p):
                msgCenter = p
                break
    if not _port_available(pdfFile):
        for p in range(pdfFile, pdfFile + 50):
            if _port_available(p):
                pdfFile = p
                break

    return {"npm_port": int(npm), "msgCenter_port": int(msgCenter), "pdfFile_port": int(pdfFile)}


# ---- Process helpers ----
def kill_process(pid: int) -> bool:
    if kill_process_tree is None:
        LOGGER.error("kill_process_tree utility is not available.")
        return False
    return kill_process_tree(pid)


def is_process_running(pid: Optional[int]) -> bool:
    """Cross-platform check if a process is running."""
    if pid is None:
        return False
    try:
        if os.name == "nt":
            # tasklist is slow but reliable. Findstr is used for speed.
            res = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True,
                check=False,
                text=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            return str(pid) in res.stdout
        else:
            # kill -0 pid checks existence without sending a signal
            os.kill(int(pid), 0)
            return True
    except (OSError, subprocess.CalledProcessError):
        return False
    except Exception:
        return False


def _save_dev_process(pid: Optional[int], port: int, cmdline: str) -> None:
    info = {
        "vite": {
            "pid": int(pid) if pid else None,
            "port": int(port),
            "cmd": cmdline,
            "status": "running" if pid else "stopped",
        },
        "_meta": {
            "updated": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
    }
    write_json_atomic(LOGS_DIR / "dev-process-info.json", info)


def _save_frontend_process(pid: Optional[int], module: str, ports: Dict[str, int], pdf_id: Optional[str]) -> None:
    """Read-modify-write the frontend process info file."""
    path = LOGS_DIR / "frontend-process-info.json"
    data = read_json(path)
    
    # Clean up old flat structure if it exists
    if "frontend" not in data or not isinstance(data.get("frontend"), dict) or any(not isinstance(v, dict) for v in data["frontend"].values()):
        data["frontend"] = {}

    # Determine the key for this process
    key = module
    if module == "pdf-viewer":
        key = f"pdf-viewer-{pdf_id or 'empty'}"

    # Create the process entry
    process_info = {
        "pid": int(pid) if pid else None,
        "status": "running" if pid else "stopped",
        "ports": {
            "vite_port": int(ports.get("npm_port") or ports.get("vite_port") or 3000),
            "msgCenter_port": int(ports.get("msgCenter_port") or ports.get("ws_port") or 8765),
            "pdfFile_port": int(ports.get("pdfFile_port") or 8080),
        },
        "pdf_id": pdf_id or "",
    }

    # Update the data and write it back
    data["frontend"][key] = process_info
    data["_meta"] = {"updated": time.strftime("%Y-%m-%d %H:%M:%S")}
    write_json_atomic(path, data)


# ---- Actions ----
def _start_vite(npm_port: int) -> Optional[int]:
    LOGGER.info("Starting Vite dev server on port %s", npm_port)

    # Stop any tracked vite first
    dev_file = LOGS_DIR / "dev-process-info.json"
    dev_info = read_json(dev_file)
    old_pid = dev_info.get("vite", {}).get("pid") if isinstance(dev_info, dict) else None
    if old_pid:
        LOGGER.info("Found tracked vite PID %s; killing before start", old_pid)
        kill_process(int(old_pid))

    # test mode: skip spawning process
    if os.environ.get("AI_LAUNCHER_TEST_MODE") == "1":
        _save_dev_process(None, npm_port, "pnpm run dev -- --port %d" % npm_port)
        return None

    if NpmDevServerService is None:
        # Minimal fallback: spawn pnpm directly
        cmd = ["pnpm", "run", "dev", "--", "--port", str(npm_port)]
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(PROJECT_ROOT),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=True,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
            )
            _save_dev_process(proc.pid, npm_port, " ".join(cmd))
            time.sleep(1.0)
            return proc.pid
        except Exception as exc:
            LOGGER.error("Failed to start pnpm dev: %s", exc)
            _save_dev_process(None, npm_port, "pnpm run dev")
            return None

    service = NpmDevServerService(PROJECT_ROOT)
    ok = service.start({"port": int(npm_port)})
    pid = service.proc_manager.get_pid()
    _save_dev_process(pid if ok else None, npm_port, f"pnpm run dev -- --port {npm_port}")
    return pid if ok else None


def _start_backend(msgCenter_port: int | None, pdfFile_port: int | None) -> bool:
    if os.environ.get("AI_LAUNCHER_TEST_MODE") == "1":
        return True
    cmd = [sys.executable, str(PROJECT_ROOT / "src" / "backend" / "launcher.py"), "start"]
    if msgCenter_port:
        cmd += ["--msgCenter-port", str(msgCenter_port)]
    if pdfFile_port:
        cmd += ["--pdfFileServer-port", str(pdfFile_port)]
    LOGGER.info("Starting backend: %s", " ".join(cmd))
    try:
        rc = subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode
        if rc != 0:
            LOGGER.error("Backend start returned non-zero: %s", rc)
            return False
        return True
    except Exception as exc:
        LOGGER.error("Backend start failed: %s", exc)
        return False




def _start_frontend(module: str, ports: Dict[str, int], pdf_id: Optional[str]) -> Optional[int]:
    # Enhanced: stop ALL processes of the same module type before starting new one
    LOGGER.info("Stopping all existing processes for module '%s' before starting new instance", module)
    _stop_frontend(module_filter=module)

    launcher_map = {
        "pdf-home": PROJECT_ROOT / "src" / "frontend" / "pdf-home" / "launcher.py",
        "pdf-viewer": PROJECT_ROOT / "src" / "frontend" / "pdf-viewer" / "launcher.py",
    }
    path = launcher_map.get(module)
    if not path or not path.exists():
        LOGGER.error("Unknown or missing frontend module: %s", module)
        return None

    # test mode
    if os.environ.get("AI_LAUNCHER_TEST_MODE") == "1":
        _save_frontend_process(None, module, ports, pdf_id)
        return None

    vite = int(ports.get("npm_port") or ports.get("vite_port") or 3000)
    msgCenter = int(ports.get("msgCenter_port") or ports.get("ws_port") or 8765)
    pdf = int(ports.get("pdfFile_port") or 8080)

    cmd = [sys.executable, str(path), "--vite-port", str(vite), "--msgCenter-port", str(msgCenter), "--pdfFile-port", str(pdf)]

    # pdf-id参数直接传递给前端模块，让模块自己处理
    if pdf_id:
        cmd.extend(["--pdf-id", pdf_id])

    LOGGER.info("Starting frontend %s: %s", module, " ".join(cmd))
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        _save_frontend_process(proc.pid, module, ports, pdf_id)
        time.sleep(1.0)
        return proc.pid
    except Exception as exc:
        LOGGER.error("Failed to start frontend %s: %s", module, exc)
        _save_frontend_process(None, module, ports, pdf_id)
        return None


def _stop_vite() -> bool:
    ok = True
    # 1) Stop via ProcessManager if available
    if NpmDevServerService is not None:
        try:
            srv = NpmDevServerService(PROJECT_ROOT)
            srv.stop()
        except Exception:
            pass

    # 2) Kill by tracked PID
    dev_info = read_json(LOGS_DIR / "dev-process-info.json")
    pid = dev_info.get("vite", {}).get("pid") if isinstance(dev_info, dict) else None
    if pid:
        ok = kill_process(int(pid)) and ok
    # cleanup
    _save_dev_process(None, int(dev_info.get("vite", {}).get("port") or 3000) if isinstance(dev_info, dict) else 3000, cmdline="")
    return ok


def _stop_frontend(module_filter: Optional[str] = None) -> bool:
    """Stop tracked frontend processes. If module_filter provided, stop only that module."""
    path = LOGS_DIR / "frontend-process-info.json"
    info = read_json(path)
    frontend_processes = info.get("frontend", {})

    if not frontend_processes:
        return True

    all_ok = True
    keys_to_remove = []

    for key, process_info in frontend_processes.items():
        # If module_filter is provided, only stop processes that match the module
        if module_filter:
            # Extract module name from key (e.g., "pdf-viewer-xxx" -> "pdf-viewer")
            key_module = key.split("-")[0] + "-" + key.split("-")[1] if "-" in key and len(key.split("-")) >= 2 else key
            if key_module != module_filter:
                continue

        pid = process_info.get("pid")
        if pid and is_process_running(pid):
            LOGGER.info("Stopping frontend process '%s' (PID: %s)", key, pid)
            if not kill_process(int(pid)):
                all_ok = False

        # Mark this key for removal
        keys_to_remove.append(key)

    # Remove stopped processes from the tracking
    for key in keys_to_remove:
        if key in frontend_processes:
            del frontend_processes[key]

    # Update the file
    info["frontend"] = frontend_processes
    info["_meta"] = {"updated": time.strftime("%Y-%m-%d %H:%M:%S")}
    write_json_atomic(path, info)
    return all_ok


def _stop_backend() -> bool:
    if os.environ.get("AI_LAUNCHER_TEST_MODE") == "1":
        return True
    cmd = [sys.executable, str(PROJECT_ROOT / "src" / "backend" / "launcher.py"), "stop"]
    try:
        rc = subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode
        if rc != 0:
            LOGGER.warning("Backend stop returned non-zero: %s", rc)
            return False
        return True
    except Exception as exc:
        LOGGER.warning("Backend stop failed: %s", exc)
        return False


# ---- CLI ----
def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AI Launcher CLI")
    sub = p.add_subparsers(dest="command", required=True)

    def add_common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--vite-port", type=int, dest="vite_port")
        sp.add_argument("--msgServer-port", type=int, dest="msgServer_port")
        sp.add_argument("--pdfFileServer-port", type=int, dest="pdfFileServer_port")
        sp.add_argument("--pdfFileServer_port", type=int, dest="pdfFileServer_port_alt")
        sp.add_argument("--module", choices=["pdf-home", "pdf-viewer"], dest="module")
        sp.add_argument("--pdf-id", type=str, dest="pdf_id")

    add_common(sub.add_parser("start", help="Start vite, backend, and optional frontend"))
    sub.add_parser("stop", help="Stop vite, frontend, and backend")
    sub.add_parser("status", help="Show status for dev/frontend/backend")

    return p.parse_args(argv)


def cmd_start(args: argparse.Namespace) -> int:
    LOGGER.info("=== ai-launcher start ===")
    try:
        ports = _allocate_ports(args)
        vite_port = int(ports.get("npm_port") or 3000)
        msgCenter_port = int(ports.get("msgCenter_port") or ports.get("ws_port") or 8765)
        pdfFile_port = int(ports.get("pdfFile_port") or 8080)
        LOGGER.info("Resolved ports: vite=%s msgCenter=%s pdfFile=%s", vite_port, msgCenter_port, pdfFile_port)

        # 1) vite
        _start_vite(vite_port)

        # 2) backend
        _start_backend(msgCenter_port, pdfFile_port)

        # 3) frontend module if requested
        if getattr(args, "module", None):
            _start_frontend(args.module, ports, getattr(args, "pdf_id", None))

        return 0
    except Exception as exc:
        LOGGER.error("Start failed: %s", exc, exc_info=True)
        return 1


def cmd_stop() -> int:
    LOGGER.info("=== ai-launcher stop ===")
    rc = 0
    try:
        if not _stop_vite():
            rc = 1
        if not _stop_frontend():
            rc = 1
        if not _stop_backend():
            rc = 1
        return rc
    except Exception as exc:
        LOGGER.error("Stop failed: %s", exc, exc_info=True)
        return 1


def cmd_status() -> int:
    # Dev process status
    dev_path = LOGS_DIR / "dev-process-info.json"
    dev_info = read_json(dev_path)
    if dev_info.get("vite"):
        pid = dev_info["vite"].get("pid")
        if not is_process_running(pid):
            if dev_info["vite"].get("status") != "stopped":
                dev_info["vite"]["status"] = "stopped"
                write_json_atomic(dev_path, dev_info)

    # Frontend process status (iterating through all tracked processes)
    fe_path = LOGS_DIR / "frontend-process-info.json"
    fe_info = read_json(fe_path)
    if fe_info.get("frontend"):
        needs_update = False
        for key, process_info in fe_info["frontend"].items():
            pid = process_info.get("pid")
            if not is_process_running(pid):
                if process_info.get("status") != "stopped":
                    fe_info["frontend"][key]["status"] = "stopped"
                    needs_update = True
        if needs_update:
            write_json_atomic(fe_path, fe_info)

    print("--- dev-process-info.json ---")
    print(json.dumps(dev_info or {}, ensure_ascii=False, indent=2))
    print("\n--- frontend-process-info.json ---")
    print(json.dumps(fe_info or {}, ensure_ascii=False, indent=2))

    # Backend status
    cmd = [sys.executable, str(PROJECT_ROOT / "src" / "backend" / "launcher.py"), "status"]
    try:
        print("--- backend status ---")
        subprocess.run(cmd, cwd=str(PROJECT_ROOT), check=False)
    except Exception as exc:
        LOGGER.warning("Failed to run backend status: %s", exc)
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    if args.command == "start":
        return cmd_start(args)
    if args.command == "stop":
        return cmd_stop()
    if args.command == "status":
        return cmd_status()
    print("Unknown command")
    return 1


if __name__ == "__main__":
    sys.exit(main())

