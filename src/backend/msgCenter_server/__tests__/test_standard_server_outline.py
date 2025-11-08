import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


class FakePDFLibraryAPI:
    def __init__(self):
        self.created = []
        self.updated = []
        self.deleted = []
        self.reordered = []

    def list_outline_items(self, pdf_uuid: str):
        return {
            "outline_items": [
                {"id": "outlineItem-ABCD1234", "name": "一", "pageAt": 1, "position": None, "children": []}
            ]
        }

    def create_outline_item(self, *, pdf_uuid: str, name: str, page_at: int, position=None, parent_id=None, order=None):
        self.created.append({"pdf_uuid": pdf_uuid, "name": name, "page_at": page_at, "position": position})
        return "outlineItem-NEWITEM"

    def update_outline_item(self, outline_id: str, update: dict) -> bool:
        self.updated.append({"id": outline_id, "update": update})
        return True

    def delete_outline_item(self, outline_id: str, *, cascade: bool = True) -> bool:
        self.deleted.append({"id": outline_id, "cascade": cascade})
        return True

    def reorder_outline_item(self, *, outline_id: str, new_parent_id, new_index: int) -> None:
        self.reordered.append({"id": outline_id, "parent": new_parent_id, "index": int(new_index or 0)})


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    svc = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)
    svc.pdf_library_api = FakePDFLibraryAPI()
    return svc


def test_outline_list_routes(server):
    resp = server.handle_message({
        "type": "outline:list:requested",
        "request_id": "r1",
        "data": {"pdf_uuid": "abc123def456"}
    })
    assert resp["type"] == "outline:list:completed"
    assert isinstance(resp["data"]["outline_items"], list)


def test_outline_create_update_delete_reorder(server):
    # create
    r1 = server.handle_message({
        "type": "outline:create:requested",
        "request_id": "r2",
        "data": {"pdf_uuid": "abc123def456", "name": "新建", "page_at": 2, "position": 10}
    })
    assert r1["type"] == "outline:create:completed"
    # update
    r2 = server.handle_message({
        "type": "outline:update:requested",
        "request_id": "r3",
        "data": {"outline_id": "outlineItem-NEWITEM", "update": {"name": "改名"}}
    })
    assert r2["type"] == "outline:update:completed"
    # delete
    r3 = server.handle_message({
        "type": "outline:delete:requested",
        "request_id": "r4",
        "data": {"outline_id": "outlineItem-NEWITEM", "cascade": True}
    })
    assert r3["type"] == "outline:delete:completed"
    # reorder
    r4 = server.handle_message({
        "type": "outline:reorder:requested",
        "request_id": "r5",
        "data": {"outline_id": "outlineItem-NEWITEM", "new_parent_id": None, "new_index": 0}
    })
    assert r4["type"] == "outline:reorder:completed"

