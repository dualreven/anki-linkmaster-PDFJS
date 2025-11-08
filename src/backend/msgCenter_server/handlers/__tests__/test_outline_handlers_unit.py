# -*- coding: utf-8 -*-
from types import SimpleNamespace
from src.backend.msgCenter_server.handlers.pdf_viewer.outline import (
    list_outline, create_outline, update_outline, delete_outline
)


class FakeOutlineAPI:
    def __init__(self):
        # maps: outline_id -> {pdf_uuid, name, pageAt, position, parentId, order}
        self.items = {}

    def list_outline_items(self, pdf_uuid: str):
        nodes = []
        for oid, row in self.items.items():
            if row["pdf_uuid"] == pdf_uuid:
                nodes.append({
                    "id": oid,
                    "name": row["name"],
                    "pageAt": row["pageAt"],
                    "position": row.get("position"),
                    "children": [],
                    "parentId": row.get("parentId"),
                    "order": row.get("order", 0),
                })
        # stable sort by order
        nodes.sort(key=lambda n: n.get("order", 0))
        return {"outline_items": nodes}

    def _gen_id(self):
        # deterministic short id for test
        return "outlineItem-TESTID"

    def create_outline_item(self, *, pdf_uuid: str, name: str, page_at: int, position=None, parent_id=None, order=None):
        oid = self._gen_id()
        self.items[oid] = {
            "pdf_uuid": pdf_uuid,
            "name": name,
            "pageAt": int(page_at),
            "position": position,
            "parentId": parent_id,
            "order": int(order or 0),
        }
        return oid

    def update_outline_item(self, outline_id: str, update: dict) -> bool:
        row = self.items.get(outline_id)
        if not row:
            return False
        if "name" in update:
            row["name"] = update["name"]
        if "page_at" in update:
            row["pageAt"] = int(update["page_at"])
        if "position" in update:
            row["position"] = update["position"]
        if "parent_id" in update:
            row["parentId"] = update["parent_id"]
        if "order" in update:
            row["order"] = int(update["order"])
        return True

    def delete_outline_item(self, outline_id: str, *, cascade: bool = True) -> bool:
        return bool(self.items.pop(outline_id, None))


def make_ctx(with_api=True):
    if with_api:
        api = FakeOutlineAPI()
        return SimpleNamespace(pdf_library_api=api), api
    return SimpleNamespace(), None


def test_outline_handlers_crud_flow():
    ctx, api = make_ctx()
    rid = "req-1"
    # list (empty)
    r0 = list_outline(ctx, rid, {"pdf_uuid": "c83c60c58ad2"})
    assert r0["type"] == "pdf-viewer:outline-list:complete"
    assert isinstance(r0["data"]["outline_items"], list) and len(r0["data"]["outline_items"]) == 0
    # create
    r1 = create_outline(ctx, rid, {"pdf_uuid": "c83c60c58ad2", "name": "Ch1", "page_at": 3})
    assert r1["type"] == "pdf-viewer:outline-create:complete"
    oid = r1["data"]["outline_id"]
    assert isinstance(oid, str) and oid.startswith("outlineItem-")
    # update
    r2 = update_outline(ctx, rid, {"outline_id": oid, "update": {"name": "Chapter 1", "page_at": 5}})
    assert r2["type"] == "pdf-viewer:outline-update:complete"
    # list should reflect change
    r3 = list_outline(ctx, rid, {"pdf_uuid": "c83c60c58ad2"})
    items = r3["data"]["outline_items"]
    assert len(items) == 1 and items[0]["name"] == "Chapter 1" and items[0]["pageAt"] == 5
    # delete
    r4 = delete_outline(ctx, rid, {"outline_id": oid, "cascade": True})
    assert r4["type"] == "pdf-viewer:outline-delete:complete"
    r5 = list_outline(ctx, rid, {"pdf_uuid": "c83c60c58ad2"})
    assert len(r5["data"]["outline_items"]) == 0


def test_outline_handlers_update_not_found_returns_failed():
    ctx, _ = make_ctx()
    rid = "req-2"
    r = update_outline(ctx, rid, {"outline_id": "outlineItem-NOTEXIST", "update": {"name": "X"}})
    assert r["type"] == "pdf-viewer:outline-update:failed"
    assert r.get("code") == 404
