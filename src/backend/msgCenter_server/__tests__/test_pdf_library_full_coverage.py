import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class FakePDFLibraryAPI:
    def __init__(self):
        self.listed = [
            {"id": "id-1", "title": "T1", "filename": "f1.pdf", "file_size": 1, "page_count": 1, "tags": []},
        ]
        self.detail = {"id": "id-1", "title": "T1"}
        self.deleted = []

    def list_records(self, *, include_hidden=True, limit=None, offset=None):
        return self.listed

    def get_record_detail(self, uuid: str):
        return self.detail if uuid == "id-1" else None

    def delete_record(self, uuid: str) -> bool:
        self.deleted.append(uuid)
        return True


@pytest.fixture()
def server():
    svc = StandardWebSocketServer()
    svc.pdf_library_api = FakePDFLibraryAPI()
    return svc


def test_list_request(server):
    resp = server.handle_message({
        "type": "pdf-library:list:requested",
        "request_id": "req-list",
        "data": {"pagination": {"limit": 10}}
    })
    assert resp["type"] == "pdf-library:list:completed"
    assert isinstance(resp["data"].get("files"), list)


def test_info_request(server):
    resp = server.handle_message({
        "type": "pdf-library:info:requested",
        "request_id": "req-info",
        "data": {"pdf_id": "id-1"}
    })
    assert resp["type"] == "pdf-library:info:completed"
    assert resp["data"].get("id") == "id-1"


def test_remove_batch(server):
    resp = server.handle_message({
        "type": "pdf-library:remove:requested",
        "request_id": "req-rm",
        "data": {"file_ids": ["id-1", "id-2"]}
    })
    assert resp["type"] == "pdf-library:remove:completed"
    assert set(server.pdf_library_api.deleted) == {"id-1", "id-2"}

