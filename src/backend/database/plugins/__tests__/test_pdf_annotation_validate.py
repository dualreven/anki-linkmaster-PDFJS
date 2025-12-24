# -*- coding: utf-8 -*-
import pytest

from src.backend.database.plugins.pdf_annotation_plugin import PDFAnnotationTablePlugin
from src.backend.database.plugins.pdf_annotation.validate import validate_data  # type: ignore
from src.backend.database.exceptions import DatabaseValidationError


def build_base_payload(ann_type: str = "screenshot"):
    base = {
        "ann_id": "pdfannotation-ABCDEFGHIJKLMNOP",  # 16 base64url-like chars
        "pdf_uuid": "abc123abc123",  # 12 hex
        "page_number": 3,
        "type": ann_type,
        "created_at": 1,
        "updated_at": 1,
        "version": 1,
        "json_data": {
            "data": {},
            "comments": [],
        },
    }
    if ann_type == "screenshot":
        base["json_data"]["data"] = {
            "rectPercent": {
                "xPercent": 10,
                "yPercent": 20,
                "widthPercent": 30,
                "heightPercent": 40,
            },
            "imagePath": "/a/b.png",
            "imageHash": "0"*32,
        }
    elif ann_type == "text-highlight":
        base["json_data"]["data"] = {
            "selectedText": "hello",
            "textRanges": [{"start": 1, "end": 2}],
            "highlightColor": "#ff0000",
        }
    else:
        base["json_data"]["data"] = {
            "position": {"x": 1, "y": 2},
            "content": "hi",
        }
    return base


def test_validate_ok_screenshot():
    data = build_base_payload("screenshot")
    out = validate_data(data)
    assert out["ann_id"] == data["ann_id"]
    assert out["json_data"]["data"]["imagePath"] == "/a/b.png"


def test_validate_fail_wrong_uuid():
    data = build_base_payload("screenshot")
    data["pdf_uuid"] = "not_hex12"
    with pytest.raises(DatabaseValidationError):
        validate_data(data)


def test_validate_ok_text_highlight():
    data = build_base_payload("text-highlight")
    out = validate_data(data)
    assert out["json_data"]["data"]["selectedText"] == "hello"

def test_validate_ok_text_highlight_keeps_line_rects():
    data = build_base_payload("text-highlight")
    data["json_data"]["data"]["lineRects"] = [
        {"xPercent": 5, "yPercent": 50, "widthPercent": 60, "heightPercent": 3},
        {"xPercent": 5, "yPercent": 60, "widthPercent": 60, "heightPercent": 3},
    ]
    out = validate_data(data)
    assert out["json_data"]["data"]["lineRects"][0]["yPercent"] == 50
    assert out["json_data"]["data"]["lineRects"][1]["yPercent"] == 60


def test_validate_ok_comment():
    data = build_base_payload("comment")
    out = validate_data(data)
    assert out["json_data"]["data"]["position"]["x"] == 1
