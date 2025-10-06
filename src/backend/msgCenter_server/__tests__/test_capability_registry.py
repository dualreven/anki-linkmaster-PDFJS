import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server():
    return StandardWebSocketServer()


def test_capability_discover_returns_domains(server):
    payload = {
        "type": "capability:discover:requested",
        "request_id": "req-cap-1",
        "data": {}
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "capability:discover:completed"
    assert resp["request_id"] == "req-cap-1"
    assert resp["status"] == "success"
    domains = resp.get("data", {}).get("domains", [])
    names = {d.get("name") for d in domains}
    assert {"capability", "pdf-library", "storage-kv"}.issubset(names)


def test_capability_describe_pdf_library(server):
    payload = {
        "type": "capability:describe:requested",
        "request_id": "req-cap-2",
        "data": {"domain": "pdf-library"}
    }
    resp = server.handle_message(payload)
    assert resp["type"] == "capability:describe:completed"
    assert resp["request_id"] == "req-cap-2"
    events = resp.get("data", {}).get("events", [])
    event_types = {e.get("type") for e in events}
    assert "pdf-library:search:requested" in event_types
    assert "pdf-library:search:completed" in event_types

