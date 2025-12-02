import sys
from pathlib import Path

import pytest

from src.backend.api.pdf_library_api import PDFLibraryAPI
from src.backend.database.connection import DatabaseConnectionManager
from src.backend.database.plugin.plugin_registry import TablePluginRegistry
from src.backend.database.plugins.__tests__.fixtures.pdf_info_samples import make_pdf_info_sample


@pytest.fixture
def api(tmp_path):
    # 重置单例，确保每个用例独立数据库
    DatabaseConnectionManager._instance = None
    TablePluginRegistry.reset_instance()

    db_path = tmp_path / "library.db"
    service = PDFLibraryAPI(db_path=str(db_path))

    yield service

    service.shutdown()
    TablePluginRegistry.reset_instance()
    DatabaseConnectionManager._instance = None


def _extract_json_data(anchor_row):
    jd = anchor_row.get("json_data")
    if isinstance(jd, dict):
        return jd
    # 兼容 json 字符串形式
    import json
    return json.loads(jd or "{}")


def test_anchor_activate_does_not_persist_is_active(api):
    """激活锚点时不应在数据库中写入 json_data.is_active。"""
    pdf_uuid = "aa11bb22cc33"
    # 建一条基础 pdf_info 记录，保证外键有效
    sample = make_pdf_info_sample(uuid=pdf_uuid)
    sample["title"] = "AnchorActiveTest"
    api.create_record(sample)

    # 创建一个锚点，不带 is_active 字段
    anchor_id = api.anchor_create({
        "pdf_uuid": pdf_uuid,
        "page_at": 1,
        "position": 0.5,
        "json_data": {"name": "A-1"},
    })

    row_before = api.anchor_get(anchor_id)
    jd_before = _extract_json_data(row_before)
    assert "is_active" not in jd_before

    # 调用激活接口：新语义下只作为前端命令的辅助确认，不应在 DB 中写入 is_active
    ok = api.anchor_activate(anchor_id, True)
    assert ok is True

    row_after = api.anchor_get(anchor_id)
    jd_after = _extract_json_data(row_after)
    assert "is_active" not in jd_after

