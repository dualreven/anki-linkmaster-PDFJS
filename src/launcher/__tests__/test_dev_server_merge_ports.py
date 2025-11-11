#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
回归测试：ensure_vite 不应覆盖 runtime-ports.json 中的后端端口（ws/http）
"""
from __future__ import annotations

import json
from pathlib import Path


def test_ensure_vite_merges_ports(tmp_path, monkeypatch):
    from src.launcher import dev_server as ds
    logs = tmp_path / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    # 先写入后端已生成的端口
    ports_path = logs / "runtime-ports.json"
    ports_path.write_text(json.dumps({"msgCenter_port": 8765, "pdfFile_port": 8080}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 避免真实网络/进程：伪造监听为真，让 ensure_vite 走“已监听→写状态→写端口（合并）”分支
    monkeypatch.setattr(ds, "_is_listening", lambda host, port, timeout=0.8: True, raising=True)

    # 执行
    pid, used = ds.ensure_vite(3000, component_root=tmp_path, logs_dir=logs, ai_module=None)
    assert used == 3000

    # 验证：后端端口被保留，vite/npm 端口被合并写入
    data = json.loads(ports_path.read_text(encoding="utf-8"))
    assert data.get("msgCenter_port") == 8765
    assert data.get("pdfFile_port") == 8080
    assert data.get("vite_port") == 3000
    assert data.get("npm_port") == 3000
