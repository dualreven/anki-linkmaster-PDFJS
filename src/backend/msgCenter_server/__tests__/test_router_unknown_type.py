import pytest
from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    return StandardWebSocketServer(data_dir=data_dir, db_path=db_path)


def test_unknown_message_type_returns_400(server):
    payload = {
        "type": "foo:bar:requested",
        "request_id": "req-unknown",
        "data": {},
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "error"
    assert resp["request_id"] == "req-unknown"
    assert resp["code"] == 400
    assert "未知的消息类型" in resp["error"]["message"]
