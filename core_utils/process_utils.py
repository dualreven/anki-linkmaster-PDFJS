#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time
from typing import Optional

try:
    import psutil
except ImportError:
    psutil = None

LOGGER = logging.getLogger(__name__)


def kill_process_tree(pid: int, timeout: float = 3.0) -> bool:
    """
    Robustly kills a process and all its descendants (process tree).

    This function prioritizes using psutil for its accuracy in process tree
    traversal. If psutil is not available, it falls back to OS-specific
    commands.

    Args:
        pid: The process ID of the parent process to kill.
        timeout: Time in seconds to wait for graceful termination before forcing.

    Returns:
        True if the process was killed successfully, False otherwise.
    """
    if not is_process_running(pid):
        LOGGER.info(f"Process with PID {pid} is not running.")
        return True

    LOGGER.info(f"Attempting to kill process tree starting from PID {pid}...")

    try:
        if psutil:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)
            
            # Terminate children first
            for child in children:
                try:
                    child.terminate()
                except psutil.NoSuchProcess:
                    pass
            
            # Terminate parent
            parent.terminate()
            
            # Wait for termination
            gone, alive = psutil.wait_procs([parent] + children, timeout=timeout)
            
            # Force kill any remaining processes
            for p in alive:
                try:
                    LOGGER.warning(f"Process {p.pid} did not terminate gracefully. Forcing kill.")
                    p.kill()
                except psutil.NoSuchProcess:
                    pass
            return not is_process_running(pid)

        # Fallback if psutil is not installed
        elif sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                check=False,
                capture_output=True
            )
            return not is_process_running(pid)

        else:  # Linux/macOS
            try:
                pgid = os.getpgid(pid)
                os.killpg(pgid, signal.SIGTERM)
                time.sleep(timeout)
                if is_process_running(pid):
                    LOGGER.warning(f"Process group {pgid} did not terminate. Sending SIGKILL.")
                    os.killpg(pgid, signal.SIGKILL)
                return not is_process_running(pid)
            except ProcessLookupError:
                return True # Already gone

    except Exception as e:
        LOGGER.error(f"Failed to kill process tree for PID {pid}: {e}", exc_info=True)
        # Final check, maybe it died anyway
        return not is_process_running(pid)


def is_process_running(pid: Optional[int]) -> bool:
    """Cross-platform check if a process is running."""
    if pid is None:
        return False
    
    if psutil:
        return psutil.pid_exists(pid)

    try:
        if sys.platform == "win32":
            res = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}"],
                capture_output=True,
                check=False,
                text=True,
            )
            return str(pid) in res.stdout
        else:
            os.kill(int(pid), 0)
            return True
    except (OSError, subprocess.CalledProcessError):
        return False
    except Exception:
        return False