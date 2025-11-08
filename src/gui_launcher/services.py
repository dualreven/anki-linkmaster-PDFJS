#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Services Layer (Skeleton)

目标：
- 以轻量包装方式复用现有 src/launcher/* 工具，形成后续可替身化的服务接口；
- 本模块仅做转发与最小粘合，不改变现有行为；
- 不在导入时引入 PyQt 依赖，避免测试环境负担。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional, Tuple


def ensure_vite(port: int, *, component_root: Path, logs_dir: Path, ai_module: Optional[object] = None) -> Tuple[Optional[int], int]:
    """
    转发至 src.launcher.dev_server.ensure_vite。
    """
    from src.launcher.dev_server import ensure_vite as _ensure_vite  # 延迟导入，避免不必要的依赖
    return _ensure_vite(port, component_root=component_root, logs_dir=logs_dir, ai_module=ai_module)


def read_runtime_ports(base_logs: Path) -> Dict[str, Any]:
    """
    转发至 src.launcher.ports.read_runtime_ports。
    """
    from src.launcher.ports import read_runtime_ports as _read  # 延迟导入
    return _read(base_logs)


def merge_runtime_ports(base_logs: Path, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    新增的合并写入能力（后续 GUI 将调用此函数而非直接写文件）。
    """
    from src.launcher.ports import merge_runtime_ports as _merge  # 延迟导入
    return _merge(base_logs, updates)


# Runner 转发封装（Hosted/CLI 启动路径）
def start_backend_hosted(cfg, *, parent_app, on_log=None):
    """转发至 src.launcher.runner.start_backend_hosted。"""
    from src.launcher.runner import start_backend_hosted as _start  # 延迟导入
    return _start(cfg, parent_app=parent_app, on_log=on_log)


def start_backend_cli(cfg, *, on_log=None) -> bool:
    """转发至 src.launcher.runner.start_backend_cli。"""
    from src.launcher.runner import start_backend_cli as _start  # 延迟导入
    return _start(cfg, on_log=on_log)


def start_pdf_home_hosted(cfg, *, parent_app, on_log=None) -> int:
    """转发至 src.launcher.runner.start_pdf_home_hosted。"""
    from src.launcher.runner import start_pdf_home_hosted as _start  # 延迟导入
    return _start(cfg, parent_app=parent_app, on_log=on_log)


def start_pdf_viewer_hosted(cfg, *, parent_app, pdf_id=None,
                            page_at=None, position=None,
                            anchor_id=None, annotation_id=None,
                            outline_item_id=None, enable_outline=None,
                            on_log=None) -> int:
    """转发至 src.launcher.runner.start_pdf_viewer_hosted（完整透传参数）。"""
    from src.launcher.runner import start_pdf_viewer_hosted as _start  # 延迟导入
    return _start(
        cfg, parent_app=parent_app, pdf_id=pdf_id,
        page_at=page_at, position=position,
        anchor_id=anchor_id, annotation_id=annotation_id,
        outline_item_id=outline_item_id, enable_outline=enable_outline,
        on_log=on_log
    )


def start_pdf_home_cli(cfg, *, is_prod: bool, on_log=None) -> bool:
    """转发至 src.launcher.runner.start_pdf_home_cli。"""
    from src.launcher.runner import start_pdf_home_cli as _start  # 延迟导入
    return _start(cfg, is_prod=bool(is_prod), on_log=on_log)


def start_pdf_viewer_cli(cfg, *, is_prod: bool, pdf_id=None,
                         page_at=None, position=None,
                         anchor_id=None, annotation_id=None,
                         outline_item_id=None,
                         on_log=None) -> bool:
    """转发至 src.launcher.runner.start_pdf_viewer_cli（完整透传参数）。"""
    from src.launcher.runner import start_pdf_viewer_cli as _start  # 延迟导入
    return _start(
        cfg, is_prod=bool(is_prod), pdf_id=pdf_id,
        page_at=page_at, position=position,
        anchor_id=anchor_id, annotation_id=annotation_id,
        outline_item_id=outline_item_id,
        on_log=on_log
    )


# 未来迁移方向（仅注释，不执行）：
# def send_ws_message(...): ...
