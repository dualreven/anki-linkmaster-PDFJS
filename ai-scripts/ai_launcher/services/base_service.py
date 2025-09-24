#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from typing import Optional

from ..core.types import IService


class BaseService(IService):
    def __init__(self, name: str) -> None:
        self._name = name
        self._running = False

    def start(self) -> bool:
        self._running = True
        return True

    def stop(self) -> bool:
        self._running = False
        return True

    def status(self) -> str:
        return 'running' if self._running else 'stopped'

