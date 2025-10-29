import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    return StandardWebSocketServer(data_dir=data_dir, db_path=db_path)


def test_pdf_page_load_without_transfer_returns_error(server):
    payload = {
        "type": "pdf-page:load:requested",
        "request_id": "req-page-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"file_id": "pdf-1", "page_number": 1},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "pdf-page:load:failed"
    assert resp["request_id"] == "req-page-1"
    assert resp["error"]["type"] == "PAGE_EXTRACTION_ERROR"
    # 错误信息包含 page_transfer 缺失提示
    assert "page_transfer" in resp["error"]["message"]


def test_bookmark_save_invalid_bookmarks_type_returns_400(server):
    payload = {
        "type": "bookmark:save:requested",
        "request_id": "req-bm-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"pdf_uuid": "pdf-xyz", "bookmarks": {"not": "a list"}},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "bookmark:save:failed"
    assert resp["request_id"] == "req-bm-1"
    assert resp["code"] == 400
    assert resp["error"]["type"] == "SCHEMA_VALIDATION_FAILED"


def test_debug_info_read_when_file_missing_returns_empty_flags(server, tmp_path, monkeypatch):
    # 确保日志路径不存在，以覆盖“缺失文件时 flags={ }”的显式行为
    monkeypatch.chdir(tmp_path)
    payload = {
        "type": "debug-info:read:requested",
        "request_id": "req-debug-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "debug-info:read:completed"
    assert resp["request_id"] == "req-debug-1"
    assert resp["status"] == "success"
    assert isinstance(resp["data"]["flags"], dict)
    assert resp["data"]["flags"] == {}
