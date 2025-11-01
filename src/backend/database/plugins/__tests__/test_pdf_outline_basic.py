# -*- coding: utf-8 -*-
import sqlite3
import pytest

from src.backend.database.executor import SQLExecutor
from src.backend.database.plugin.event_bus import EventBus
from src.backend.database.plugins.pdf_outline_plugin import PDFOutlineTablePlugin


def setup_db():
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS pdf_info (
            uuid TEXT PRIMARY KEY NOT NULL,
            title TEXT DEFAULT ''
        );
        """
    )
    conn.execute("INSERT INTO pdf_info (uuid, title) VALUES (?,?)", ("abc123abc123", "T"))
    return conn


def test_outline_insert_and_event_name():
    conn = setup_db()
    bus = EventBus()
    executor = SQLExecutor(conn)
    plugin = PDFOutlineTablePlugin(executor, bus)

    captured = {}

    def on_created(data):
        captured["data"] = data

    # 事件名应为 table:pdf-outline:create:completed
    bus.on("table:pdf-outline:create:completed", on_created, "test")

    plugin.create_table()
    pk = plugin.insert({
        "outlineItemId": "outlineItem-ABCDEFGH",
        "pdf_uuid": "abc123abc123",
        "created_at": 1,
        "updated_at": 1,
        "version": 1,
        "json_data": {
            "name": "item",
            "pageAt": 2,
            "position": 10,
            "children": [],
            "parentId": None,
            "order": 0
        }
    })

    assert pk == "outlineItem-ABCDEFGH"
    assert captured.get("data", {}).get("outline_id") == pk
    # 查询验证
    row = plugin.query_by_id(pk)
    assert row and row["name"] == "item" and row["pageAt"] == 2
