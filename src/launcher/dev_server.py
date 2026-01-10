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

from .ports import update_dev_process_info, merge_runtime_ports, read_runtime_ports
from core_utils.process_utils import kill_process_tree, is_process_running


def _is_listening(host: str, port: int, timeout: float = 0.8) -> bool:
    """
    尝试在 IPv4/IPv6 多地址上检测端口监听状态，兼容仅 ::1 监听的场景。
    """
    try:
        candidates = [host] if host else []
        for h in ("localhost", "127.0.0.1", "::1"):
            if h not in candidates:
                candidates.append(h)
        for h in candidates:
            try:
                infos = socket.getaddrinfo(h, int(port), type=socket.SOCK_STREAM)
            except Exception:
                infos = []
            for family, socktype, proto, _cn, sa in infos:
                s = None
                try:
                    s = socket.socket(family, socktype, proto)
                    s.settimeout(timeout)
                    s.connect(sa)
                    return True
                except Exception:
                    pass
                finally:
                    try:
                        if s:
                            s.close()
                    except Exception:
                        pass
    except Exception:
        pass
    return False


def _is_listening_exact(host: str, port: int, timeout: float = 0.8) -> bool:
    """
    严格检测：仅检测给定 host 是否可连通（不做 localhost/IPv6 回退）。

    背景：QtWebEngine 在 Windows 上可能将 "localhost" 解析为 IPv4/IPv6 的不确定组合；
    若 Vite 仅监听 ::1，而前端 URL 使用 127.0.0.1（或反之），会导致动态 import 失败。
    """
    try:
        infos = socket.getaddrinfo(host, int(port), type=socket.SOCK_STREAM)
    except Exception:
        infos = []

    for family, socktype, proto, _cn, sa in infos:
        s = None
        try:
            s = socket.socket(family, socktype, proto)
            s.settimeout(timeout)
            s.connect(sa)
            return True
        except Exception:
            pass
        finally:
            try:
                if s:
                    s.close()
            except Exception:
                pass
    return False


def _find_free_port(start: int, limit: int = 50) -> int:
    """
    从 start 起向上寻找一个未被占用的本地端口。
    - 仅检查 127.0.0.1；
    - 最大尝试 limit 次；
    - 若范围内均被占用，则返回 start（由上层再等待/失败处理）。
    """
    p = int(start or 3000)
    for _ in range(max(1, int(limit))):
        if not _is_listening("127.0.0.1", p):
            return p
        p += 1
    return int(start or 3000)


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

    # 若 runtime-ports.json 已声明 vite_port 且端口在监听，直接承认并返回
    try:
        rp = read_runtime_ports(base)
        rp_vite = rp.get("vite_port") or rp.get("npm_port")
        # 注意：前端 URL 已统一为 127.0.0.1，因此这里必须做“IPv4 可达”校验
        if rp_vite and _is_listening_exact("127.0.0.1", int(rp_vite)):
            update_dev_process_info(base, service="vite", pid=None, port=int(rp_vite), cmd=None)
            merge_runtime_ports(base, {"vite_port": int(rp_vite), "npm_port": int(rp_vite), "url_port": int(rp_vite)})
            return None, int(rp_vite)
    except Exception:
        # 读取失败不影响后续流程
        pass

    # 若目标端口已有 Vite（且 IPv4 可达），直接记录状态并返回；避免误把 ::1-only 服务当作可用
    if _is_listening_exact('127.0.0.1', used_port):
        # 端口已监听，直接记录状态并返回
        update_dev_process_info(base, service='vite', pid=None, port=used_port, cmd=None)
        # 合并写入，避免覆盖后端已写入的 ws/http 端口
        merge_runtime_ports(base, {'vite_port': used_port, 'npm_port': used_port, 'url_port': used_port})
        return None, used_port

    pid = None
    # 优先 ai_launcher._start_vite
    try:
        if ai_module is not None and hasattr(ai_module, '_start_vite'):
            # 若目标端口已被占用（哪怕仅 ::1 可达），先选择一个空闲端口再启动，避免“启动即失败/端口冲突”
            used_port = _find_free_port(used_port, limit=100)
            pid = ai_module._start_vite(used_port)
    except Exception:
        pid = None

    # 回退：尝试多种包管理器命令（带严格端口与多次重试）
    if not pid:
        log_path = base / 'npm-dev.log'
        creation = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0

        def _spawn_on(port_to_use: int) -> tuple[Optional[int], int]:
            """在指定端口上以 --strictPort 启动一次，返回 (pid, port)。"""
            local_pid: Optional[int] = None
            try:
                with open(log_path, 'a', encoding='utf-8', newline='\n') as log_fp:
                    # 通过环境变量与 vite.config.js 对齐，避免 CLI 标志被忽略
                    candidates = [
                        "pnpm run dev",
                        "npm run dev",
                        "yarn dev",
                    ]
                    # 复制当前环境，注入 VITE_HOST/VITE_PORT/VITE_STRICT_PORT，以让 vite.config.js 正确读取
                    env = dict(os.environ)
                    env["VITE_HOST"] = "127.0.0.1"
                    env["VITE_PORT"] = str(int(port_to_use))
                    env["VITE_STRICT_PORT"] = "true"
                    env_desc = f"VITE_HOST={env['VITE_HOST']} VITE_PORT={env['VITE_PORT']} VITE_STRICT_PORT={env['VITE_STRICT_PORT']}"
                    for cmd_str in candidates:
                        try:
                            log_fp.write(f"[LAUNCHER] try: {env_desc} {cmd_str}\n")
                            proc = subprocess.Popen(
                                cmd_str,
                                cwd=str(component_root),
                                stdin=subprocess.DEVNULL,
                                stdout=log_fp,
                                stderr=log_fp,
                                shell=True,
                                creationflags=creation,
                                env=env,
                            )
                            local_pid = int(getattr(proc, "pid", 0) or 0) or None
                            try:
                                update_dev_process_info(base, service='vite', pid=local_pid, port=None, cmd=f"{env_desc} {cmd_str}")
                            except Exception:
                                pass
                            break
                        except FileNotFoundError:
                            continue
                        except Exception:
                            continue
            except Exception:
                pass
            return local_pid, port_to_use

        # 初始端口：尽量选择空闲端口；若 race 导致失败，将向上递增重试
        attempt_port = _find_free_port(used_port, limit=100)
        attempts = 0
        max_attempts = 4
        while attempts < max_attempts and not pid:
            attempts += 1
            pid, launch_port = _spawn_on(attempt_port)
            # 快速就绪探测（每次重试不必等满 30s）
            import time as _time
            ready_quick = False
            t_deadline = _time.time() + 8.0
            while _time.time() < t_deadline:
                if _is_listening_exact('127.0.0.1', launch_port):
                    ready_quick = True
                    break
                _time.sleep(0.4)
            if ready_quick:
                used_port = launch_port
                break
            # 若未就绪，尝试终止并换下一个空闲端口
            try:
                if pid:
                    kill_process_tree(int(pid), timeout=3.0)
            except Exception:
                pass
            pid = None
            # 寻找下一候选端口
            attempt_port = _find_free_port(launch_port + 1, limit=100)

        # 若仍未拿到 pid（或未快速就绪），继续保留原有 30s 等待流程；等待端口为最后尝试端口
        if pid:
            # 将等待端口设为最后尝试端口
            launch_port = int(locals().get("launch_port", attempt_port))
        else:
            # 未能成功拉起进程，等待端口沿用最后尝试值
            launch_port = int(attempt_port)

    # 等待端口就绪（最多 ~30s），就绪后才持久化 vite/npm 端口；否则不写入，避免假阳性
    import time as _time
    ready = False
    deadline = _time.time() + 30.0
    # 等待的是 launch_port（若未设置则回退到 used_port）
    wait_port = locals().get("launch_port", used_port)

    # 若为 ai_module 启动路径：尝试在等待期间扫描 [used_port, used_port+40] 的可用端口（Vite 可能已改用其他端口）
    if pid and ai_module is not None and not _is_listening('127.0.0.1', wait_port):
        scan_min = int(used_port)
        scan_max = scan_min + 40
    else:
        scan_min = None
        scan_max = None

    while _time.time() < deadline:
        if _is_listening_exact('127.0.0.1', wait_port):
            ready = True
            break
        # ai 路径的“端口漂移”处理：扫描一小段端口，若发现监听则采用该端口
        if scan_min is not None:
            for p in range(scan_min, scan_max + 1):
                if _is_listening_exact('127.0.0.1', p):
                    wait_port = p
                    ready = True
                    break
            if ready:
                break
        _time.sleep(0.5)

    # 写状态文件（记录端口是否就绪）
    try:
        # 以环境变量为主的启动路径下，记录一致的 cmd 描述
        cmd_desc = f"VITE_PORT={wait_port} VITE_STRICT_PORT=true pnpm run dev"
        update_dev_process_info(base, service='vite', pid=pid, port=(wait_port if ready else None), cmd=cmd_desc)
        if ready:
            # 合并写入，避免覆盖后端已写入的 ws/http 端口
            merge_runtime_ports(base, {'vite_port': wait_port, 'npm_port': wait_port, 'url_port': wait_port})
        else:
            # 清理陈旧 vite/npm 端口，避免误导后续流程
            try:
                current = read_runtime_ports(base)
                if (current.get('url_port') in (wait_port, used_port)) or (current.get('vite_port') in (wait_port, used_port)):
                    merge_runtime_ports(base, {'vite_port': None, 'npm_port': None, 'url_port': None})
                else:
                    merge_runtime_ports(base, {'vite_port': None, 'npm_port': None})
            except Exception:
                merge_runtime_ports(base, {'vite_port': None, 'npm_port': None})
    except Exception:
        pass

    return pid, wait_port


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
        current = read_runtime_ports(base)
        if current.get("url_port") in (current.get("vite_port"), current.get("npm_port")):
            merge_runtime_ports(base, {"vite_port": None, "npm_port": None, "url_port": None})
        else:
            merge_runtime_ports(base, {"vite_port": None, "npm_port": None})
    except Exception:
        pass
    return bool(ok)
