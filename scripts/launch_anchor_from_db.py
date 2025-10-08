#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从数据库读取一个 PDF 的 pdf-id（uuid，12位hex），并启动 pdf-viewer，携带 anchor-id 与可选的页码/位置参数。

用法示例：
  python scripts/launch_anchor_from_db.py --anchor-id pdfanchor-test
  python scripts/launch_anchor_from_db.py --anchor-id pdfanchor-1a2b3c4d5e6f

可选参数：
  --page-at 5 --position 50   # 如需强制跳转到指定页码和位置

注意：
  - anchor-id=pdfanchor-test 为前端 DEV 测试通道，不依赖后端数据。
  - 正式 anchor-id 形如 pdfanchor- + 12位hex；此时前端会请求后端加载锚点数据。
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


def build_launcher_args(pdf_id: str, anchor_id: str, page_at: int | None, position: float | None, diagnose_only: bool) -> list[str]:
    args = [sys.executable, str(get_project_root() / 'src' / 'frontend' / 'pdf-viewer' / 'launcher.py'), '--pdf-id', pdf_id]
    if page_at is not None:
        args += ['--page-at', str(int(page_at))]
    if position is not None:
        # 0-100 之间
        pos = max(0.0, min(100.0, float(position)))
        args += ['--position', str(pos)]
    if anchor_id:
        args += ['--anchor-id', anchor_id]
    if diagnose_only:
        args += ['--diagnose-only']
    return args


def main() -> int:
    parser = argparse.ArgumentParser(description='Launch PDF Viewer with anchor-id from database pdf-id')
    parser.add_argument('--anchor-id', type=str, required=True, help="Anchor ID (e.g., pdfanchor-test or pdfanchor-<12-hex>)")
    parser.add_argument('--page-at', type=int, default=None, help='Target page number (1-based)')
    parser.add_argument('--position', type=float, default=None, help='Vertical position percentage (0-100)')
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

    cmd = build_launcher_args(pdf_id, args.anchor_id, args.page_at, args.position, args.diagnose_only)
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
