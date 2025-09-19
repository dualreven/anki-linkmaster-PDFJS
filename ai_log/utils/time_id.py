from datetime import datetime


def now_compact_ts() -> str:
    """返回 YYYYMMDDHHMMSS 紧凑时间戳。"""
    return datetime.now().strftime("%Y%m%d%H%M%S")


def now_iso() -> str:
    """返回 ISO 格式时间字符串。"""
    return datetime.now().isoformat()


