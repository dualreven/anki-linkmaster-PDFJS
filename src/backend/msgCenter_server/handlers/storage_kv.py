from typing import Dict, Any, Optional
import os
import json
from pathlib import Path
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType

# 计算项目根目录（与 standard_server 一致的方式）
PROJECT_ROOT = Path(__file__).resolve().parents[3]

def _kv_store_load() -> Dict[str, Any]:
    store_dir = os.path.join(PROJECT_ROOT, "data")
    os.makedirs(store_dir, exist_ok=True)
    store_path = os.path.join(store_dir, "storage-kv.json")
    store: Dict[str, Any] = {}
    if os.path.exists(store_path):
        with open(store_path, "r", encoding="utf-8") as f:
            try:
                store = json.load(f) or {}
            except Exception:
                store = {}
    return store

def _kv_store_save(store: Dict[str, Any]) -> None:
    store_dir = os.path.join(PROJECT_ROOT, "data")
    os.makedirs(store_dir, exist_ok=True)
    store_path = os.path.join(store_dir, "storage-kv.json")
    with open(store_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)

def kv_get(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        ns = (data or {}).get("namespace")
        key = (data or {}).get("key")
        if not ns or not key:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 namespace 或 key 参数",
                message_type=MessageType.STORAGE_KV_GET_FAILED,
                code=400,
            )
        store = _kv_store_load()
        value = (store.get(ns) or {}).get(key)
        return StandardMessageHandler.build_response(
            MessageType.STORAGE_KV_GET_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="kv get",
            data={"value": value},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "STORAGE_KV_ERROR",
            f"KV读取失败: {exc}",
            message_type=MessageType.STORAGE_KV_GET_FAILED,
            code=500,
        )

def kv_set(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        ns = (data or {}).get("namespace")
        key = (data or {}).get("key")
        value = (data or {}).get("value")
        if not ns or not key:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 namespace 或 key 参数",
                message_type=MessageType.STORAGE_KV_SET_FAILED,
                code=400,
            )
        store = _kv_store_load()
        bucket = store.get(ns) or {}
        bucket[key] = value
        store[ns] = bucket
        _kv_store_save(store)
        return StandardMessageHandler.build_response(
            MessageType.STORAGE_KV_SET_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="kv set",
            data={"ok": True},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "STORAGE_KV_ERROR",
            f"KV写入失败: {exc}",
            message_type=MessageType.STORAGE_KV_SET_FAILED,
            code=500,
        )

def kv_delete(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        ns = (data or {}).get("namespace")
        key = (data or {}).get("key")
        if not ns or not key:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 namespace 或 key 参数",
                message_type=MessageType.STORAGE_KV_DELETE_FAILED,
                code=400,
            )
        store = _kv_store_load()
        if ns in store and isinstance(store[ns], dict) and key in store[ns]:
            del store[ns][key]
            if not store[ns]:
                del store[ns]
            _kv_store_save(store)
        return StandardMessageHandler.build_response(
            MessageType.STORAGE_KV_DELETE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="kv delete",
            data={"ok": True},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "STORAGE_KV_ERROR",
            f"KV删除失败: {exc}",
            message_type=MessageType.STORAGE_KV_DELETE_FAILED,
            code=500,
        )

