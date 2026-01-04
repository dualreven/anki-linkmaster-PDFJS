import json

import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer
from src.qt.compat import QWebSocket


class _FakeSocket:
    def __init__(self):
        self.sent = []

    def sendTextMessage(self, text: str):
        self.sent.append(str(text))


@pytest.mark.smoke
def test_navigate_no_target_auto_launches_viewer_and_queues_forward(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    server = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)

    sender = QWebSocket()
    got = {"open": None}

    def _on_msg(_sock, msg):
        if isinstance(msg, dict) and msg.get("type") == "app-window:open:requested":
            got["open"] = msg

    server.message_received.connect(_on_msg)  # type: ignore[arg-type]

    pdf_id = "c83c60c58ad2"
    req_id = "req-nav-1"
    payload = {
        "type": "pdf-viewer:navigate:requested",
        "timestamp": 0,
        "request_id": req_id,
        "to": [
            {"client_id": f"pdf-viewer-{pdf_id}", "routing_key": f"pdf:{pdf_id}", "target_type": "pdf-viewer"}
        ],
        "data": {"target": {"type": "anchor", "anchor_id": "pdfanchor-44e42f698f9a"}, "options": {}},
    }

    resp = server.handle_message(payload, client_socket=sender)

    assert isinstance(resp, dict)
    assert resp["type"] == "pdf-viewer:navigate:completed"
    assert resp["code"] == 202
    assert resp["request_id"] == req_id
    assert got["open"] is not None
    assert got["open"]["data"]["client_id"] == f"pdf-viewer-{pdf_id}"
    assert got["open"]["data"]["window_type"] == "pdf-viewer"
    assert got["open"]["data"]["params"]["pdf_id"] == pdf_id

    viewer = _FakeSocket()
    sent = server._flush_pending_forward_for_client(client_id=f"pdf-viewer-{pdf_id}", socket=viewer)  # type: ignore[attr-defined]
    assert sent == 1
    assert len(viewer.sent) == 1
    forwarded = json.loads(viewer.sent[0])
    assert forwarded["type"] == "pdf-viewer:navigate:requested"
    assert forwarded["request_id"] == req_id
    assert forwarded.get("gate", {}).get("once") == "pdf-viewer:render:ready"

