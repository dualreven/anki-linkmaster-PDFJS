import pytest
from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class DummyPageTransfer:
    def __init__(self):
        self.calls = {"get_page": [], "preload_pages": [], "clear_cache": []}

    def get_page(self, file_id, page_number, compression):
        self.calls["get_page"].append((file_id, page_number, compression))
        return {"content": f"page-{page_number}-data", "encoding": compression}

    def preload_pages(self, file_id, start_page, end_page, priority):
        self.calls["preload_pages"].append((file_id, start_page, end_page, priority))
        return max(0, int(end_page) - int(start_page) + 1)

    def clear_cache(self, file_id, keep_pages):
        self.calls["clear_cache"].append((file_id, keep_pages))
        return 3


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    pt = DummyPageTransfer()
    s = StandardWebSocketServer(data_dir=data_dir, db_path=db_path, page_transfer=pt)
    return s


def test_pdf_page_load_success(server):
    payload = {
        "type": "pdf-page:load:requested",
        "request_id": "req-page-load",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"file_id": "file-1", "page_number": 2, "compression": "zlib_base64"},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "pdf-page:load:completed"
    assert resp["request_id"] == "req-page-load"
    assert resp["status"] == "success"
    assert resp["data"]["file_id"] == "file-1"
    assert resp["data"]["page_number"] == 2
    assert resp["data"]["page_data"]["content"] == "page-2-data"


def test_pdf_page_preload_success(server):
    payload = {
        "type": "pdf-page:preload:requested",
        "request_id": "req-page-preload",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"file_id": "file-1", "start_page": 3, "end_page": 5, "priority": "low", "pages": [3,4,5]},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "response"
    assert resp["request_id"] == "req-page-preload"
    assert resp["status"] == "success"
    assert resp["data"]["preloaded_count"] == 3


def test_pdf_page_cache_clear_success(server):
    payload = {
        "type": "pdf-page:cache-clear:requested",
        "request_id": "req-page-clear",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"file_id": "file-1", "keep_pages": [1]},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "response"
    assert resp["request_id"] == "req-page-clear"
    assert resp["status"] == "success"
    assert resp["data"]["cleared_count"] == 3
