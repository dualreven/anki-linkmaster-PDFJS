import pytest
from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server_with_stub_api(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    s = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)
    # 提供一个 truthy 的桩对象以通过 service 可用性检查
    s.pdf_library_api = object()
    return s


def test_annotation_save_missing_pdf_uuid_returns_400(server_with_stub_api):
    payload = {
        "type": "annotation:save:requested",
        "request_id": "req-ann-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"annotation": {"id": "a1", "pageNumber": 1, "type": "note"}},
    }
    resp = server_with_stub_api.handle_message(payload)
    assert resp["type"] == "annotation:save:failed"
    assert resp["code"] == 400
    assert resp["error"]["type"] == "SCHEMA_VALIDATION_FAILED"


def test_annotation_save_missing_annotation_returns_400(server_with_stub_api):
    payload = {
        "type": "annotation:save:requested",
        "request_id": "req-ann-2",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"pdf_uuid": "pdf-1"},
    }
    resp = server_with_stub_api.handle_message(payload)
    assert resp["type"] == "annotation:save:failed"
    assert resp["code"] == 400
    assert resp["error"]["type"] == "SCHEMA_VALIDATION_FAILED"


def test_anchor_list_missing_pdf_uuid_returns_400(server_with_stub_api):
    payload = {
        "type": "anchor:list:requested",
        "request_id": "req-anchor-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {},
    }
    resp = server_with_stub_api.handle_message(payload)
    assert resp["type"] == "anchor:list:failed"
    assert resp["code"] == 400
    assert "缺少 pdf_uuid" in resp["error"]["message"]


def test_anchor_get_missing_anchor_id_returns_400(server_with_stub_api):
    payload = {
        "type": "anchor:get:requested",
        "request_id": "req-anchor-2",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {},
    }
    resp = server_with_stub_api.handle_message(payload)
    assert resp["type"] == "anchor:get:failed"
    assert resp["code"] == 400
    assert "缺少 anchor_id" in resp["error"]["message"]
