#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
静态测试：gui_launcher 不应直接写 runtime-ports.json，而应调用 services.merge_runtime_ports
"""
from __future__ import annotations

from pathlib import Path


def _read_utf8(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_no_direct_runtime_ports_write() -> None:
    files = [Path("gui_launcher.py"), Path("dist/latest/gui_launcher.py")]
    for f in files:
        txt = _read_utf8(f)
        # 不应出现对 runtime-ports.json 的直接 write_text
        assert "runtime-ports.json').write_text" not in txt
        assert "rp_path.write_text" not in txt
        # 应引入 services.merge_runtime_ports
        assert "from src.gui_launcher import services as _gl_services" in txt
        assert "merge_runtime_ports(" in txt

