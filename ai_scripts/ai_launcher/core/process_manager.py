#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import subprocess
import sys
import json
import logging
import time
from pathlib import Path
from typing import Optional, List, Dict

try:
    import psutil
except ImportError:
    psutil = None


class ProcessManager:
    def __init__(self, service_name: str, project_root: Path):
        self.service_name = service_name
        self.project_root = project_root
        self.logs_dir = self.project_root / "logs"
        self.pid_file = self.logs_dir / "process-info-persistent.json"
        self.log_file = self.logs_dir / f"{service_name}.log"
        self.logger = logging.getLogger(f"ai-launcher.process.{service_name}")

        self.logs_dir.mkdir(exist_ok=True)

    def _read_pids(self) -> Dict[str, int]:
        if not self.pid_file.exists():
            return {}
        try:
            with open(self.pid_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                self.logger.warning("PID file is malformed (not a dict), ignoring content.")
                return {}
        except (json.JSONDecodeError, IOError):
            return {}

    def _write_pids(self, pids: Dict[str, int]) -> None:
        try:
            with open(self.pid_file, 'w', encoding='utf-8') as f:
                json.dump(pids, f, indent=2)
        except IOError as e:
            self.logger.error(f"Failed to write PID file: {e}")

    def get_pid(self) -> Optional[int]:
        pids = self._read_pids()
        return pids.get(self.service_name)

    def is_running(self) -> bool:
        pid = self.get_pid()
        if not pid:
            return False
        if psutil:
            return psutil.pid_exists(pid)

        if sys.platform == "win32":
            try:
                output = subprocess.check_output(
                    f'tasklist /FI "PID eq {pid}"',
                    stderr=subprocess.STDOUT,
                    text=True
                )
                return str(pid) in output
            except subprocess.CalledProcessError:
                return False
        else:
            try:
                import os
                os.kill(pid, 0)
            except OSError:
                return False
            else:
                return True

    def start(self, argv: List[str], cwd: Optional[str] = None, shell: bool = False,
              check_delay: float = 0.5, env: Optional[Dict[str, str]] = None,
              capture_log: bool = False) -> bool:
        if self.is_running():
            self.logger.info("Service is already running. Stopping first.")
            self.stop()

        try:
            command = ' '.join(argv) if shell else argv
            if capture_log:
                with open(self.log_file, 'w', encoding='utf-8') as log_fp:
                    proc = subprocess.Popen(
                        command,
                        cwd=cwd or None,
                        stdin=subprocess.DEVNULL,
                        stdout=log_fp,
                        stderr=log_fp,
                        text=True,
                        encoding='utf-8',
                        shell=shell,
                        env=env,
                        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
                    )
            else:
                proc = subprocess.Popen(
                    command,
                    cwd=cwd or None,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding='utf-8',
                    shell=shell,
                    env=env,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
                )

            pids = self._read_pids()
            pids[self.service_name] = proc.pid
            self._write_pids(pids)
            self.logger.info("Service started successfully with PID %s. Logs at %s", proc.pid, self.log_file)

            if check_delay > 0:
                time.sleep(check_delay)
                retcode = proc.poll()
                if retcode is not None:
                    self.logger.error(
                        "Service '%s' exited shortly after start (code %s). See %s",
                        self.service_name,
                        retcode,
                        self.log_file
                    )
                    tail = self.tail_log()
                    if capture_log and tail:
                        self.logger.error("Last output for '%s':\n%s", self.service_name, tail)
                    self._cleanup_pid()
                    return False

            return True
        except Exception as e:
            self.logger.error(f"Failed to start service: {e}", exc_info=True)
            return False

    def stop(self, timeout: float = 5.0) -> bool:
        pid = self.get_pid()
        if not pid:
            self.logger.info("Service not running (no PID found).")
            return True

        if not self.is_running():
            self.logger.info(f"Service with PID {pid} is not running. Cleaning up PID file.")
            self._cleanup_pid()
            return True

        self.logger.info(f"Attempting to stop service with PID {pid}...")
        try:
            if psutil:
                parent = psutil.Process(pid)
                children = parent.children(recursive=True)
                for child in children:
                    try:
                        child.terminate()
                    except psutil.NoSuchProcess:
                        pass
                parent.terminate()
                gone, alive = psutil.wait_procs([parent] + children, timeout=timeout)
                for p in alive:
                    try:
                        p.kill()
                    except psutil.NoSuchProcess:
                        pass
            else:
                import os
                import signal
                if sys.platform == "win32":
                    subprocess.run(f"taskkill /F /T /PID {pid}", check=False, capture_output=True)
                else:
                    os.kill(pid, signal.SIGTERM)

            self.logger.info("Service stopped.")
        except Exception as e:
            self.logger.error(f"Error while stopping service with PID {pid}: {e}", exc_info=True)
        finally:
            self._cleanup_pid()

        return not self.is_running()

    def _cleanup_pid(self):
        pids = self._read_pids()
        if self.service_name in pids:
            del pids[self.service_name]
            self._write_pids(pids)

    def status(self) -> str:
        if self.is_running():
            return f'running (PID: {self.get_pid()})'
        return 'stopped'

    def tail_log(self, lines: int = 20) -> str:
        if not self.log_file.exists():
            return ""
        try:
            with open(self.log_file, 'r', encoding='utf-8') as fp:
                rows = fp.readlines()
            tail_rows = rows[-lines:]
            return ''.join(tail_rows).rstrip()
        except Exception as exc:
            self.logger.warning("Failed to read tail for '%s': %s", self.log_file, exc)
            return ""
