from __future__ import annotations

from typing import Any, List


def normalize_tags(tags: Any) -> List[str]:
    if tags is None:
        return []
    if isinstance(tags, list):
        return [str(tag) for tag in tags]
    if isinstance(tags, str):
        return [item.strip() for item in tags.split(",") if item.strip()]
    try:
        return [str(tag) for tag in list(tags)]
    except Exception:
        return [str(tags)]

