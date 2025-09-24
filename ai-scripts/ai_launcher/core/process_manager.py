#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Optional, List


class ProcessManager:
    def __init__(self) -> None:
        self._proc: Optional[subprocess.Popen] = None

    def start(self, argv: List[str], cwd: Optional[str] = None) -> bool:
        if self._proc and self._proc.poll() is None:
            return True
        try:
            self._proc = subprocess.Popen(
                argv,
                cwd=cwd or None,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
            )
            return True
        except Exception:
            return False

    def stop(self, timeout: float = 2.0) -> bool:
        if not self._proc:
            return True
        try:
            self._proc.terminate()
            self._proc.wait(timeout=timeout)
        except Exception:
            try:
                self._proc.kill()
            except Exception:
                pass
        finally:
            self._proc = None
        return True

    def status(self) -> str:
        if not self._proc:
            return 'stopped'
        return 'running' if self._proc.poll() is None else 'stopped'

