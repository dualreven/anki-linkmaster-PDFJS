import json
import os
from pathlib import Path
from src.backend.msgCenter_server.core.schema_validation import validate_message_by_schema


def test_validate_message_by_schema_basic(tmp_path: Path):
    # 准备 schema 目录结构
    schema_root = tmp_path / "schemas"
    (schema_root / "capability" / "v1" / "messages").mkdir(parents=True, exist_ok=True)
    schema_path = schema_root / "capability" / "v1" / "messages" / "discover.request.schema.json"
    schema = {
        "type": "object",
        "required": ["type", "timestamp", "request_id", "data"],
        "properties": {
            "type": {"type": "string", "const": "capability:discover:requested"},
            "timestamp": {"type": "number"},
            "request_id": {"type": "string"},
            "data": {"type": "object"},
        },
    }
    schema_path.write_text(json.dumps(schema), encoding="utf-8")

    # 合法消息
    msg = {
        "type": "capability:discover:requested",
        "timestamp": 1,
        "request_id": "req-1",
        "data": {},
    }
    ok, err, path = validate_message_by_schema(msg, str(schema_root))
    assert ok, f"should be valid, got: {err}"
    assert path and os.path.isfile(path)

    # 非法消息（缺少 request_id）
    bad = {
        "type": "capability:discover:requested",
        "timestamp": 1,
        "data": {},
    }
    ok2, err2, _ = validate_message_by_schema(bad, str(schema_root))
    assert not ok2 and "request_id" in err2

