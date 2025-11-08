#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：merge_runtime_ports 合并写入

约束：
- 显式 UTF-8 读写，写入以 \n 结尾；
- 不存在的文件视为 {}，执行浅合并；
- 返回值为合并后的 dict。
"""
from __future__ import annotations

from pathlib import Path

from src.launcher.ports import write_runtime_ports, merge_runtime_ports, read_runtime_ports


def _read_text_utf8(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_merge_runtime_ports_basic(tmp_path: Path) -> None:
    base = tmp_path / "logs"
    write_runtime_ports(base, {"vite_port": 3000, "npm_port": 3000})
    out = merge_runtime_ports(base, {"vite_port": 4000, "msgCenter_port": 8765})
    assert out["vite_port"] == 4000
    assert out["npm_port"] == 3000
    assert out["msgCenter_port"] == 8765
    # 文件存在且以 \n 结尾
    text = _read_text_utf8(base / "runtime-ports.json")
    assert text.endswith("\n")
    data = read_runtime_ports(base)
    assert data["vite_port"] == 4000
    assert data["msgCenter_port"] == 8765


def test_merge_runtime_ports_delete_key(tmp_path: Path) -> None:
    base = tmp_path / "logs"
    write_runtime_ports(base, {"outline": 1, "vite_port": 5173})
    # 使用 None 触发删除 outline
    out = merge_runtime_ports(base, {"outline": None})
    assert "outline" not in out
    text = _read_text_utf8(base / "runtime-ports.json")
    assert text.endswith("\n")
    assert '"outline"' not in text
    data = read_runtime_ports(base)
    assert "outline" not in data
