import sys
from pathlib import Path

import pytest

# 确保 src 在 sys.path 中
ROOT = Path(__file__).resolve().parents[4]
if str(ROOT / "src") not in sys.path:
    sys.path.insert(0, str(ROOT / "src"))

from backend.api.pdf_library_api import PDFLibraryAPI  # noqa: E402
from backend.database.connection import DatabaseConnectionManager  # noqa: E402
from backend.database.plugin.plugin_registry import TablePluginRegistry  # noqa: E402


@pytest.fixture
def api(tmp_path):
    # 复位单例，避免其他测试相互污染
    TablePluginRegistry.reset_instance()
    DatabaseConnectionManager._instances = {}  # 按路径隔离的单例池

    db_path = tmp_path / "smoke.db"
    service = PDFLibraryAPI(db_path=str(db_path))
    yield service
    service.shutdown()
    TablePluginRegistry.reset_instance()


def test_can_instantiate_and_list_empty(api: PDFLibraryAPI):
    assert api.list_records() == []


def test_search_records_minimal(api: PDFLibraryAPI):
    payload = {"tokens": [], "sort": [], "pagination": {"limit": 2, "offset": 0, "need_total": True}}
    result = api.search_records(payload)
    assert isinstance(result, dict)
    assert "records" in result and "page" in result and "total" in result


def test_anchor_create_and_list(api: PDFLibraryAPI):
    # 先创建对应的 PDF 记录，满足外键约束
    api.create_record({
        "uuid": "0123456789ab",
        "title": "Smoke PDF",
        "author": "",
        "page_count": 0,
        "file_size": 0,
        "created_at": 0,
        "updated_at": 0,
        "visited_at": 0,
        "version": 1,
        "json_data": {"filename": "0123456789ab.pdf", "filepath": "C:\\\\tmp\\\\0123456789ab.pdf", "is_visible": True, "tags": []}
    })

    payload = {
        "uuid": "pdfanchor-0123456789ab",
        "pdf_uuid": "0123456789ab",
        "json_data": {"name": "测试锚点"},
    }
    created_id = api.anchor_create(payload)
    assert isinstance(created_id, str) and created_id
    rows = api.anchor_list("0123456789ab")
    assert any(row.get("uuid") == created_id for row in rows)
