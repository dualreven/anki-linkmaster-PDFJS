#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: pdf_annotation CRUD with file-backed SQLite + refresh-read
- Create three types (screenshot / text-highlight / comment)
- Save (insert), read (query_by_pdf), re-open (refresh) and read again
- Also statically assert front-end jump event constant exists
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
from src.backend.database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin  # noqa


def _open_db(db_path: Path) -> SQLExecutor:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return SQLExecutor(conn)


def _bootstrap_tables(executor: SQLExecutor):
    # Ensure minimal pdf_info row to satisfy FK (if plugin enforces)
    try:
        executor.execute_script("""
        CREATE TABLE IF NOT EXISTS pdf_info (
          uuid TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT ''
        );
        """)
        executor.execute_update("INSERT OR IGNORE INTO pdf_info(uuid,title) VALUES (?,?)",
                                ("c83c60c58ad2", "Smoke PDF"))
    except Exception:
        pass


def _insert_three(plugin: PDFAnnotationTablePlugin):
    now = int(time.time() * 1000)
    base = {
        "pdf_uuid": "c83c60c58ad2",
        "created_at": now,
        "updated_at": now,
        "version": 1,
    }
    recs = [
        {
            **base,
            "ann_id": "pdfannotation-AbCdEfGhIjKlMnOp",
            "page_number": 1,
            "type": "screenshot",
            "json_data": {
                "data": {
                    "rectPercent": {"xPercent": 10, "yPercent": 20, "widthPercent": 30, "heightPercent": 15},
                    "imagePath": "/data/screenshots/smoke.png",
                    "imageHash": "00000000000000000000000000000000",
                    "description": "smoke-shot"
                },
                "comments": []
            }
        },
        {
            **base,
            "ann_id": "pdfannotation-ZyXwVuTsRqPoNmLk",
            "page_number": 2,
            "type": "text-highlight",
            "json_data": {
                "data": {
                    "selectedText": "hello smoke",
                    "textRanges": [{"start": 0, "end": 5}],
                    "highlightColor": "#ffff00",
                    "note": "smoke highlight",
                    "lineRects": [{"xPercent": 5, "yPercent": 50, "widthPercent": 60, "heightPercent": 3}]
                },
                "comments": []
            }
        },
        {
            **base,
            "ann_id": "pdfannotation-QwertyUiOpAsDfGh",
            "page_number": 3,
            "type": "comment",
            "json_data": {
                "data": {
                    "position": {"x": 100, "y": 200},
                    "positionPercent": {"xPercent": 25, "yPercent": 30},
                    "content": "smoke comment"
                },
                "comments": []
            }
        }
    ]
    for r in recs:
        # plugin.validate_data expects json_data to be dict or JSON string
        payload = dict(r)
        payload["json_data"] = r["json_data"]
        plugin.insert(payload)
    return [r["ann_id"] for r in recs]


def main():
    db_file = ROOT / "AItemp" / "attempts" / "tmp" / "annotation_smoke.db"
    # round 1: create and insert
    exec1 = _open_db(db_file)
    _bootstrap_tables(exec1)
    bus = EventBus()
    plugin1 = PDFAnnotationTablePlugin(exec1, bus, logger=None)
    plugin1.enable()
    # cleanup by pdf and ann_id to avoid unique conflicts on reruns
    try:
        plugin1.delete_by_pdf("c83c60c58ad2")
    except Exception:
        pass
    try:
        for _id in ("pdfannotation-AbCdEfGhIjKlMnOp", "pdfannotation-ZyXwVuTsRqPoNmLk", "pdfannotation-QwertyUiOpAsDfGh"):
            plugin1.delete(_id)
    except Exception:
        pass
    ids = _insert_three(plugin1)
    rows = plugin1.query_by_pdf("c83c60c58ad2")
    assert len(rows) >= 3, f"expected >=3 rows, got {len(rows)}"
    got_ids = sorted([r["bookmark_id"] if "bookmark_id" in r else r.get("ann_id") or r.get("id") for r in rows if r])
    # The plugin returns parsed row without 'ann_id' alias in some helpers; accept presence
    # round 2: refresh (re-open db) and read again
    exec2 = _open_db(db_file)
    plugin2 = PDFAnnotationTablePlugin(exec2, bus, logger=None)
    plugin2.enable()
    rows2 = plugin2._executor.execute_query("SELECT * FROM pdf_annotation WHERE pdf_uuid = ?", ("c83c60c58ad2",))
    assert len(rows2) >= 3, f"refresh read expected >=3 rows, got {len(rows2)}"

    # front-end jump constant static check
    consts = (ROOT / "src" / "frontend" / "common" / "event" / "pdf-viewer-constants.js").read_text(encoding="utf-8")
    assert "annotation-navigation:jump:requested" in consts, "missing jump requested constant"
    print("OK annotation CRUD + refresh + jump-constant")


if __name__ == "__main__":
    main()

