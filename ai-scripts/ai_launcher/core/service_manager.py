#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Minimal modular ServiceManager for ai-launcher

Goals:
- Keep services modular and short
- Provide start/stop/status lifecycle
- UTF-8 file IO for any state files
"""

from __future__ import annotations

import threading
from typing import Dict, Optional

from .types import IService


class ServiceManager:
    def __init__(self) -> None:
        self._services: Dict[str, IService] = {}
        self._lock = threading.Lock()

    def register(self, name: str, svc: IService) -> None:
        with self._lock:
            self._services[name] = svc

    def start(self, name: str) -> bool:
        with self._lock:
            svc = self._services.get(name)
        if not svc:
            return False
        return bool(svc.start())

    def stop(self, name: str) -> bool:
        with self._lock:
            svc = self._services.get(name)
        if not svc:
            return False
        return bool(svc.stop())

    def status(self, name: str) -> str:
        with self._lock:
            svc = self._services.get(name)
        if not svc:
            return 'unknown'
        return svc.status()

    def all_status(self) -> Dict[str, str]:
        with self._lock:
            items = list(self._services.items())
        return {k: v.status() for k, v in items}

