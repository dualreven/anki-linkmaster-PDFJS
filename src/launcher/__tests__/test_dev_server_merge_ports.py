#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
回归测试：ensure_vite 的端口合并与 IPv4 可达性要求。
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

    # 避免真实网络/进程：伪造 IPv4 可达为真，让 ensure_vite 走“已监听→写状态→写端口（合并）”分支
    monkeypatch.setattr(ds, "_is_listening_exact", lambda host, port, timeout=0.8: True, raising=True)

    # 执行
    pid, used = ds.ensure_vite(3000, component_root=tmp_path, logs_dir=logs, ai_module=None)
    assert used == 3000

    # 验证：后端端口被保留，vite/npm/url 端口被合并写入
    data = json.loads(ports_path.read_text(encoding="utf-8"))
    assert data.get("msgCenter_port") == 8765
    assert data.get("pdfFile_port") == 8080
    assert data.get("vite_port") == 3000
    assert data.get("npm_port") == 3000
    assert data.get("url_port") == 3000


def test_ensure_vite_requires_ipv4_reachable(tmp_path, monkeypatch):
    """
    回归：若端口“有人监听”但仅 ::1 可达（127.0.0.1 不可达），ensure_vite 不应误判为已就绪。
    """
    from src.launcher import dev_server as ds

    logs = tmp_path / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    ports_path = logs / "runtime-ports.json"
    ports_path.write_text(
        json.dumps({"msgCenter_port": 8765, "pdfFile_port": 8080, "vite_port": 3000, "npm_port": 3000, "url_port": 3000},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 模拟：端口“有人监听”（例如 ::1-only），但 127.0.0.1:3000 不可达
    monkeypatch.setattr(ds, "_is_listening", lambda host, port, timeout=0.8: True, raising=True)

    state = {"started": False}

    def _fake_is_listening_exact(host, port, timeout=0.8):
        if str(host) != "127.0.0.1":
            return False
        if int(port) == 3000:
            return False
        if int(port) == 3001:
            return bool(state["started"])
        return False

    monkeypatch.setattr(ds, "_is_listening_exact", _fake_is_listening_exact, raising=True)
    monkeypatch.setattr(ds, "_find_free_port", lambda start, limit=50: 3001, raising=True)

    class _AI:
        def _start_vite(self, port):
            assert int(port) == 3001
            state["started"] = True
            return 12345

    pid, used = ds.ensure_vite(3000, component_root=tmp_path, logs_dir=logs, ai_module=_AI())
    assert pid == 12345
    assert used == 3001

    data = json.loads(ports_path.read_text(encoding="utf-8"))
    assert data.get("msgCenter_port") == 8765
    assert data.get("pdfFile_port") == 8080
    assert data.get("vite_port") == 3001
    assert data.get("npm_port") == 3001
    assert data.get("url_port") == 3001
