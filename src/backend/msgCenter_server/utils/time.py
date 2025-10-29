from datetime import datetime, timezone
import time as _time
from typing import Optional


def iso_to_ms(value: Optional[str]) -> int:
    try:
        if value is None:
            return int(_time.time() * 1000)
        try:
            return int(value)  # already integer-like
        except Exception:
            pass
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return int(_time.time() * 1000)


def ms_to_iso(ms: Optional[int]) -> str:
    try:
        if ms is None:
            ms = int(_time.time() * 1000)
        return (
            datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except Exception:
        return _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime())

