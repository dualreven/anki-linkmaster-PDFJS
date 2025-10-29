# -*- coding: utf-8 -*-
"""
两段式测试（第一段）：
验证从外部经由 MsgCenter 发起的 pdf-viewer 导航请求，后端严格校验并定向转发。
不依赖 Qt：直接调用 handler.navigate_viewer，并用 ctx 桩对象拦截 _forward_viewer_navigate。
"""
from __future__ import annotations
import json
import time
import types

from src.backend.msgCenter_server.handlers.pdf_viewer.viewer import navigate_viewer
from src.backend.msgCenter_server.standard_protocol import MessageType


class CtxStub:
    def __init__(self):
        self.forwarded_messages = []

    def _forward_viewer_navigate(self, message: dict) -> int:
        # 记录并模拟“成功投递1个”
        self.forwarded_messages.append(json.loads(json.dumps(message)))
        return 1


def _make_request(data: dict) -> dict:
    return {
        "type": MessageType.PDF_VIEWER_NAVIGATE_REQUESTED.value,
        "request_id": f"req_{int(time.time()*1000)}",
        "data": data,
        "timestamp": int(time.time() * 1000),
    }


def test_navigate_forward_annotation_success():
    ctx = CtxStub()
    req = _make_request({
        "to": {"viewer_id": "vwr_abc"},
        "target": {"type": "annotation", "annotation_id": "ann_123"},
        "options": {"highlight": True}
    })
    resp = navigate_viewer(ctx, req["request_id"], req["data"])
    assert resp["type"] == MessageType.PDF_VIEWER_NAVIGATE_COMPLETED.value
    assert resp["data"]["forwarded_count"] == 1
    # 校验转发内容
    assert len(ctx.forwarded_messages) == 1
    fwd = ctx.forwarded_messages[0]
    assert fwd["type"] == MessageType.PDF_VIEWER_NAVIGATE_REQUESTED.value
    assert fwd["to"]["viewer_id"] == "vwr_abc"
    assert fwd["data"]["target"]["annotation_id"] == "ann_123"


def test_navigate_forward_anchor_success():
    ctx = CtxStub()
    req = _make_request({
        "to": {"pdf_uuid": "deadbeefcafe"},
        "target": {"type": "anchor", "anchor_id": "pdfanchor-aaaaaaaaaaaa"},
        "options": {}
    })
    resp = navigate_viewer(ctx, req["request_id"], req["data"])
    assert resp["type"] == MessageType.PDF_VIEWER_NAVIGATE_COMPLETED.value
    assert resp["data"]["forwarded_count"] == 1
    fwd = ctx.forwarded_messages[0]
    assert fwd["to"]["pdf_uuid"] == "deadbeefcafe"
    assert fwd["data"]["target"]["anchor_id"] == "pdfanchor-aaaaaaaaaaaa"


def test_navigate_forward_outline_success():
    ctx = CtxStub()
    req = _make_request({
        "to": {"viewer_id": "vwr_xyz"},
        "target": {"type": "outline", "outline_item_id": "outline-123"},
    })
    resp = navigate_viewer(ctx, req["request_id"], req["data"])
    assert resp["type"] == MessageType.PDF_VIEWER_NAVIGATE_COMPLETED.value
    assert len(ctx.forwarded_messages) == 1
    assert ctx.forwarded_messages[0]["data"]["target"]["outline_item_id"] == "outline-123"


def test_navigate_missing_to_should_fail():
    ctx = CtxStub()
    req = _make_request({
        "target": {"type": "page", "page_number": 1}
    })
    resp = navigate_viewer(ctx, req["request_id"], req["data"])
    assert resp["type"] == MessageType.PDF_VIEWER_NAVIGATE_FAILED.value
    assert resp["error"]["type"] == "MISSING_TARGET"


def test_navigate_invalid_mode_should_fail():
    ctx = CtxStub()
    req = _make_request({
        "to": {"viewer_id": "vwr_abc"},
        "target": {"type": "unknown"}
    })
    resp = navigate_viewer(ctx, req["request_id"], req["data"])
    assert resp["type"] == MessageType.PDF_VIEWER_NAVIGATE_FAILED.value
    assert resp["error"]["type"] == "UNSUPPORTED_MODE"

