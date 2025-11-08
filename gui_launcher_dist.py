#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gui_launcher_dist

为 GUI 启动器测试提供最小实现（契约级别），不依赖打包产物。
- get_dist_latest_root(): 返回一个存在的路径（此处返回 repo 根目录 / dist/latest，如不存在则回退到 repo 根目录）
- get_launcher_paths(): 返回后端与前端各自 launcher.py 的实际源码路径
- build_*_cmd(): 构造以 Python 解释器执行对应 launcher 的命令，包含 -X utf8

严格 UTF-8 与 \\n 换行。
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict

PROJECT_ROOT = Path(__file__).resolve().parent


def get_dist_latest_root() -> Path:
    """返回一个可用的 dist/latest 根路径；如不存在则返回项目根目录"""
    dl = PROJECT_ROOT / "dist" / "latest"
    return dl if dl.exists() else PROJECT_ROOT


def get_launcher_paths() -> Dict[str, Path]:
    """返回后端与前端 launcher 脚本路径"""
    return {
        "backend": PROJECT_ROOT / "src" / "backend" / "launcher.py",
        "pdf_home": PROJECT_ROOT / "src" / "frontend" / "pdf-home" / "launcher.py",
        "pdf_viewer": PROJECT_ROOT / "src" / "frontend" / "pdf-viewer" / "launcher.py",
    }


def _py_utf8_prefix() -> list[str]:
    return [sys.executable, "-X", "utf8"]


def build_backend_cmd(action: str = "start") -> list[str]:
    paths = get_launcher_paths()
    backend = paths["backend"]
    return _py_utf8_prefix() + [str(backend), action]


def build_pdf_home_cmd(*, prod: bool = False, keep_backend: bool = False) -> list[str]:
    paths = get_launcher_paths()
    home = paths["pdf_home"]
    cmd = _py_utf8_prefix() + [str(home)]
    if prod:
        cmd.append("--prod")
    if keep_backend:
        cmd.append("--keep-backend")
    return cmd


def build_pdf_viewer_cmd(*, pdf_id: str | None = None, page_at: int | None = None,
                         position: float | None = None, prod: bool = False, keep_backend: bool = False) -> list[str]:
    paths = get_launcher_paths()
    viewer = paths["pdf_viewer"]
    cmd = _py_utf8_prefix() + [str(viewer)]
    if prod:
        cmd.append("--prod")
    if keep_backend:
        cmd.append("--keep-backend")
    if pdf_id:
        cmd += ["--pdf-id", str(pdf_id)]
    if page_at is not None:
        cmd += ["--page-at", str(page_at)]
    if position is not None:
        cmd += ["--position", str(position)]
    return cmd


__all__ = [
    "get_dist_latest_root",
    "get_launcher_paths",
    "build_backend_cmd",
    "build_pdf_home_cmd",
    "build_pdf_viewer_cmd",
]

