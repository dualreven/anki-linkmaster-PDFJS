from typing import Dict, Any, Optional
import os
import hashlib
from pathlib import Path
from src.backend.msgCenter_server.standard_protocol import StandardMessageHandler, MessageType

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def discover(ctx, request_id: Optional[str]) -> Dict[str, Any]:
    try:
        domains = [
            {
                "name": "capability",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.CAPABILITY_DISCOVER_REQUESTED.value,
                    MessageType.CAPABILITY_DISCOVER_COMPLETED.value,
                    MessageType.CAPABILITY_DISCOVER_FAILED.value,
                    MessageType.CAPABILITY_DESCRIBE_REQUESTED.value,
                    MessageType.CAPABILITY_DESCRIBE_COMPLETED.value,
                    MessageType.CAPABILITY_DESCRIBE_FAILED.value,
                ],
            },
            {
                "name": "pdf-library",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.PDF_LIBRARY_LIST_REQUESTED.value,
                    MessageType.PDF_LIBRARY_LIST_COMPLETED.value,
                    MessageType.PDF_LIBRARY_LIST_FAILED.value,
                    MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value,
                    MessageType.PDF_LIBRARY_SEARCH_COMPLETED.value,
                    MessageType.PDF_LIBRARY_SEARCH_FAILED.value,
                    MessageType.PDF_LIBRARY_ADD_REQUESTED.value,
                    MessageType.PDF_LIBRARY_ADD_COMPLETED.value,
                    MessageType.PDF_LIBRARY_ADD_FAILED.value,
                    MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value,
                    MessageType.PDF_LIBRARY_REMOVE_COMPLETED.value,
                    MessageType.PDF_LIBRARY_REMOVE_FAILED.value,
                    MessageType.PDF_LIBRARY_INFO_REQUESTED.value,
                    MessageType.PDF_LIBRARY_INFO_COMPLETED.value,
                    MessageType.PDF_LIBRARY_INFO_FAILED.value,
                ],
            },
            {
                "name": "storage-kv",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.STORAGE_KV_GET_REQUESTED.value,
                    MessageType.STORAGE_KV_GET_COMPLETED.value,
                    MessageType.STORAGE_KV_GET_FAILED.value,
                    MessageType.STORAGE_KV_SET_REQUESTED.value,
                    MessageType.STORAGE_KV_SET_COMPLETED.value,
                    MessageType.STORAGE_KV_SET_FAILED.value,
                    MessageType.STORAGE_KV_DELETE_REQUESTED.value,
                    MessageType.STORAGE_KV_DELETE_COMPLETED.value,
                    MessageType.STORAGE_KV_DELETE_FAILED.value,
                ],
            },
            {
                "name": "storage-fs",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.STORAGE_FS_READ_REQUESTED.value,
                    MessageType.STORAGE_FS_READ_COMPLETED.value,
                    MessageType.STORAGE_FS_READ_FAILED.value,
                    MessageType.STORAGE_FS_WRITE_REQUESTED.value,
                    MessageType.STORAGE_FS_WRITE_COMPLETED.value,
                    MessageType.STORAGE_FS_WRITE_FAILED.value,
                ],
            },
            {
                "name": "bookmark",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.BOOKMARK_LIST_REQUESTED.value,
                    MessageType.BOOKMARK_LIST_COMPLETED.value,
                    MessageType.BOOKMARK_LIST_FAILED.value,
                    MessageType.BOOKMARK_SAVE_REQUESTED.value,
                    MessageType.BOOKMARK_SAVE_COMPLETED.value,
                    MessageType.BOOKMARK_SAVE_FAILED.value,
                ],
            },
            {
                "name": "outline",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.OUTLINE_LIST_REQUESTED.value,
                    MessageType.OUTLINE_LIST_COMPLETED.value,
                    MessageType.OUTLINE_LIST_FAILED.value,
                    MessageType.OUTLINE_CREATE_REQUESTED.value,
                    MessageType.OUTLINE_CREATE_COMPLETED.value,
                    MessageType.OUTLINE_CREATE_FAILED.value,
                    MessageType.OUTLINE_UPDATE_REQUESTED.value,
                    MessageType.OUTLINE_UPDATE_COMPLETED.value,
                    MessageType.OUTLINE_UPDATE_FAILED.value,
                    MessageType.OUTLINE_DELETE_REQUESTED.value,
                    MessageType.OUTLINE_DELETE_COMPLETED.value,
                    MessageType.OUTLINE_DELETE_FAILED.value,
                    MessageType.OUTLINE_REORDER_REQUESTED.value,
                    MessageType.OUTLINE_REORDER_COMPLETED.value,
                    MessageType.OUTLINE_REORDER_FAILED.value,
                ],
            },
            {
                "name": "pdf-page",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.PDF_PAGE_LOAD_REQUESTED.value,
                    MessageType.PDF_PAGE_LOAD_COMPLETED.value,
                    MessageType.PDF_PAGE_LOAD_FAILED.value,
                    MessageType.PDF_PAGE_PRELOAD_REQUESTED.value,
                    MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED.value,
                ],
            },
            {
                "name": "system",
                "versions": ["1.0.0"],
                "events": [
                    MessageType.HEARTBEAT_REQUESTED.value,
                    MessageType.HEARTBEAT_COMPLETED.value,
                    MessageType.SYSTEM_STATUS_UPDATED.value,
                    MessageType.SYSTEM_ERROR_OCCURRED.value,
                ],
            },
        ]
        return StandardMessageHandler.build_response(
            MessageType.CAPABILITY_DISCOVER_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="capability discovered",
            data={"domains": domains},
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "CAPABILITY_DISCOVER_ERROR",
            f"能力发现失败: {exc}",
            message_type=MessageType.CAPABILITY_DISCOVER_FAILED,
            code=500,
        )


def describe(ctx, request_id: Optional[str], data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        domain = (data or {}).get("domain")
        if not domain:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "INVALID_REQUEST",
                "缺少 domain 参数",
                message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
                code=400,
            )

        schema_root = os.path.join(
            str(PROJECT_ROOT),
            "todo-and-doing",
            "1 doing",
            "20251006182000-bus-contract-capability-registry",
            "schemas",
        )

        def schema_info(rel_path: str) -> Dict[str, Any]:
            full = os.path.join(schema_root, rel_path)
            try:
                with open(full, "r", encoding="utf-8") as f:
                    content = f.read()
                sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
            except Exception:
                sha = None
            return {"path": os.path.relpath(full, str(PROJECT_ROOT)).replace("\\", "/"), "schemaHash": sha}

        described: Dict[str, Any] = {"domain": domain, "version": "1.0.0", "events": []}

        if domain == "capability":
            described["events"] = [
                {"type": MessageType.CAPABILITY_DISCOVER_REQUESTED.value, "schema": schema_info("capability/v1/messages/discover.request.schema.json")},
                {"type": MessageType.CAPABILITY_DISCOVER_COMPLETED.value, "schema": schema_info("capability/v1/messages/discover.completed.schema.json")},
            ]
        elif domain == "pdf-library":
            described["events"] = [
                {"type": MessageType.PDF_LIBRARY_LIST_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/list.request.schema.json")},
                {"type": MessageType.PDF_LIBRARY_LIST_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/list.completed.schema.json")},
                {"type": MessageType.PDF_LIBRARY_SEARCH_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/search.request.schema.json")},
                {"type": MessageType.PDF_LIBRARY_SEARCH_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/search.completed.schema.json")},
                {"type": MessageType.PDF_LIBRARY_ADD_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/add.request.schema.json")},
                {"type": MessageType.PDF_LIBRARY_ADD_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/add.completed.schema.json")},
                {"type": MessageType.PDF_LIBRARY_REMOVE_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/remove.request.schema.json")},
                {"type": MessageType.PDF_LIBRARY_REMOVE_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/remove.completed.schema.json")},
                {"type": MessageType.PDF_LIBRARY_INFO_REQUESTED.value, "schema": schema_info("pdf-library/v1/messages/info.request.schema.json")},
                {"type": MessageType.PDF_LIBRARY_INFO_COMPLETED.value, "schema": schema_info("pdf-library/v1/messages/info.completed.schema.json")},
            ]
        elif domain == "storage-kv":
            described["events"] = [
                {"type": MessageType.STORAGE_KV_GET_REQUESTED.value, "schema": schema_info("storage-kv/v1/messages/get.request.schema.json")},
                {"type": MessageType.STORAGE_KV_GET_COMPLETED.value, "schema": schema_info("storage-kv/v1/messages/get.completed.schema.json")},
                {"type": MessageType.STORAGE_KV_SET_REQUESTED.value, "schema": schema_info("storage-kv/v1/messages/set.request.schema.json")},
                {"type": MessageType.STORAGE_KV_SET_COMPLETED.value, "schema": schema_info("storage-kv/v1/messages/set.completed.schema.json")},
                {"type": MessageType.STORAGE_KV_DELETE_REQUESTED.value, "schema": schema_info("storage-kv/v1/messages/delete.request.schema.json")},
                {"type": MessageType.STORAGE_KV_DELETE_COMPLETED.value, "schema": schema_info("storage-kv/v1/messages/delete.completed.schema.json")},
            ]
        elif domain == "storage-fs":
            described["events"] = [
                {"type": MessageType.STORAGE_FS_READ_REQUESTED.value, "schema": schema_info("storage-fs/v1/messages/read.request.schema.json")},
                {"type": MessageType.STORAGE_FS_READ_COMPLETED.value, "schema": schema_info("storage-fs/v1/messages/read.completed.schema.json")},
                {"type": MessageType.STORAGE_FS_WRITE_REQUESTED.value, "schema": schema_info("storage-fs/v1/messages/write.request.schema.json")},
                {"type": MessageType.STORAGE_FS_WRITE_COMPLETED.value, "schema": schema_info("storage-fs/v1/messages/write.completed.schema.json")},
            ]
        elif domain == "annotation":
            described["events"] = [
                {"type": MessageType.ANNOTATION_LIST_REQUESTED.value, "schema": schema_info("annotation/v1/messages/list.request.schema.json")},
                {"type": MessageType.ANNOTATION_LIST_COMPLETED.value, "schema": schema_info("annotation/v1/messages/list.completed.schema.json")},
                {"type": MessageType.ANNOTATION_SAVE_REQUESTED.value, "schema": schema_info("annotation/v1/messages/save.request.schema.json")},
                {"type": MessageType.ANNOTATION_SAVE_COMPLETED.value, "schema": schema_info("annotation/v1/messages/save.completed.schema.json")},
                {"type": MessageType.ANNOTATION_DELETE_REQUESTED.value, "schema": schema_info("annotation/v1/messages/delete.request.schema.json")},
                {"type": MessageType.ANNOTATION_DELETE_COMPLETED.value, "schema": schema_info("annotation/v1/messages/delete.completed.schema.json")},
            ]
        elif domain == "bookmark":
            described["events"] = [
                {"type": MessageType.BOOKMARK_LIST_REQUESTED.value},
                {"type": MessageType.BOOKMARK_LIST_COMPLETED.value},
                {"type": MessageType.BOOKMARK_LIST_FAILED.value},
                {"type": MessageType.BOOKMARK_SAVE_REQUESTED.value},
                {"type": MessageType.BOOKMARK_SAVE_COMPLETED.value},
                {"type": MessageType.BOOKMARK_SAVE_FAILED.value},
            ]
        elif domain == "outline":
            described["events"] = [
                {"type": MessageType.OUTLINE_LIST_REQUESTED.value},
                {"type": MessageType.OUTLINE_LIST_COMPLETED.value},
                {"type": MessageType.OUTLINE_LIST_FAILED.value},
                {"type": MessageType.OUTLINE_CREATE_REQUESTED.value},
                {"type": MessageType.OUTLINE_CREATE_COMPLETED.value},
                {"type": MessageType.OUTLINE_CREATE_FAILED.value},
                {"type": MessageType.OUTLINE_UPDATE_REQUESTED.value},
                {"type": MessageType.OUTLINE_UPDATE_COMPLETED.value},
                {"type": MessageType.OUTLINE_UPDATE_FAILED.value},
                {"type": MessageType.OUTLINE_DELETE_REQUESTED.value},
                {"type": MessageType.OUTLINE_DELETE_COMPLETED.value},
                {"type": MessageType.OUTLINE_DELETE_FAILED.value},
                {"type": MessageType.OUTLINE_REORDER_REQUESTED.value},
                {"type": MessageType.OUTLINE_REORDER_COMPLETED.value},
                {"type": MessageType.OUTLINE_REORDER_FAILED.value},
            ]
        elif domain == "pdf-page":
            described["events"] = [
                {"type": MessageType.PDF_PAGE_LOAD_REQUESTED.value},
                {"type": MessageType.PDF_PAGE_LOAD_COMPLETED.value},
                {"type": MessageType.PDF_PAGE_LOAD_FAILED.value},
                {"type": MessageType.PDF_PAGE_PRELOAD_REQUESTED.value},
                {"type": MessageType.PDF_PAGE_CACHE_CLEAR_REQUESTED.value},
            ]
        elif domain == "system":
            described["events"] = [
                {"type": MessageType.HEARTBEAT_REQUESTED.value},
                {"type": MessageType.HEARTBEAT_COMPLETED.value},
                {"type": MessageType.SYSTEM_STATUS_UPDATED.value},
                {"type": MessageType.SYSTEM_ERROR_OCCURRED.value},
            ]
        else:
            return StandardMessageHandler.build_error_response(
                request_id or "unknown",
                "DOMAIN_NOT_FOUND",
                f"未知 domain: {domain}",
                message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
                code=404,
            )

        return StandardMessageHandler.build_response(
            MessageType.CAPABILITY_DESCRIBE_COMPLETED,
            request_id or StandardMessageHandler.generate_request_id(),
            status="success",
            code=200,
            message="capability describe",
            data=described,
        )
    except Exception as exc:
        return StandardMessageHandler.build_error_response(
            request_id or "unknown",
            "CAPABILITY_DESCRIBE_ERROR",
            f"能力描述失败: {exc}",
            message_type=MessageType.CAPABILITY_DESCRIBE_FAILED,
            code=500,
        )

