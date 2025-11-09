#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库迁移：删除已废弃的 pdf_bookmark 表（仅在空表时执行）

使用说明
- 默认数据库路径：dist/latest/data/anki_linkmaster.db
- 可通过环境变量 DB_PATH 指定其它路径
- 仅当表存在且行数为 0 时执行 DROP TABLE；否则给出提示并跳过（避免误删历史数据）
"""
from __future__ import annotations
import os
import sqlite3
import sys

def get_db_path() -> str:
    p = os.environ.get("DB_PATH") or os.path.join("dist", "latest", "data", "anki_linkmaster.db")
    return p

def table_exists(cur: sqlite3.Cursor, name: str) -> bool:
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None

def get_row_count(cur: sqlite3.Cursor, name: str) -> int:
    cur.execute(f'SELECT COUNT(*) FROM "{name}"')
    return int(cur.fetchone()[0])

def drop_table(cur: sqlite3.Cursor, name: str) -> None:
    cur.execute(f'DROP TABLE "{name}"')

def main() -> int:
    db_path = get_db_path()
    print(f"[migrate] DB_PATH={db_path}")
    if not os.path.exists(db_path):
        print("[migrate] ERROR: database file not found.")
        return 2
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        if not table_exists(cur, "pdf_bookmark"):
            print("[migrate] OK: pdf_bookmark table does not exist (nothing to do).")
            return 0
        rows = get_row_count(cur, "pdf_bookmark")
        if rows > 0 and os.environ.get("FORCE_DROP") != "1":
            print(f"[migrate] SKIP: pdf_bookmark has {rows} rows. Set env FORCE_DROP=1 to force drop (NOT RECOMMENDED).")
            return 3
        print(f"[migrate] Dropping table pdf_bookmark (rows={rows}) ...")
        drop_table(cur, "pdf_bookmark")
        con.commit()
        print("[migrate] DONE: table pdf_bookmark dropped.")
        return 0
    finally:
        con.close()

if __name__ == "__main__":
    sys.exit(main())

