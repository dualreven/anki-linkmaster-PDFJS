#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: backend pdf_bookmark local persistence (SQLite in-memory)
- Ensure table creation via plugin.enable()
- Insert one bookmark and query it back
"""
from __future__ import annotations

import sys
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.backend.database.executor import SQLExecutor  # noqa
from src.backend.database.plugin.event_bus import EventBus  # noqa
from src.backend.database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin  # noqa


def main():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    executor = SQLExecutor(conn)
    bus = EventBus()
    plugin = PDFBookmarkTablePlugin(executor, bus, logger=None)
    plugin.enable()

    now = int(time.time() * 1000)
    data = {
        "bookmark_id": "outlineItem-AbCd1234",
        "pdf_uuid": "c83c60c58ad2",
        "created_at": now,
        "updated_at": now,
        "version": 1,
        "json_data": {
            "name": "Smoke Root",
            "pageAt": 1,
            "position": 0,
            "children": [],
            "parentId": None,
            "order": 0
        }
    }
    pk = plugin.insert(data)
    row = plugin.query_by_id(pk)
    assert row is not None, "query_by_id returned None"
    assert row["bookmark_id"] == data["bookmark_id"]
    assert row["pdf_uuid"] == data["pdf_uuid"]
    assert row["name"] == "Smoke Root"
    print("OK bookmark local insert/query")


if __name__ == "__main__":
    main()

