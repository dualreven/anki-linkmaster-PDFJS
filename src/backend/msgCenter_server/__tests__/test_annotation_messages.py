import time
import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer
from src.backend.database.exceptions import DatabaseConstraintError


@pytest.fixture()
def server():
    return StandardWebSocketServer()


def _ensure_pdf_record(server, pdf_uuid: str):
    now = int(time.time() * 1000)
    payload = {
        "uuid": pdf_uuid,
        "title": "Sample PDF",
        "author": "Tester",
        "page_count": 10,
        "file_size": 123,
        "created_at": now,
        "updated_at": now,
        "visited_at": 0,
        "version": 1,
        "json_data": {
            "filename": f"{pdf_uuid}.pdf",
            "filepath": f"/tmp/{pdf_uuid}.pdf",
            "subject": "",
            "keywords": "",
            "thumbnail_path": None,
            "tags": [],
            "notes": ""
        }
    }
    try:
        server.pdf_library_api._pdf_info_plugin.insert(payload)
    except DatabaseConstraintError:
        # Already exists in persistent test DB; acceptable for idempotent tests
        pass


def test_annotation_save_list_delete_roundtrip(server):
    pdf_uuid = "0c251de0e2ac"
    _ensure_pdf_record(server, pdf_uuid)

    # save (create)
    resp_save = server.handle_message({
        "type": "annotation:save:requested",
        "request_id": "req-ann-1",
        "data": {
            "pdf_uuid": pdf_uuid,
            "annotation": {
                "type": "text-highlight",
                "pageNumber": 1,
                "data": {
                    "selectedText": "hello",
                    "textRanges": [{"startOffset": 0, "endOffset": 5, "startContainerPath": "0/0/0", "endContainerPath": "0/0/0"}],
                    "highlightColor": "#ffff00"
                },
                "comments": [],
                "createdAt": "2025-10-06T12:00:00Z",
                "updatedAt": "2025-10-06T12:00:00Z"
            }
        }
    })
    assert resp_save["type"] == "annotation:save:completed"
    assert resp_save["status"] == "success"
    ann_id = resp_save["data"]["id"]
    assert isinstance(ann_id, str) and len(ann_id) > 0

    # list
    resp_list = server.handle_message({
        "type": "annotation:list:requested",
        "request_id": "req-ann-2",
        "data": {"pdf_uuid": pdf_uuid}
    })
    assert resp_list["type"] == "annotation:list:completed"
    items = resp_list["data"]["annotations"]
    assert isinstance(items, list) and len(items) == 1
    assert items[0]["id"] == ann_id
    assert items[0]["type"] == "text-highlight"
    assert items[0]["pageNumber"] == 1

    # delete
    resp_del = server.handle_message({
        "type": "annotation:delete:requested",
        "request_id": "req-ann-3",
        "data": {"ann_id": ann_id}
    })
    assert resp_del["type"] == "annotation:delete:completed"
    assert resp_del["status"] == "success"

    # list again -> empty
    resp_list2 = server.handle_message({
        "type": "annotation:list:requested",
        "request_id": "req-ann-4",
        "data": {"pdf_uuid": pdf_uuid}
    })
    assert resp_list2["type"] == "annotation:list:completed"
    assert resp_list2["data"]["count"] == 0
