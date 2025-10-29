from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional
import time

from ...database.exceptions import DatabaseValidationError  # type: ignore


def ensure_ms(value: Optional[int]) -> int:
    if value is None:
        return 0
    if value == 0:
        return 0
    if value > 10 ** 12:
        return int(value)
    if value < 0:
        return 0
    return int(value * 1000)


def ensure_seconds(value: Optional[int]) -> int:
    if value is None:
        return 0
    if value >= 10 ** 12:
        return int(value // 1000)
    return int(value)


def parse_datetime_to_ms(value: Optional[str]) -> int:
    if not value:
        return 0
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return int(parsed.timestamp() * 1000)
    except ValueError:
        return 0


def normalize_tags(tags: Any) -> List[str]:
    if tags is None:
        return []
    if isinstance(tags, list):
        return [str(tag) for tag in tags]
    if isinstance(tags, str):
        return [item.strip() for item in tags.split(",") if item.strip()]
    return [str(tag) for tag in list(tags)]


def normalize_input(api, data: Dict[str, Any]) -> Dict[str, Any]:
    if "uuid" in data and "json_data" in data:
        payload = deepcopy(data)
    else:
        payload = from_frontend_record(api, data)

    payload.setdefault("created_at", int(time.time() * 1000))
    payload.setdefault("updated_at", payload["created_at"])
    payload.setdefault("visited_at", payload["json_data"].get("last_accessed_at", 0))
    payload.setdefault("version", 1)
    payload["json_data"]["tags"] = normalize_tags(payload["json_data"].get("tags", []))
    payload["json_data"].setdefault("filename", payload.get("title", ""))
    payload["json_data"].setdefault("filepath", payload["json_data"].get("filepath", ""))
    payload["json_data"].setdefault("is_visible", True)
    payload["json_data"].setdefault("review_count", 0)
    payload["json_data"].setdefault("total_reading_time", 0)
    payload["json_data"].setdefault("rating", 0)
    payload["json_data"].setdefault("due_date", 0)
    payload["json_data"]["last_accessed_at"] = ensure_ms(
        payload["json_data"].get("last_accessed_at", payload.get("visited_at", 0))
    )
    payload["created_at"] = ensure_ms(payload.get("created_at"))
    payload["updated_at"] = ensure_ms(payload.get("updated_at"))
    payload["visited_at"] = ensure_ms(payload.get("visited_at", 0))
    payload["json_data"]["due_date"] = ensure_ms(payload["json_data"].get("due_date", 0))
    return payload


def normalize_update(api, uuid: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    if not updates:
        return {}
    if "json_data" in updates:
        payload = deepcopy(updates)
    else:
        payload: Dict[str, Any] = {}
        json_updates: Dict[str, Any] = {}
        for key, value in updates.items():
            if key in {"title", "author", "page_count", "file_size", "version"}:
                payload[key] = value
            elif key in {"created_at", "updated_at", "visited_at"}:
                payload[key] = ensure_ms(value)
            elif key == "last_accessed_at":
                ms_value = ensure_ms(value)
                payload["visited_at"] = ms_value
                json_updates["last_accessed_at"] = ms_value
            elif key == "filename":
                json_updates["filename"] = value
            elif key == "file_path":
                json_updates["filepath"] = value
            elif key == "tags":
                json_updates["tags"] = normalize_tags(value)
            elif key == "rating":
                json_updates["rating"] = value
            elif key == "is_visible":
                json_updates["is_visible"] = bool(value)
            elif key == "total_reading_time":
                json_updates["total_reading_time"] = int(value)
            elif key == "due_date":
                json_updates["due_date"] = ensure_ms(value)
            elif key == "review_count":
                json_updates["review_count"] = int(value)
            elif key == "notes":
                json_updates["notes"] = value
            elif key == "subject":
                json_updates["subject"] = value
            elif key == "keywords":
                json_updates["keywords"] = value
        if json_updates:
            payload["json_data"] = json_updates
    if "json_data" in payload:
        json_data = payload["json_data"]
        if "tags" in json_data:
            json_data["tags"] = normalize_tags(json_data["tags"])
        if "last_accessed_at" in json_data:
            json_data["last_accessed_at"] = ensure_ms(json_data["last_accessed_at"])
        if "due_date" in json_data:
            json_data["due_date"] = ensure_ms(json_data["due_date"])
    for key in ("created_at", "updated_at", "visited_at"):
        if key in payload:
            payload[key] = ensure_ms(payload[key])
    return payload


def from_frontend_record(api, record: Dict[str, Any]) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    uuid = record.get("uuid") or record.get("id")
    if not uuid:
        raise DatabaseValidationError("uuid is required")
    created_at = record.get("created_at")
    updated_at = record.get("updated_at", created_at)
    last_accessed = record.get("last_accessed_at", 0)
    json_data = {
        "filename": record.get("filename", ""),
        "filepath": record.get("file_path", ""),
        "tags": normalize_tags(record.get("tags")),
        "rating": record.get("rating", 0),
        "is_visible": record.get("is_visible", True),
        "total_reading_time": record.get("total_reading_time", 0),
        "last_accessed_at": ensure_ms(last_accessed),
        "review_count": record.get("review_count", 0),
        "due_date": ensure_ms(record.get("due_date", 0)),
        "notes": record.get("notes", ""),
    }
    for extra_key in ("subject", "keywords", "thumbnail_path"):
        value = record.get(extra_key)
        if value is not None:
            json_data[extra_key] = value
    payload = {
        "uuid": uuid,
        "title": record.get("title") or record.get("filename", ""),
        "author": record.get("author", ""),
        "page_count": record.get("page_count", 0),
        "file_size": record.get("file_size", 0),
        "created_at": ensure_ms(created_at) if created_at is not None else now_ms,
        "updated_at": ensure_ms(updated_at) if updated_at is not None else now_ms,
        "visited_at": ensure_ms(last_accessed),
        "version": record.get("version", 1),
        "json_data": json_data,
    }
    return payload


def from_pdf_manager_info(api, file_info: Dict[str, Any]) -> Dict[str, Any]:
    uuid = file_info.get("id")
    if not uuid:
        raise DatabaseValidationError("file info missing id")
    created_at = parse_datetime_to_ms(file_info.get("created_time"))
    updated_at = parse_datetime_to_ms(file_info.get("modified_time")) or created_at
    last_accessed = file_info.get("last_accessed_at", 0)
    json_data = {
        "filename": file_info.get("filename", ""),
        "filepath": file_info.get("filepath", ""),
        "tags": normalize_tags(file_info.get("tags")),
        "rating": file_info.get("rating", 0),
        "is_visible": file_info.get("is_visible", True),
        "total_reading_time": file_info.get("total_reading_time", 0),
        "last_accessed_at": ensure_ms(last_accessed),
        "review_count": file_info.get("review_count", 0),
        "due_date": ensure_ms(file_info.get("due_date", 0)),
        "notes": file_info.get("notes", ""),
        "thumbnail_path": file_info.get("thumbnail_path"),
        "subject": file_info.get("subject", ""),
        "keywords": file_info.get("keywords", ""),
    }
    payload = {
        "uuid": uuid,
        "title": file_info.get("title") or file_info.get("filename", ""),
        "author": file_info.get("author", ""),
        "page_count": file_info.get("page_count", 0),
        "file_size": file_info.get("file_size", 0),
        "created_at": created_at or int(time.time() * 1000),
        "updated_at": updated_at or int(time.time() * 1000),
        "visited_at": ensure_ms(last_accessed),
        "version": 1,
        "json_data": json_data,
    }
    return payload


def map_to_frontend(api, row: Dict[str, Any]) -> Dict[str, Any]:
    jd = deepcopy(row.get("json_data", {}))
    created_at = row.get("created_at", 0)
    last_accessed = jd.get("last_accessed_at", row.get("visited_at", 0))
    due_date = jd.get("due_date", 0)
    record = {
        "id": row["uuid"],
        "title": row.get("title", ""),
        "author": row.get("author", ""),
        "filename": jd.get("filename", ""),
        "file_path": jd.get("filepath", ""),
        "file_size": row.get("file_size", 0),
        "page_count": row.get("page_count", 0),
        "created_at": ensure_seconds(created_at),
        "updated_at": ensure_seconds(row.get("updated_at", created_at)),
        "last_accessed_at": ensure_seconds(last_accessed),
        "review_count": jd.get("review_count", 0),
        "rating": jd.get("rating", 0),
        "tags": normalize_tags(jd.get("tags")),
        "is_visible": bool(jd.get("is_visible", True)),
        "total_reading_time": jd.get("total_reading_time", 0),
        "due_date": ensure_seconds(due_date),
        "notes": jd.get("notes", ""),
        "subject": jd.get("subject", ""),
        "keywords": jd.get("keywords", ""),
    }
    return record
