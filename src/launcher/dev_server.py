#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dev server utilities: 统一 Vite 开发服务器的确保/启动逻辑。

优先调用 ai_launcher._start_vite(port)；失败时回退到 `pnpm run dev -- --port <port>`。
所有日志与状态更新通过 src.launcher.ports 写入，保证 UTF-8 与行尾 \n。
"""
from __future__ import annotations

import os
import sys
import socket
import subprocess
from pathlib import Path
from typing import Optional, Tuple

from .ports import write_runtime_ports, update_dev_process_info


def _is_listening(host: str, port: int, timeout: float = 0.8) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except Exception:
        return False


def ensure_vite(port: int, *, component_root: Path, logs_dir: Path, ai_module: Optional[object] = None) -> Tuple[Optional[int], int]:
    """确保 Vite 在指定端口上运行；若未运行则尝试启动。

    Args:
        port: 期望的端口
        component_root: 组件根（作为 cwd）
        logs_dir: 日志目录（用于 npm-dev.log 与状态文件）
        ai_module: 可选的 ai_launcher 模块实例（含 _start_vite）
    Returns:
        (pid, used_port)；pid 可能为 None（不确定/不支持获取）
    """
    used_port = int(port or 3000)
    base = Path(logs_dir)
    base.mkdir(parents=True, exist_ok=True)

    if _is_listening('127.0.0.1', used_port):
        # 端口已监听，直接记录状态并返回
        update_dev_process_info(base, service='vite', pid=None, port=used_port, cmd=None)
        write_runtime_ports(base, {**{'vite_port': used_port, 'npm_port': used_port}})
        return None, used_port

    pid = None
    # 优先 ai_launcher._start_vite
    try:
        if ai_module is not None and hasattr(ai_module, '_start_vite'):
            pid = ai_module._start_vite(used_port)
    except Exception:
        pid = None

    # 回退：pnpm run dev
    if not pid:
        log_path = base / 'npm-dev.log'
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        try:
            with open(log_path, 'a', encoding='utf-8', newline='\n') as log_fp:
                cmd = ['pnpm', 'run', 'dev', '--', '--port', str(used_port)]
                subprocess.Popen(
                    cmd,
                    cwd=str(component_root),
                    stdin=subprocess.DEVNULL,
                    stdout=log_fp,
                    stderr=log_fp,
                    shell=(sys.platform == 'win32'),
                    creationflags=creation,
                )
        except Exception:
            pass

    # 写状态文件
    try:
        update_dev_process_info(base, service='vite', pid=pid, port=used_port, cmd=f"pnpm run dev -- --port {used_port}")
        write_runtime_ports(base, {**{'vite_port': used_port, 'npm_port': used_port}})
    except Exception:
        pass

    return pid, used_port

