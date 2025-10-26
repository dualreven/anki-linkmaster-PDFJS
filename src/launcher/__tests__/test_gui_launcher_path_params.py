#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试：gui_launcher 目录参数传递与回退机制

目标：
- 不允许在 gui_launcher 内部对日志/数据/静态/PDF 目录做运行时回退（如 _COMPONENT_ROOT/logs）；
- CLI 启动 ai_launcher 时应始终显式传入目录参数（--data-dir/--db-path/--static-dir/--pdfs-dir/--logs-dir）。

所有文件读取显式 UTF-8；写入（如有）需以 \n 结尾，但本测试仅读取。
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
GUI = REPO_ROOT / "gui_launcher.py"


def _read_text_utf8(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_no_logs_dir_runtime_fallback_present() -> None:
    """
    不应存在类似 “or (_COMPONENT_ROOT / 'logs')” 的运行时回退。
    """
    text = _read_text_utf8(GUI)
    forbidden_patterns = [
        " or (_COMPONENT_ROOT / 'logs')",
        " or (component_root / 'logs')",
        "Path(self.params.get('logs_dir') or (",
    ]
    for pat in forbidden_patterns:
        assert pat not in text, f"发现不允许的回退模式: {pat}"


def test_cli_build_always_includes_path_flags() -> None:
    """
    CLI 构造应包含显式目录参数的追加逻辑。
    """
    text = _read_text_utf8(GUI)
    required_snippets = [
        'argv += ["--data-dir", paths["data_dir"]]',
        'argv += ["--db-path", paths["db_path"]]',
        'argv += ["--static-dir", paths["static_dir"]]',
        'argv += ["--pdfs-dir", paths["pdfs_dir"]]',
        'argv += ["--logs-dir", paths["logs_dir"]]',
    ]
    for s in required_snippets:
        assert s in text, f"缺少目录参数注入片段: {s}"

