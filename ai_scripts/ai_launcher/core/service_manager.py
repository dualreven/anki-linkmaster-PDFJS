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
import logging
from typing import Dict, Optional, List, Any

from .types import IService


class ServiceManager:
    def __init__(self) -> None:
        self._services: Dict[str, IService] = {}
        self._lock = threading.Lock()
        self.logger = logging.getLogger("ai-launcher.service-manager")

    def register(self, name: str, svc: IService) -> None:
        with self._lock:
            self._services[name] = svc
            self.logger.info(f"Service '{name}' registered.")

    def _get_services(self, names: Optional[List[str]] = None) -> List[IService]:
        with self._lock:
            if names:
                return [self._services[name] for name in names if name in self._services]
            return list(self._services.values())

    def start_all(self, service_configs: Dict[str, Dict[str, Any]]) -> bool:
        self.logger.info("Starting all services...")
        results = []
        with self._lock:
            services_to_start = list(self._services.items())
        
        for name, svc in services_to_start:
            config = service_configs.get(name, {})
            self.logger.info(f"Starting service '{name}' with config: {config}")
            try:
                result = svc.start(config)
                results.append(result)
                if not result:
                    self.logger.error(f"Failed to start service '{name}'")
            except Exception as e:
                self.logger.error(f"Exception while starting service '{name}': {e}", exc_info=True)
                results.append(False)

        return all(results)

    def stop_all(self) -> bool:
        self.logger.info("Stopping all services...")
        results = []
        with self._lock:
            services_to_stop = list(self._services.values())

        for svc in reversed(services_to_stop): # Stop in reverse order of registration
            try:
                results.append(svc.stop())
            except Exception as e:
                self.logger.error(f"Exception while stopping service '{svc.name}': {e}", exc_info=True)
                results.append(False)
        
        return all(results)

    def get_all_status(self) -> Dict[str, str]:
        with self._lock:
            items = list(self._services.items())
        return {k: v.status() for k, v in items}
