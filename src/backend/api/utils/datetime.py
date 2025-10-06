from __future__ import annotations

from datetime import datetime
from typing import Optional


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


def iso_to_ms(value: Optional[str]) -> int:
    if not value:
        return 0
    try:
        iso_value = value.replace('Z', '+00:00')
        dt = datetime.fromisoformat(iso_value)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return 0


def ms_to_iso(value: Optional[int]) -> str:
    if not value:
        return datetime.utcfromtimestamp(0).isoformat() + 'Z'
    try:
        seconds = value / 1000 if value >= 10 ** 12 else value
        return datetime.utcfromtimestamp(seconds).isoformat() + 'Z'
    except (OverflowError, OSError):
        return datetime.utcfromtimestamp(0).isoformat() + 'Z'

