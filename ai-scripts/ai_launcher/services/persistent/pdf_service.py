#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from ...core.process_manager import ProcessManager
from ..base_service import BaseService


class PdfHttpFileService(BaseService):
    """Start HTTP file server process (Qt-based) in isolation."""

    def __init__(self, script: str = 'src/backend/http_server.py') -> None:
        super().__init__('pdf-file-server')
        self._pm = ProcessManager()
        self._script = script

    def start(self) -> bool:
        ok = self._pm.start(['python', self._script])
        self._running = ok
        return ok

    def stop(self) -> bool:
        ok = self._pm.stop()
        self._running = not ok
        return ok

    def status(self) -> str:
        return self._pm.status()

