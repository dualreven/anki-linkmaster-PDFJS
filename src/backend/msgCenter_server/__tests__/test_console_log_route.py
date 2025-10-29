import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    return StandardWebSocketServer(data_dir=data_dir, db_path=db_path)


def test_console_log_routed_success(server):
    payload = {
        "type": "console_log",
        "request_id": "req-cl-1",
        "data": {
            "source": "pdf-viewer",
            "level": "info",
            "timestamp": 0,
            "message": "hello",
        },
    }
    resp = server.handle_message(payload)
    assert isinstance(resp, dict)
    assert resp.get("status") == "success"
    assert resp.get("request_id") == "req-cl-1"
    assert resp.get("data", {}).get("logged") is True
