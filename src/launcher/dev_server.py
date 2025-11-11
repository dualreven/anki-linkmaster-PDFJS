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

from .ports import update_dev_process_info, merge_runtime_ports
from core_utils.process_utils import kill_process_tree, is_process_running


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
        # 合并写入，避免覆盖后端已写入的 ws/http 端口
        merge_runtime_ports(base, {'vite_port': used_port, 'npm_port': used_port})
        return None, used_port

    pid = None
    # 优先 ai_launcher._start_vite
    try:
        if ai_module is not None and hasattr(ai_module, '_start_vite'):
            pid = ai_module._start_vite(used_port)
    except Exception:
        pid = None

    # 回退：尝试多种包管理器命令
    if not pid:
        log_path = base / 'npm-dev.log'
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        try:
            with open(log_path, 'a', encoding='utf-8', newline='\n') as log_fp:
                # 依次尝试：pnpm → npm → yarn
                candidates = [
                    f"pnpm run dev -- --port {used_port}",
                    f"npm run dev -- --port {used_port}",
                    f"yarn dev --port {used_port}",
                ]
                launched = False
                for cmd_str in candidates:
                    try:
                        log_fp.write(f"[LAUNCHER] try: {cmd_str}\n")
                        subprocess.Popen(
                            cmd_str,
                            cwd=str(component_root),
                            stdin=subprocess.DEVNULL,
                            stdout=log_fp,
                            stderr=log_fp,
                            shell=True,
                            creationflags=creation,
                        )
                        launched = True
                        break
                    except FileNotFoundError:
                        continue
                    except Exception:
                        continue
                if not launched:
                    log_fp.write("[LAUNCHER] failed: no package manager command found in PATH\n")
        except Exception:
            pass

    # 等待端口就绪（最多 ~30s），就绪后才持久化 vite/npm 端口；否则不写入，避免假阳性
    import time as _time
    ready = False
    deadline = _time.time() + 30.0
    while _time.time() < deadline:
        if _is_listening('127.0.0.1', used_port):
            ready = True
            break
        _time.sleep(0.5)

    # 写状态文件（记录端口是否就绪）
    try:
        update_dev_process_info(base, service='vite', pid=pid, port=(used_port if ready else None), cmd=f"pnpm run dev -- --port {used_port}")
        if ready:
            # 合并写入，避免覆盖后端已写入的 ws/http 端口
            merge_runtime_ports(base, {'vite_port': used_port, 'npm_port': used_port})
        else:
            # 清理陈旧 vite/npm 端口，避免误导后续流程
            merge_runtime_ports(base, {'vite_port': None, 'npm_port': None})
    except Exception:
        pass

    return pid, used_port


def stop_vite(*, logs_dir: Path) -> bool:
    """
    停止 Vite 开发服务器（根据 dev-process-info.json 中记录的 PID）。

    Args:
        logs_dir: 日志目录（包含 dev-process-info.json）
    Returns:
        bool: 是否成功停止或已不在运行
    """
    base = Path(logs_dir)
    base.mkdir(parents=True, exist_ok=True)
    info_path = base / "dev-process-info.json"
    pid = None
    try:
        data = __import__("json").loads(info_path.read_text(encoding="utf-8") or "{}") if info_path.exists() else {}
        vite_info = data.get("vite") or data.get("vite_dev") or {}
        pid = vite_info.get("pid")
    except Exception:
        pid = None
    ok = True
    if pid:
        try:
            if is_process_running(int(pid)):
                ok = kill_process_tree(int(pid), timeout=5.0)
        except Exception:
            ok = False
    # 更新状态文件
    try:
        update_dev_process_info(base, service="vite", pid=None, port=None, cmd=None)
    except Exception:
        pass
    # 清理 vite/npm 端口（不影响 ws/http）
    try:
        merge_runtime_ports(base, {"vite_port": None, "npm_port": None})
    except Exception:
        pass
    return bool(ok)
