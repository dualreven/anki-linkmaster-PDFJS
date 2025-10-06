import base64
import os
import pytest

from src.backend.msgCenter_server.standard_server import StandardWebSocketServer


@pytest.fixture()
def server():
    return StandardWebSocketServer()


def test_storage_kv_set_get_delete(server, tmp_path):
    # set
    resp_set = server.handle_message({
        "type": "storage-kv:set:requested",
        "request_id": "req-kv-1",
        "data": {"namespace": "test", "key": "k1", "value": {"a": 1}}
    })
    assert resp_set["type"] == "storage-kv:set:completed"
    assert resp_set["status"] == "success"

    # get
    resp_get = server.handle_message({
        "type": "storage-kv:get:requested",
        "request_id": "req-kv-2",
        "data": {"namespace": "test", "key": "k1"}
    })
    assert resp_get["type"] == "storage-kv:get:completed"
    assert resp_get["data"]["value"] == {"a": 1}

    # delete
    resp_del = server.handle_message({
        "type": "storage-kv:delete:requested",
        "request_id": "req-kv-3",
        "data": {"namespace": "test", "key": "k1"}
    })
    assert resp_del["type"] == "storage-kv:delete:completed"
    assert resp_del["status"] == "success"


def test_storage_fs_write_read(server, tmp_path):
    content = b"hello world"
    b64 = base64.b64encode(content).decode("utf-8")
    # write
    resp_w = server.handle_message({
        "type": "storage-fs:write:requested",
        "request_id": "req-fs-1",
        "data": {"path": "u/test.txt", "content": b64, "overwrite": True}
    })
    assert resp_w["type"] == "storage-fs:write:completed"
    assert resp_w["data"]["bytes"] == len(content)

    # read
    resp_r = server.handle_message({
        "type": "storage-fs:read:requested",
        "request_id": "req-fs-2",
        "data": {"path": "u/test.txt"}
    })
    assert resp_r["type"] == "storage-fs:read:completed"
    assert base64.b64decode(resp_r["data"]["content"].encode("utf-8")) == content

