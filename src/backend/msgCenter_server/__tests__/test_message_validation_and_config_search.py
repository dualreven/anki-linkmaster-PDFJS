import json
import os
from pathlib import Path
import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server(tmp_path):
    data_dir = str(tmp_path / "data")
    db_path = str(tmp_path / "test-db.sqlite")
    return StandardWebSocketServer(data_dir=data_dir, db_path=db_path)


def test_parse_missing_timestamp_returns_invalid_message_error(server):
    # 捕获 _process_incoming 发送的错误响应
    captured = {}
    def fake_send_text(client, text: str):
        try:
            captured["resp"] = json.loads(text)
        except Exception:
            captured["resp"] = {"__raw": text}
        return True
    # monkeypatch core 发送
    server._core.send_text = fake_send_text  # type: ignore[attr-defined]

    raw = json.dumps({
        "type": "pdf-library:list:requested",
        "request_id": "rid-parse-1",
        # "timestamp" 缺失
        "metadata": {"version": "1.0.0"},
        "data": {"pagination": {"limit": 1}}
    }, ensure_ascii=False)
    server._process_incoming(client_socket=None, message=raw)  # type: ignore[arg-type]

    resp = captured.get("resp") or {}
    assert resp.get("type") == "error"
    assert resp.get("status") == "error"
    assert resp.get("code") == 500
    err = resp.get("error") or {}
    assert err.get("type") == "INVALID_MESSAGE"
    assert "timestamp" in (err.get("message") or "")


def test_pdf_library_search_requested_uses_api_records(server, tmp_path):
    class FakeAPI:
        def search_records(self, payload):
            # 验证基本结构被传入（非严格）
            assert "pagination" in payload
            return {"records": [{"id": "x1", "title": "X"}], "total": 1}
    server.pdf_library_api = FakeAPI()
    resp = server.handle_message({
        "type": "pdf-library:search:requested",
        "request_id": "rid-search-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"query": "", "limit": 10, "offset": 0}
    })
    assert resp["type"] == "pdf-library:search:completed"
    assert resp["status"] == "success"
    assert isinstance(resp["data"]["files"], list) and resp["data"]["files"][0]["id"] == "x1"
    assert resp["data"]["total_count"] == 1


def test_config_read_write_roundtrip(server, tmp_path):
    # 1) config-read 默认生成文件并返回空结构
    read1 = server.handle_message({
        "type": "pdf-library:config-read:requested",
        "request_id": "rid-cfg-1",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {}
    })
    assert read1["type"] == "pdf-library:config-read:completed"
    cfg1 = read1["data"]["config"]
    assert isinstance(cfg1, dict)
    # 文件应已生成在 data_dir
    cfg_path = Path(server.pdf_manager.data_dir) / "pdf-home-config.json"
    assert cfg_path.exists()

    # 2) 写入 saved_filters 并再次读取确认生效
    write = server.handle_message({
        "type": "pdf-library:config-write:requested",
        "request_id": "rid-cfg-2",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {"saved_filters": [{"id": "sf1", "name": "最近阅读", "filters": None, "sort": [{"field": "visited_at", "direction": "desc"}], "ts": 1}]}
    })
    assert write["type"] == "pdf-library:config-write:completed"

    read2 = server.handle_message({
        "type": "pdf-library:config-read:requested",
        "request_id": "rid-cfg-3",
        "timestamp": 0,
        "metadata": {"version": "1.0.0"},
        "data": {}
    })
    assert read2["type"] == "pdf-library:config-read:completed"
    cfg2 = read2["data"]["config"]
    assert any(sf.get("id") == "sf1" for sf in (cfg2.get("saved_filters") or []))

