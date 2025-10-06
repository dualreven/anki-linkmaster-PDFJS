import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class FakePDFLibraryAPI:
    def __init__(self):
        self.saved_payloads = []

    def list_bookmarks(self, pdf_uuid: str):
        return {
            "bookmarks": [
                {"id": "bookmark-1", "name": "章节一", "parentId": None, "order": 0},
            ],
            "root_ids": ["bookmark-1"],
        }

    def save_bookmarks(self, pdf_uuid: str, bookmarks, *, root_ids=None):
        self.saved_payloads.append((pdf_uuid, bookmarks, root_ids))
        return len(bookmarks)


@pytest.fixture()
def server():
    svc = StandardWebSocketServer()
    svc.pdf_library_api = FakePDFLibraryAPI()
    return svc


def test_handle_bookmark_list_returns_tree(server):
    message = {
        "type": "bookmark:list:requested",
        "request_id": "req-1",
        "data": {"pdf_uuid": "pdf-123"},
    }

    response = server.handle_message(message)

    assert response["type"] == "bookmark:list:completed"
    assert response["request_id"] == "req-1"
    assert response["data"]["bookmarks"][0]["id"] == "bookmark-1"
    assert response["data"]["root_ids"] == ["bookmark-1"]


def test_handle_bookmark_save_persists_payload(server):
    payload = {
        "type": "bookmark:save:requested",
        "request_id": "req-2",
        "data": {
            "pdf_uuid": "pdf-xyz",
            "bookmarks": [
                {"id": "bookmark-a", "name": "A", "parentId": None, "order": 0}
            ],
            "root_ids": ["bookmark-a"],
        },
    }

    response = server.handle_message(payload)

    assert response["type"] == "bookmark:save:completed"
    assert response["request_id"] == "req-2"
    assert response["data"]["saved"] == 1
    assert server.pdf_library_api.saved_payloads == [
        ("pdf-xyz", [
            {"id": "bookmark-a", "name": "A", "parentId": None, "order": 0}
        ], ["bookmark-a"])
    ]


def test_handle_bookmark_save_requires_pdf_id(server):
    payload = {
        "type": "bookmark:save:requested",
        "request_id": "req-3",
        "data": {"bookmarks": []},
    }

    response = server.handle_message(payload)

    assert response["type"] == "bookmark:save:failed"
    assert response["request_id"] == "req-3"
    assert "缺少" in response["error"]["message"]
