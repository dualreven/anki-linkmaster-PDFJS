#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
静态测试：gui_launcher 不应直接 import src.launcher.runner 的 start_* 函数
"""
from __future__ import annotations

from pathlib import Path


def test_no_direct_runner_imports() -> None:
    for rel in ["gui_launcher.py", "dist/latest/gui_launcher.py"]:
        p = Path(rel)
        txt = p.read_text(encoding="utf-8")
        assert "from src.launcher.runner import" not in txt
        assert "_run_backend_" not in txt
        assert "_run_pdf_" not in txt

