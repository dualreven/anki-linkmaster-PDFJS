#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从数据库读取一个 PDF 的 pdf-id（uuid，12位hex），并启动 pdf-viewer。

⚠️ 注意：
- 旧版本曾支持通过 URL 参数（page-at/position/anchor-id 等）在启动时自动导航到指定位置。
- 按当前规范，**所有 URL 导航功能已移除**，导航只能通过前端 Feature/WS 消息完成。
- 因此本脚本仅用于演示“如何基于最近的 pdf-id 打开 pdf-viewer”，不再负责导航。
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def get_db_path(project_root: Path) -> Path:
    return project_root / 'data' / 'anki_linkmaster.db'


def pick_pdf_uuid(db_path: Path) -> str:
    # 读取 sqlite，优先 visited_at 降序，其次 created_at 降序
    conn = sqlite3.connect(str(db_path))
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            "SELECT uuid FROM pdf_info ORDER BY visited_at DESC, created_at DESC LIMIT 1"
        )
        row = cur.fetchone()
        if not row or not row['uuid']:
            raise RuntimeError('数据库中未找到任何 pdf_info 记录')
        return str(row['uuid'])
    finally:
        try:
            conn.close()
        except Exception:
            pass


def build_launcher_args(pdf_id: str, diagnose_only: bool) -> list[str]:
    args = [sys.executable, str(get_project_root() / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'), '--pdf-id', pdf_id]
    if diagnose_only:
        args += ['--diagnose-only']
    return args


def main() -> int:
    parser = argparse.ArgumentParser(description='Launch PDF Viewer from latest pdf-id (URL 导航已禁用，仅打开文档)')
    parser.add_argument('--diagnose-only', action='store_true', help='Run launcher in diagnostic mode (no GUI)')
    args = parser.parse_args()

    project_root = get_project_root()
    db_path = get_db_path(project_root)
    if not db_path.exists():
        print(f"数据库文件不存在: {db_path}", file=sys.stderr)
        return 2

    try:
        pdf_id = pick_pdf_uuid(db_path)
    except Exception as e:
        print(f"读取 pdf-id 失败: {e}", file=sys.stderr)
        return 3

    cmd = build_launcher_args(pdf_id, args.diagnose_only)
    print('启动命令:', ' '.join(cmd))
    try:
        # 继承环境启动（前提：相关服务已由 ai_launcher 或单独方式启动）
        completed = subprocess.run(cmd, cwd=str(project_root), check=False)
        return completed.returncode
    except KeyboardInterrupt:
        return 130
    except Exception as e:
        print(f"启动失败: {e}", file=sys.stderr)
        return 4


if __name__ == '__main__':
    sys.exit(main())
