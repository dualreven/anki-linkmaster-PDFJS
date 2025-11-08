#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUI Launcher — Skeleton Package

说明：
- 本包用于逐步将 gui_launcher.py 拆分为“视图 / 控制 / 服务”三个子模块；
- 当前为第一步（骨架落地），不改变现有行为，也未接入 gui_launcher.py；
- 后续将按计划逐步迁移实现与调用，保持对外契约不变。

编码与换行：
- 所有源文件使用 UTF-8 编码，确保换行为 \n。
"""

from .ui import get_version as ui_version  # noqa: F401
from .services import ensure_vite as ensure_vite_service  # noqa: F401
from .controller import Controller  # noqa: F401

__all__ = [
    "ui_version",
    "ensure_vite_service",
    "Controller",
]

