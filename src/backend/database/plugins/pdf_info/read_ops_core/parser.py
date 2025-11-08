# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict
import json


def parse_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    将一行 DB 记录解析为统一结构：
    - 尝试解析 json_data 字段（严格 UTF-8 文本）
    - 扁平合并到顶层（后者覆盖同名键）
    """
    try:
        json_data = json.loads(row.get("json_data", "{}"))
    except json.JSONDecodeError:
        json_data = {}
    parsed = {
        "uuid": row["uuid"],
        "title": row["title"],
        "author": row["author"],
        "page_count": row["page_count"],
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "visited_at": row["visited_at"],
        "version": row["version"],
        "json_data": json_data,
    }
    parsed.update(json_data)
    return parsed

