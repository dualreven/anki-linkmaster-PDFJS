# -*- coding: utf-8 -*-
"""
API 级大纲持久化防回归测试（严格 Outline-only）
"""
from __future__ import annotations

import os
import json
import sqlite3
from pathlib import Path
import time

import pytest

from src.backend.api.pdf_library_api_impl import PDFLibraryAPI
from src.backend.database.exceptions import DatabaseValidationError


@pytest.fixture()
def temp_db(tmp_path: Path):
    dbfile = tmp_path / "test-outline.db"
    # 预建空库文件，防止路径解析差异
    sqlite3.connect(os.fspath(dbfile)).close()
    return os.fspath(dbfile)


def _create_pdf_info(api: PDFLibraryAPI, pdf_uuid: str):
    now = int(time.time() * 1000)
    payload = {
        "uuid": pdf_uuid,
        "title": pdf_uuid,  # 任意非空
        "author": "",
        "page_count": 1,
        "file_size": 0,
        "created_at": now,
        "updated_at": now,
        "visited_at": 0,
        "version": 1,
        "json_data": {
            "filename": f"{pdf_uuid}.pdf",
            "filepath": f"/tmp/{pdf_uuid}.pdf",
            "is_visible": True,
            "tags": [],
            "total_reading_time": 0,
            "last_accessed_at": 0,
            "review_count": 0,
            "due_date": 0
        }
    }
    return api.create_record(payload)


def test_outline_crud_end_to_end(temp_db):
    api = PDFLibraryAPI(db_path=temp_db)
    pdf_uuid = "c83c60c58ad2"
    # 1) pdf_info 不存在时严厉失败
    with pytest.raises(DatabaseValidationError):
        api.create_outline_item(pdf_uuid=pdf_uuid, name="目录", page_at=1)
    # 2) 创建 pdf_info 后，创建大纲成功
    _create_pdf_info(api, pdf_uuid)
    oid1 = api.create_outline_item(pdf_uuid=pdf_uuid, name="第一章", page_at=1, position=None, parent_id=None, order=0)
    assert oid1.startswith("outlineItem-")
    oid2 = api.create_outline_item(pdf_uuid=pdf_uuid, name="第二章", page_at=2, position=10, parent_id=None, order=1)
    # 3) 列表应返回两项，顺序按 order
    lst = api.list_outline_items(pdf_uuid)
    items = lst.get("outline_items") or []
    assert len(items) == 2
    assert [it["name"] for it in items] == ["第一章", "第二章"]
    # 4) 更新节点
    ok = api.update_outline_item(oid2, {"name": "第二章·修订", "page_at": 3, "position": 20})
    assert ok is True
    lst2 = api.list_outline_items(pdf_uuid)["outline_items"]
    names = {it["id"]: it["name"] for it in lst2 for _ in [0] if (it.update({"id": it.get("id", it.get("outline_id", ""))}) or True)}
    assert names[oid2] == "第二章·修订"
    # 5) 重排（将第二章置于首位）
    api.reorder_outline_item(outline_id=oid2, new_parent_id=None, new_index=0)
    lst3 = api.list_outline_items(pdf_uuid)["outline_items"]
    assert [it["id"] for it in lst3] == [oid2, oid1]
    # 6) 删除
    assert api.delete_outline_item(oid1) is True
    lst4 = api.list_outline_items(pdf_uuid)["outline_items"]
    assert [it["id"] for it in lst4] == [oid2]

def test_outline_bulk_replace(temp_db):
    api = PDFLibraryAPI(db_path=temp_db)
    pdf_uuid = "aabbccddeeff"
    _create_pdf_info(api, pdf_uuid)
    items = [
        {"outline_id": "outlineItem-ROOTA0a1", "name": "A", "page_at": 1, "position": None, "parent_id": None, "order": 0},
        {"outline_id": "outlineItem-ROOTB0b2", "name": "B", "page_at": 2, "position": 10, "parent_id": None, "order": 1},
        {"outline_id": "outlineItem-CHILDc3C", "name": "A.1", "page_at": 3, "position": 20, "parent_id": "outlineItem-ROOTA0a1", "order": 0},
    ]
    cnt = api.bulk_replace_outline(pdf_uuid=pdf_uuid, items=items)
    assert cnt == 3
    tree = api.list_outline_items(pdf_uuid)["outline_items"]
    assert [n["name"] for n in tree] == ["A", "B"]
    assert [c["name"] for c in tree[0]["children"]] == ["A.1"]
