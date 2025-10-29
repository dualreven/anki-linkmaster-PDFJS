from typing import Dict, Any, Optional
import os
from pathlib import Path
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType

PROJECT_ROOT = Path(__file__).resolve().parents[3]

def fs_read(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        import base64
        rel_path = (data or {}).get("path")
        if not rel_path:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 path 参数",
                message_type=MessageType.STORAGE_FS_READ_FAILED,
                code=400,
            )
        base_dir = os.path.join(PROJECT_ROOT, "data", "fs")
        os.makedirs(base_dir, exist_ok=True)
        norm = os.path.normpath(rel_path).replace("\\", "/")
        if norm.startswith(".."):
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_PATH",
                "禁止访问上级目录",
                message_type=MessageType.STORAGE_FS_READ_FAILED,
                code=400,
            )
        abs_path = os.path.join(base_dir, norm)
        if not os.path.exists(abs_path):
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "NOT_FOUND",
                f"文件不存在: {norm}",
                message_type=MessageType.STORAGE_FS_READ_FAILED,
                code=404,
            )
        with open(abs_path, "rb") as f:
            content = f.read()
        b64 = base64.b64encode(content).decode("utf-8")
        return StandardMessageHandler.build_response(
            MessageType.STORAGE_FS_READ_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="fs read",
            data={"path": norm, "content": b64},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "STORAGE_FS_ERROR",
            f"FS读取失败: {exc}",
            message_type=MessageType.STORAGE_FS_READ_FAILED,
            code=500,
        )

def fs_write(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        import base64
        rel_path = (data or {}).get("path")
        content_b64 = (data or {}).get("content")
        overwrite = bool((data or {}).get("overwrite", True))
        if not rel_path or content_b64 is None:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 path 或 content 参数",
                message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                code=400,
            )
        base_dir = os.path.join(PROJECT_ROOT, "data", "fs")
        os.makedirs(base_dir, exist_ok=True)
        norm = os.path.normpath(rel_path).replace("\\", "/")
        if norm.startswith(".."):
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_PATH",
                "禁止写入上级目录",
                message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                code=400,
            )
        abs_path = os.path.join(base_dir, norm)
        if (not overwrite) and os.path.exists(abs_path):
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "ALREADY_EXISTS",
                f"文件已存在: {norm}",
                message_type=MessageType.STORAGE_FS_WRITE_FAILED,
                code=409,
            )
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        content = base64.b64decode(content_b64.encode("utf-8"))
        with open(abs_path, "wb") as f:
            f.write(content)
        return StandardMessageHandler.build_response(
            MessageType.STORAGE_FS_WRITE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="fs write",
            data={"path": norm, "bytes": len(content)},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "STORAGE_FS_ERROR",
            f"FS写入失败: {exc}",
            message_type=MessageType.STORAGE_FS_WRITE_FAILED,
            code=500,
        )

