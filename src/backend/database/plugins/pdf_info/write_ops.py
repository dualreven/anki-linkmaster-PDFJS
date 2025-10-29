from __future__ import annotations

import json
import time
from typing import Any, Dict

from .validate import validate_data
from ...exceptions import DatabaseValidationError


def insert(plugin, data: Dict[str, Any]) -> str:
    validated = validate_data(plugin, data)
    sql = """
    INSERT INTO pdf_info (
        uuid, title, author, page_count, file_size,
        created_at, updated_at, visited_at, version, json_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        validated["uuid"],
        validated["title"],
        validated["author"],
        validated["page_count"],
        validated["file_size"],
        validated["created_at"],
        validated["updated_at"],
        validated["visited_at"],
        validated["version"],
        json.dumps(validated["json_data"], ensure_ascii=False),
    )
    rows = plugin._executor.execute_update(sql, params)
    if rows > 0:
        plugin._emit_event("create", "completed", {"uuid": validated["uuid"]})
        if plugin._logger:
            plugin._logger.info(f"Inserted PDFInfo: {validated['uuid']}")
    return validated["uuid"]


def update(plugin, primary_key: str, data: Dict[str, Any]) -> bool:
    existing = plugin.query_by_id(primary_key)
    if not existing:
        return False
    merged = {
        "uuid": existing["uuid"],
        "title": existing.get("title", ""),
        "author": existing.get("author", ""),
        "page_count": existing.get("page_count", 0),
        "file_size": existing.get("file_size", 0),
        "created_at": existing.get("created_at"),
        "updated_at": int(time.time() * 1000),
        "visited_at": existing.get("visited_at", 0),
        "version": existing.get("version", 1),
        "json_data": existing.get("json_data", {}).copy(),
    }
    for field in [
        "title",
        "author",
        "page_count",
        "file_size",
        "visited_at",
        "created_at",
        "updated_at",
        "version",
    ]:
        if field in data and field != "uuid":
            merged[field] = data[field]
    if "json_data" in data and isinstance(data["json_data"], dict):
        merged["json_data"].update(data["json_data"])
    validated = validate_data(plugin, merged)
    sql = """
    UPDATE pdf_info
    SET
        title = ?,
        author = ?,
        page_count = ?,
        file_size = ?,
        created_at = ?,
        updated_at = ?,
        visited_at = ?,
        version = ?,
        json_data = ?
    WHERE uuid = ?
    """
    params = (
        validated["title"],
        validated["author"],
        validated["page_count"],
        validated["file_size"],
        validated["created_at"],
        validated["updated_at"],
        validated["visited_at"],
        validated["version"],
        json.dumps(validated["json_data"], ensure_ascii=False),
        primary_key,
    )
    rows = plugin._executor.execute_update(sql, params)
    if rows > 0:
        plugin._emit_event("update", "completed", {"uuid": primary_key})
        if plugin._logger:
            plugin._logger.info(f"Updated PDFInfo: {primary_key}")
    return rows > 0


def delete(plugin, primary_key: str) -> bool:
    sql = "DELETE FROM pdf_info WHERE uuid = ?"
    rows = plugin._executor.execute_update(sql, (primary_key,))
    if rows > 0:
        plugin._emit_event("delete", "completed", {"uuid": primary_key})
        if plugin._logger:
            plugin._logger.info(f"Deleted PDFInfo: {primary_key}")
    return rows > 0


def update_reading_stats(plugin, uuid: str, reading_time_delta: int) -> bool:
    pdf = plugin.query_by_id(uuid)
    if not pdf:
        return False
    current_time = int(time.time() * 1000)
    total_reading_time = pdf.get("total_reading_time", 0) + reading_time_delta
    review_count = pdf.get("review_count", 0) + 1
    sql = """
    UPDATE pdf_info
    SET
        visited_at = ?,
        json_data = json_set(
            json_data,
            '$.last_accessed_at', ?,
            '$.total_reading_time', ?,
            '$.review_count', ?
        ),
        updated_at = ?,
        version = version + 1
    WHERE uuid = ?
    """
    params = (current_time, current_time, total_reading_time, review_count, current_time, uuid)
    rows = plugin._executor.execute_update(sql, params)
    if rows > 0:
        plugin._emit_event("update", "completed", {"uuid": uuid})
        if plugin._logger:
            plugin._logger.info(f"Updated reading stats for {uuid}")
    return rows > 0


def add_tag(plugin, uuid: str, tag: str) -> bool:
    if not tag or not isinstance(tag, str):
        raise DatabaseValidationError("tag must be a non-empty string")
    pdf = plugin.query_by_id(uuid)
    if not pdf:
        return False
    tags = pdf.get("tags", [])
    if tag in tags:
        return False
    tags.append(tag)
    sql = """
    UPDATE pdf_info
    SET
        json_data = json_set(json_data, '$.tags', json(?)),
        updated_at = ?,
        version = version + 1
    WHERE uuid = ?
    """
    current_time = int(time.time() * 1000)
    params = (json.dumps(tags, ensure_ascii=False), current_time, uuid)
    rows = plugin._executor.execute_update(sql, params)
    if rows > 0:
        plugin._emit_event("update", "completed", {"uuid": uuid})
        if plugin._logger:
            plugin._logger.info(f"Added tag '{tag}' to {uuid}")
    return rows > 0


def remove_tag(plugin, uuid: str, tag: str) -> bool:
    pdf = plugin.query_by_id(uuid)
    if not pdf:
        return False
    tags = pdf.get("tags", [])
    if tag not in tags:
        return False
    tags = [item for item in tags if item != tag]
    sql = """
    UPDATE pdf_info
    SET
        json_data = json_set(json_data, '$.tags', json(?)),
        updated_at = ?,
        version = version + 1
    WHERE uuid = ?
    """
    current_time = int(time.time() * 1000)
    params = (json.dumps(tags, ensure_ascii=False), current_time, uuid)
    rows = plugin._executor.execute_update(sql, params)
    if rows > 0:
        plugin._emit_event("update", "completed", {"uuid": uuid})
        if plugin._logger:
            plugin._logger.info(f"Removed tag '{tag}' from {uuid}")
    return rows > 0

