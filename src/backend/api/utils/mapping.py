from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from .datetime import ensure_seconds
from .tags import normalize_tags


def map_row_to_frontend(row: Dict[str, Any]) -> Dict[str, Any]:
    json_data = deepcopy(row.get("json_data", {}))
    created_at = row.get("created_at", 0)
    last_accessed = json_data.get("last_accessed_at", row.get("visited_at", 0))
    due_date = json_data.get("due_date", 0)

    record = {
        "id": row["uuid"],
        "title": row.get("title", ""),
        "author": row.get("author", ""),
        "filename": json_data.get("filename", ""),
        "file_path": json_data.get("filepath", ""),
        "file_size": row.get("file_size", 0),
        "page_count": row.get("page_count", 0),
        "created_at": ensure_seconds(created_at),
        "updated_at": ensure_seconds(row.get("updated_at", created_at)),
        "last_accessed_at": ensure_seconds(last_accessed),
        "review_count": json_data.get("review_count", 0),
        "rating": json_data.get("rating", 0),
        "tags": normalize_tags(json_data.get("tags")),
        "is_visible": bool(json_data.get("is_visible", True)),
        "total_reading_time": json_data.get("total_reading_time", 0),
        "due_date": ensure_seconds(due_date),
        "notes": json_data.get("notes", ""),
        "subject": json_data.get("subject", ""),
        "keywords": json_data.get("keywords", ""),
    }
    return record

