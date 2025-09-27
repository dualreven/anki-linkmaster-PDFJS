#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from pathlib import Path
from typing import Dict, Any

from ..core.process_manager import ProcessManager
from ..core.types import IService


class BaseService(IService):
    def __init__(self, service_name: str, project_root: Path):
        self._name = service_name
        self.project_root = project_root
        self.proc_manager = ProcessManager(service_name, project_root)

    @property
    def name(self) -> str:
        return self._name

    def start(self, config: Dict[str, Any]) -> bool:
        raise NotImplementedError

    def stop(self) -> bool:
        return self.proc_manager.stop()

    def status(self) -> str:
        return self.proc_manager.status()
