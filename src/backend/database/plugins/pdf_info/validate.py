from __future__ import annotations

import json
from typing import Any, Dict
from .constants import UUID_PATTERN, FILENAME_PATTERN
from ...exceptions import DatabaseValidationError


def validate_data(plugin, data: Dict[str, Any]) -> Dict[str, Any]:
    if data is None:
        raise DatabaseValidationError("data is required")

    normalized: Dict[str, Any] = {}

    uuid = data.get("uuid")
    normalized["uuid"] = _validate_uuid(uuid)

    normalized["title"] = _validate_string(data.get("title"), "title", allow_empty=False)
    normalized["author"] = _validate_string(data.get("author", ""), "author", allow_empty=True)

    normalized["page_count"] = _validate_non_negative_int(data.get("page_count", 0), "page_count")
    normalized["file_size"] = _validate_non_negative_int(data.get("file_size", 0), "file_size")
    normalized["created_at"] = _validate_timestamp(data.get("created_at"))
    normalized["updated_at"] = _validate_timestamp(data.get("updated_at"))
    normalized["visited_at"] = _validate_non_negative_int(data.get("visited_at", 0), "visited_at")

    version = data.get("version", 1)
    version_int = _validate_non_negative_int(version, "version")
    if version_int < 1:
        raise DatabaseValidationError("version must be >= 1")
    normalized["version"] = version_int

    normalized["json_data"] = _validate_json_data(data.get("json_data"))
    return normalized


def _validate_uuid(value: Any) -> str:
    if not value or not isinstance(value, str):
        raise DatabaseValidationError("uuid is required")
    if not UUID_PATTERN.fullmatch(value):
        raise DatabaseValidationError("uuid must be 12 hex characters")
    return value


def _validate_string(value: Any, field: str, *, allow_empty: bool) -> str:
    if value is None:
        if allow_empty:
            return ""
        raise DatabaseValidationError(f"{field} is required")
    if not isinstance(value, str):
        raise DatabaseValidationError(f"{field} must be a string")
    if not allow_empty and not value.strip():
        raise DatabaseValidationError(f"{field} must be a non-empty string")
    return value


def _validate_non_negative_int(value: Any, field: str) -> int:
    try:
        iv = int(value)
    except Exception:
        raise DatabaseValidationError(f"{field} must be a non-negative integer")
    if iv < 0:
        raise DatabaseValidationError(f"{field} must be a non-negative integer")
    return iv


def _validate_timestamp(value: Any) -> int:
    if value is None:
        return 0
    try:
        iv = int(value)
    except Exception:
        raise DatabaseValidationError("timestamp must be an integer")
    if iv < 0:
        raise DatabaseValidationError("timestamp must be >= 0")
    return iv


def _validate_json_data(json_data: Any) -> Dict[str, Any]:
    if json_data is None:
        raise DatabaseValidationError("json_data is required")
    if isinstance(json_data, str):
        try:
            json_data = json.loads(json_data)
        except json.JSONDecodeError as exc:
            raise DatabaseValidationError("json_data must be valid JSON") from exc
    if not isinstance(json_data, dict):
        raise DatabaseValidationError("json_data must be a dict")

    validated: Dict[str, Any] = {}

    filename = json_data.get("filename")
    if not filename:
        raise DatabaseValidationError("filename is required")
    if not isinstance(filename, str):
        raise DatabaseValidationError("filename must be a string")
    if not FILENAME_PATTERN.fullmatch(filename):
        raise DatabaseValidationError("filename must match pattern <12-hex>.pdf")
    validated["filename"] = filename

    filepath = json_data.get("filepath")
    if not filepath:
        raise DatabaseValidationError("filepath is required")
    if not isinstance(filepath, str):
        raise DatabaseValidationError("filepath must be a string")
    validated["filepath"] = filepath

    def _as_int(key: str, default: int = 0) -> int:
        v = json_data.get(key, default)
        try:
            return int(v)
        except Exception:
            return default

    # rating：若提供则需在 0..5 之间
    rating = json_data.get("rating", 0)
    try:
        rating_int = int(rating)
    except Exception:
        rating_int = 0
    if rating_int < 0 or rating_int > 5:
        raise DatabaseValidationError("rating must be between 0 and 5")
    validated["rating"] = rating_int

    # tags：必须为非空字符串列表（若提供）
    tags = json_data.get("tags", [])
    if tags is None:
        tags = []
    if not isinstance(tags, list) or any((not isinstance(t, str) or not t) for t in tags):
        raise DatabaseValidationError("tags must be a list of non-empty strings")
    validated["tags"] = tags
    validated["is_visible"] = bool(json_data.get("is_visible", True))
    validated["total_reading_time"] = _as_int("total_reading_time", 0)
    validated["last_accessed_at"] = _as_int("last_accessed_at", 0)
    validated["review_count"] = _as_int("review_count", 0)
    validated["due_date"] = _as_int("due_date", 0)
    # 直传其余允许的附加字段（如 notes/subject/keywords/thumbnail_path）
    for extra in ("notes", "subject", "keywords", "thumbnail_path"):
        if extra in json_data:
            validated[extra] = json_data[extra]
    return validated
