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
def test_ingest_no_target_queues_pending_forward_and_returns_202(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    server = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)

    sender = QWebSocket()
    req_id = "req-ingest-1"
    payload = {
        "type": "card-planner:ingest:requested",
        "timestamp": 0,
        "request_id": req_id,
        "to": [{"client_id": "new-card-scheduler"}],
        "data": {
            "op": {"kind": "all-to-one", "target": {"kind": "new"}, "face": "Q"},
            "annotation_ids": ["ann_1", "ann_2"],
        },
    }

    resp = server.handle_message(payload, client_socket=sender)

    assert isinstance(resp, dict)
    assert resp["type"] == "card-planner:ingest:completed"
    assert resp["code"] == 202
    assert resp["status"] == "accepted"
    assert resp["request_id"] == req_id
    assert resp["data"]["client_id"] == "new-card-scheduler"

    planner = _FakeSocket()
    sent = server._flush_pending_forward_for_client(client_id="new-card-scheduler", socket=planner)  # type: ignore[attr-defined]
    assert sent == 1
    forwarded = json.loads(planner.sent[0])
    assert forwarded["type"] == "card-planner:ingest:requested"
    assert forwarded["request_id"] == req_id


def test_ingest_queued_emits_app_window_open_deduped(tmp_path, monkeypatch):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    server = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)

    got = {"opens": []}

    def _on_msg(_sock, msg):
        if isinstance(msg, dict) and msg.get("type") == "app-window:open:requested":
            got["opens"].append(msg)

    server.message_received.connect(_on_msg)  # type: ignore[arg-type]

    sender = QWebSocket()
    payload = {
        "type": "card-planner:ingest:requested",
        "timestamp": 0,
        "request_id": "req-ingest-open-1",
        "to": [{"client_id": "new-card-scheduler"}],
        "data": {
            "op": {"kind": "all-to-one", "target": {"kind": "new"}, "face": "Q"},
            "annotation_ids": ["ann_1"],
        },
    }

    monkeypatch.setattr("src.backend.msgCenter_server.standard_server.time.time", lambda: 1.0)
    resp1 = server.handle_message(payload, client_socket=sender)
    assert resp1["code"] == 202
    assert len(got["opens"]) == 1
    assert got["opens"][0]["to"] == "backend"
    assert got["opens"][0]["data"]["window_type"] == "new-card-scheduler"
    assert got["opens"][0]["data"]["client_id"] == "new-card-scheduler"

    # 15s 内重复触发：不应重复发射 open
    monkeypatch.setattr("src.backend.msgCenter_server.standard_server.time.time", lambda: 2.0)
    resp2 = server.handle_message(payload, client_socket=sender)
    assert resp2["code"] == 202
    assert len(got["opens"]) == 1


def test_pending_forward_ttl_expired_entry_is_not_flushed(tmp_path, monkeypatch):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    server = StandardWebSocketServer(data_dir=data_dir, db_path=db_path)

    # 冻结时间：先入队，后推进到过期时间之后
    monkeypatch.setattr("src.backend.msgCenter_server.standard_server.time.time", lambda: 1.0)
    server._queue_pending_forward(  # type: ignore[attr-defined]
        client_id="new-card-scheduler",
        message={"type": "card-planner:ingest:requested", "request_id": "rid-expired"},
        ttl_ms=1,
    )
    monkeypatch.setattr("src.backend.msgCenter_server.standard_server.time.time", lambda: 10.0)

    planner = _FakeSocket()
    sent = server._flush_pending_forward_for_client(client_id="new-card-scheduler", socket=planner)  # type: ignore[attr-defined]
    assert sent == 0
    assert planner.sent == []
