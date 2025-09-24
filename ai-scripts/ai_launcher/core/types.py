#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

from typing import Protocol


class IService(Protocol):
    def start(self) -> bool: ...
    def stop(self) -> bool: ...
    def status(self) -> str: ...

