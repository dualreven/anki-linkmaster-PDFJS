from types import SimpleNamespace

from src.backend.msgCenter_server.handlers.pdf_viewer.annotation_bulk_get import (
    annotation_bulk_get,
)


class FakeAnnotationPlugin:
    def __init__(self):
        self.rows = {}

    def query_by_id(self, ann_id):
        return self.rows.get(ann_id)


def _make_ctx():
    plugin = FakeAnnotationPlugin()
    api = SimpleNamespace(_annotation_plugin=plugin)
    ctx = SimpleNamespace(pdf_library_api=api)
    return ctx, plugin


def test_annotation_bulk_get_success():
    ctx, plugin = _make_ctx()
    plugin.rows["ann_1"] = {
        "ann_id": "ann_1",
        "pdf_uuid": "pdf-1",
        "type": "note",
        "page_number": 2,
        "title": "Card A",
    }
    plugin.rows["ann_2"] = {
        "ann_id": "ann_2",
        "pdf_uuid": "pdf-1",
        "type": "note",
        "page_number": 3,
        "title": "Card B",
    }

    resp = annotation_bulk_get(ctx, "req-1", {"ann_ids": ["ann_1", "ann_2"]})
    assert resp["type"] == "annotation:bulk-get:completed"
    annotations = resp["data"]["annotations"]
    assert len(annotations) == 2
    assert annotations[0]["id"] == "ann_1"
    assert annotations[1]["id"] == "ann_2"
    assert annotations[0]["pdfId"] == "pdf-1"


def test_annotation_bulk_get_missing_annotation():
    ctx, plugin = _make_ctx()
    plugin.rows["ann_1"] = {
        "ann_id": "ann_1",
        "pdf_uuid": "pdf-1",
        "type": "note",
        "page_number": 2,
        "title": "Card A",
    }

    resp = annotation_bulk_get(ctx, "req-2", {"ann_ids": ["ann_1", "missing"]})
    assert resp["type"] == "annotation:bulk-get:failed"
    assert "missing" in resp["error"]["message"]


def test_annotation_bulk_get_invalid_input():
    ctx, _ = _make_ctx()
    resp = annotation_bulk_get(ctx, "req-3", {"ann_ids": []})
    assert resp["type"] == "annotation:bulk-get:failed"
    assert "ann_ids" in resp["error"]["message"]
