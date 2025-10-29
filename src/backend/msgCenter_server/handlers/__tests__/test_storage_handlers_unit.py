from src.backend.msgCenter_server.handlers.storage_kv import kv_set, kv_get, kv_delete
from src.backend.msgCenter_server.handlers.storage_fs import fs_write, fs_read
import base64


def test_kv_set_get_delete_roundtrip():
    rid = "req-kv"
    # set
    r1 = kv_set(None, rid, {"namespace": "ut", "key": "k1", "value": {"x": 1}})
    assert r1["type"] == "storage-kv:set:completed"
    # get
    r2 = kv_get(None, rid, {"namespace": "ut", "key": "k1"})
    assert r2["type"] == "storage-kv:get:completed"
    assert r2["data"]["value"] == {"x": 1}
    # delete
    r3 = kv_delete(None, rid, {"namespace": "ut", "key": "k1"})
    assert r3["type"] == "storage-kv:delete:completed"


def test_fs_write_read_roundtrip():
    rid = "req-fs"
    content = b"hello-ut"
    b64 = base64.b64encode(content).decode("utf-8")
    # write
    w = fs_write(None, rid, {"path": "u/ut.txt", "content": b64, "overwrite": True})
    assert w["type"] == "storage-fs:write:completed"
    assert w["data"]["bytes"] == len(content)
    # read
    r = fs_read(None, rid, {"path": "u/ut.txt"})
    assert r["type"] == "storage-fs:read:completed"
    assert base64.b64decode(r["data"]["content"].encode("utf-8")) == content

