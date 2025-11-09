# -*- coding: utf-8 -*-
"""
验证：当 pdf_uuid 在 pdf_info 不存在时，list_outline_items 返回 {"outline_items": None}
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pytest

from src.backend.api.pdf_library_api_impl import PDFLibraryAPI


@pytest.fixture()
def temp_db(tmp_path: Path):
    dbfile = tmp_path / "test-outline-null.db"
    sqlite3.connect(os.fspath(dbfile)).close()
    return os.fspath(dbfile)


def test_list_returns_null_when_pdf_info_missing(temp_db):
    api = PDFLibraryAPI(db_path=temp_db)
    pdf_uuid = "not-exists-uuid-001"
    result = api.list_outline_items(pdf_uuid)
    assert "outline_items" in result
    assert result["outline_items"] is None

