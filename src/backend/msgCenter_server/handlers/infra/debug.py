from typing import Dict, Any, Optional
from pathlib import Path as _Path
import json as _json
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType
import os


def read_debug_info(ctx, request_id: Optional[str]) -> Dict[str, Any]:
    try:
        candidates = []
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
        try:
            candidates.append(_Path(project_root) / "logs" / "debug-info.json")
        except Exception:
            pass
        try:
            candidates.append(_Path("dist/latest/logs/debug-info.json"))
        except Exception:
            pass
        flags = None
        source = None
        for p in candidates:
            try:
                if p.exists():
                    raw = p.read_text(encoding="utf-8")
                    obj = _json.loads(raw or "{}")
                    flags = {k: v for k, v in (obj or {}).items() if not str(k).startswith("_")}
                    source = str(p)
                    break
            except Exception:
                pass
        if flags is None:
            flags = {}
        return StandardMessageHandler.build_response(
            MessageType.DEBUG_INFO_READ_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="debug-info read",
            data={"flags": flags, "source": source},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "INTERNAL_ERROR",
            f"读取 debug-info 失败: {exc}",
            message_type=MessageType.DEBUG_INFO_READ_FAILED,
            code=500,
        )

