# -*- coding: utf-8 -*-
import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class FakePDFLibraryAPI:
    def __init__(self):
        self.last_update = None

    def update_outline_item(self, outline_id: str, update: dict) -> bool:
        self.last_update = (outline_id, update)
        return True


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    svc = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)
    svc.pdf_library_api = FakePDFLibraryAPI()
    return svc


def test_outline_update_roundtrip(server):
    payload = {
        "type": "pdf-viewer:outline-update:request",
        "request_id": "req-up-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {
            "outline_id": "outlineItem-ABCD1234",
            "update": {"name": "新标题", "page_at": 2, "position": None},
        },
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "pdf-viewer:outline-update:complete"
    assert resp["request_id"] == "req-up-1"
    # 确认服务端收到的字段映射（page_at → pageNumber 由实现内部处理）
    assert server.pdf_library_api.last_update[0] == "outlineItem-ABCD1234"
    assert server.pdf_library_api.last_update[1]["name"] == "新标题"
    assert "page_at" in server.pdf_library_api.last_update[1]

