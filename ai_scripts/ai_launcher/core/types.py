#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from typing import Protocol, Dict, Any


class IService(Protocol):
    @property
    def name(self) -> str:
        ...

    def start(self, config: Dict[str, Any]) -> bool:
        ...

    def stop(self) -> bool:
        ...

    def status(self) -> str:
        ...
