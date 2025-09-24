#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from ...core.process_manager import ProcessManager
from ..base_service import BaseService


class NpmDevServerService(BaseService):
    """Start Vite/Node dev server with npm or npx.
    This is a placeholder and does not access network unless invoked.
    """

    def __init__(self, cwd: str = '.') -> None:
        super().__init__('npm-dev-server')
        self._pm = ProcessManager()
        self._cwd = cwd

    def start(self) -> bool:
        # Prefer npx vite if available
        ok = self._pm.start(['npx', 'vite', '--host', 'localhost'], cwd=self._cwd)
        self._running = ok
        return ok

    def stop(self) -> bool:
        ok = self._pm.stop()
        self._running = not ok
        return ok

    def status(self) -> str:
        return self._pm.status()

