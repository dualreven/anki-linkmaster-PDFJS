#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ports utilities: 集中管理 runtime-ports.json 与 dev-process-info.json 的读写。

注意：所有文件读写显式 UTF-8 且确保行尾为 \n。
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, Tuple

import json


def read_runtime_ports(base_logs: Path) -> Dict[str, Any]:
    """读取 base_logs/runtime-ports.json。不存在或异常时返回空 dict。

    Args:
        base_logs: 日志目录路径（应为 <component_root>/logs 或用户指定）
    Returns:
        dict: {vite_port?, npm_port?, msgCenter_port?, pdfFile_port?, ...}
    """
    try:
        p = Path(base_logs) / 'runtime-ports.json'
        if p.exists():
            return json.loads(p.read_text(encoding='utf-8') or '{}')
    except Exception:
        pass
    return {}


def write_runtime_ports(base_logs: Path, payload: Dict[str, Any]) -> None:
    """写入 base_logs/runtime-ports.json。

    Args:
        base_logs: 日志目录
        payload: 需要写入的端口字典
    """
    try:
        base = Path(base_logs)
        base.mkdir(parents=True, exist_ok=True)
        p = base / 'runtime-ports.json'
        txt = json.dumps(payload or {}, ensure_ascii=False, indent=2) + "\n"
        p.write_text(txt, encoding='utf-8')
    except Exception:
        # 写失败不抛出，避免阻断 GUI 逻辑
        pass


def update_dev_process_info(base_logs: Path, *, service: str, pid: int | None, port: int | None, cmd: str | None) -> None:
    """更新 base_logs/dev-process-info.json 中的服务进程信息。

    Args:
        base_logs: 日志目录
        service: 服务名（如 'vite'）
        pid: 进程 PID（可为 None）
        port: 监听端口（可为 None）
        cmd: 启动命令字符串（可为 None）
    """
    try:
        base = Path(base_logs)
        base.mkdir(parents=True, exist_ok=True)
        p = base / 'dev-process-info.json'
        try:
            data = json.loads(p.read_text(encoding='utf-8') or '{}') if p.exists() else {}
        except Exception:
            data = {}
        data.setdefault(service, {})
        if pid is not None:
            data[service]['pid'] = int(pid)
        else:
            data[service]['pid'] = None
        if port is not None:
            data[service]['port'] = int(port)
        else:
            data[service]['port'] = None
        if cmd is not None:
            data[service]['cmd'] = str(cmd)
        data['_meta'] = {'updated': __import__('time').strftime('%Y-%m-%d %H:%M:%S')}
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
    except Exception:
        pass

