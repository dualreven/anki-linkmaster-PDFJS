# -*- coding: utf-8 -*-
import sqlite3
from pathlib import Path

import pytest

from src.backend.database.executor import SQLExecutor
from src.backend.database.plugin.event_bus import EventBus
from src.backend.database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin


def setup_db():
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    # 最小 pdf_info 表，满足外键
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS pdf_info (
            uuid TEXT PRIMARY KEY NOT NULL,
            title TEXT DEFAULT ''
        );
        """
    )
    # 插入一条 PDF
    conn.execute("INSERT INTO pdf_info (uuid, title) VALUES (?,?)", ("abc123abc123", "T"))
    return conn


def test_crud_smoke():
    conn = setup_db()
    executor = SQLExecutor(conn)
    bus = EventBus()
    plugin = PDFAnnotationTablePlugin(executor, bus)

    # 建表
    plugin.create_table()

    ann = {
        "ann_id": "pdfannotation-ABCDEFGHIJKLMNOP",
        "pdf_uuid": "abc123abc123",
        "page_number": 1,
        "type": "screenshot",
        "created_at": 1,
        "updated_at": 1,
        "version": 1,
        "json_data": {
            "data": {
                "rectPercent": {"xPercent": 10, "yPercent": 10, "widthPercent": 10, "heightPercent": 10},
                "imagePath": "/a/b.png",
                "imageHash": "0"*32,
            },
            "comments": [],
        },
    }
    # 插入
    pk = plugin.insert(ann)
    assert pk == ann["ann_id"]

    # 查询
    row = plugin.query_by_id(pk)
    assert row and row["pdf_uuid"] == "abc123abc123"

    # 更新（添加评论）
    ok = plugin.update(pk, {"comments": [{"id": "c1", "content": "x", "createdAt": "t"}]})
    assert ok

    # 统计
    assert plugin.count_by_pdf("abc123abc123") == 1

    # 删除
    assert plugin.delete(pk)
    assert plugin.query_by_id(pk) is None
