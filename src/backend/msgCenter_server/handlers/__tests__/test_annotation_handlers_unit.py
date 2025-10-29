from types import SimpleNamespace
from src.backend.msgCenter_server.handlers.pdf_viewer.annotation import (
    list_annotations,
    save_annotation,
    delete_annotation,
)


class FakeAnnotationPlugin:
    def __init__(self):
        self.rows = {}

    def query_by_pdf(self, pdf_uuid):
        return [v for v in self.rows.values() if v.get("pdf_uuid") == pdf_uuid]

    def query_by_id(self, ann_id):
        return self.rows.get(ann_id)

    def insert(self, row):
        self.rows[row["ann_id"]] = row
        return row["ann_id"]

    def update(self, ann_id, fields):
        if ann_id not in self.rows:
            return False
        self.rows[ann_id].update({
            "pdf_uuid": fields["pdf_uuid"],
            "page_number": fields["page_number"],
            "type": fields["type"],
            "created_at": fields["created_at"],
            "updated_at": fields["updated_at"],
            "json_data": fields["json_data"],
        })
        return True

    def delete(self, ann_id):
        return bool(self.rows.pop(ann_id, None))


def _ms_to_iso(ms):
    return "1970-01-01T00:00:00Z" if ms is None else "1970-01-01T00:00:00Z"


def _iso_to_ms(iso):
    return 0


def make_ctx():
    plugin = FakeAnnotationPlugin()
    api = SimpleNamespace(_annotation_plugin=plugin)
    ctx = SimpleNamespace(pdf_library_api=api, _ms_to_iso=_ms_to_iso, _iso_to_ms=_iso_to_ms)
    return ctx, plugin


def test_annotation_insert_list_delete():
    ctx, plugin = make_ctx()
    rid = "req-1"
    # insert
    r1 = save_annotation(ctx, rid, {
        "pdf_uuid": "p1",
        "annotation": {"pageNumber": 1, "type": "note", "data": {}, "comments": []}
    })
    assert r1["type"] == "annotation:save:completed"
    ann_id = r1["data"]["id"]
    # list
    r2 = list_annotations(ctx, rid, {"pdf_uuid": "p1"})
    assert r2["type"] == "annotation:list:completed"
    assert r2["data"]["count"] == 1
    # delete
    r3 = delete_annotation(ctx, rid, {"ann_id": ann_id})
    assert r3["type"] == "annotation:delete:completed"
    # list again
    r4 = list_annotations(ctx, rid, {"pdf_uuid": "p1"})
    assert r4["data"]["count"] == 0
