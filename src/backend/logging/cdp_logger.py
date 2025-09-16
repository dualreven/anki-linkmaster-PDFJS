# cdp_logger.py
# A dedicated logger and filter helpers for Chromium DevTools Protocol (CDP) events.
# It writes to logs/pdf-viewer.log with rotation, supports whitelist/blacklist by method,
# and provides short-window de-duplication for repetitive messages.
#
# Usage:
#   from src.backend.logging.cdp_logger import get_cdp_logger, log_cdp_event, should_log_cdp_event
#   if should_log_cdp_event(method, params):
#       log_cdp_event(method, params)
#
# Environment variables (optional):
#   LOG_CDP_WHITELIST = "Runtime.consoleAPICalled,Page.*"
#   LOG_CDP_BLACKLIST = "Console.messageAdded"
#   LOG_CDP_LEVEL     = "INFO"  (DEBUG/INFO/WARN/ERROR)
#   LOG_CDP_DEDUPE_WINDOW_MS = "1000" (default 1000ms)

import logging
from logging.handlers import TimedRotatingFileHandler
import os
import re
import time
import json
from typing import Any, Dict, Optional, Tuple

# resolve logs directory at project root
LOG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "logs"))
LOG_FILE = os.path.join(LOG_DIR, "pdf-viewer.log")

_DEFAULT_LEVEL = os.environ.get("LOG_CDP_LEVEL", "INFO").upper()
_DEDUPE_WINDOW_MS = int(os.environ.get("LOG_CDP_DEDUPE_WINDOW_MS", "1000"))  # 1s default

# parse whitelist/blacklist to patterns
def _parse_patterns(env_value: Optional[str]) -> list[re.Pattern]:
    if not env_value:
        return []
    parts = [p.strip() for p in env_value.split(",") if p.strip()]
    patterns = []
    for p in parts:
        # convert simple glob-like * to regex .*
        regex = "^" + re.escape(p).replace("\\*", ".*") + "$"
        try:
            patterns.append(re.compile(regex))
        except re.error:
            # skip invalid pattern silently
            pass
    return patterns

_WHITELIST_PATTERNS = _parse_patterns(os.environ.get("LOG_CDP_WHITELIST"))
# Always ignore Console.messageAdded by default; allow override via whitelist
_default_blacklist = "Console.messageAdded"
_blacklist_env = os.environ.get("LOG_CDP_BLACKLIST", _default_blacklist)
_BLACKLIST_PATTERNS = _parse_patterns(_blacklist_env)

_logger_singleton: Optional[logging.Logger] = None

def _ensure_log_dir():
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
    except Exception:
        pass

def get_cdp_logger(name: str = "cdp") -> logging.Logger:
    global _logger_singleton
    if _logger_singleton:
        return _logger_singleton
    _ensure_log_dir()
    logger = logging.getLogger(name)
    if getattr(logger, "_cdp_configured", False):
        _logger_singleton = logger
        return logger

    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARN": logging.WARN,
        "WARNING": logging.WARN,
        "ERROR": logging.ERROR,
    }
    logger.setLevel(level_map.get(_DEFAULT_LEVEL, logging.INFO))
    handler = TimedRotatingFileHandler(LOG_FILE, when="midnight", interval=1, backupCount=7, encoding="utf-8")
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s')
    handler.setFormatter(formatter)
    handler.suffix = "%Y-%m-%d"
    logger.addHandler(handler)
    logger.propagate = False
    logger._cdp_configured = True  # type: ignore[attr-defined]
    _logger_singleton = logger
    return logger

def _match_any(patterns: list[re.Pattern], value: str) -> bool:
    return any(p.match(value) for p in patterns)

def should_log_cdp_event(method: str, params: Optional[Dict[str, Any]] = None) -> bool:
    """
    Decide whether to log a CDP event based on whitelist/blacklist.
    Precedence: whitelist > blacklist.
    """
    # If whitelisted, allow
    if _WHITELIST_PATTERNS and _match_any(_WHITELIST_PATTERNS, method):
        return True
    # If blacklisted, block
    if _BLACKLIST_PATTERNS and _match_any(_BLACKLIST_PATTERNS, method):
        return False
    # Default allow
    return True

# in-memory de-dup cache: (key) -> last_ts_ms
# key built from method + compacted message signature
_dedupe_cache: Dict[str, int] = {}

def _now_ms() -> int:
    return int(time.time() * 1000)

def _compact_signature(method: str, params: Optional[Dict[str, Any]]) -> str:
    """
    Build a compact signature string for dedupe: method + a reduced text of params.
    Prefer args text content for Runtime.consoleAPICalled; fall back to json-dumped params keys.
    """
    if not params:
        return method
    try:
        if method == "Runtime.consoleAPICalled":
            args = params.get("args", [])
            parts = []
            for a in args:
                # a is usually like {'type': 'string', 'value': '...'}
                v = a.get("value") if isinstance(a, dict) else None
                if isinstance(v, str):
                    # reduce whitespace and limit length
                    txt = " ".join(v.split())
                    parts.append(txt[:200])
                else:
                    parts.append(str(v)[:100])
            sig = method + "|" + "|".join(parts)
            return sig
        # General fallback: stable json without whitespace, only first-level keys to limit size
        keys = sorted(list(params.keys()))
        sig = method + "|" + ",".join(keys)
        return sig
    except Exception:
        return method

def dedupe_filter(method: str, params: Optional[Dict[str, Any]]) -> bool:
    """
    Return True if event should be logged (not a duplicate within window), False otherwise.
    """
    key = _compact_signature(method, params)
    now = _now_ms()
    last = _dedupe_cache.get(key)
    if last is not None and (now - last) < _DEDUPE_WINDOW_MS:
        # duplicate within window
        return False
    _dedupe_cache[key] = now
    return True

def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return str(obj)

def log_cdp_event(method: str, params: Optional[Dict[str, Any]] = None, level: str = "INFO"):
    """
    Log CDP event after passing whitelist/blacklist and dedupe checks.
    Will default-ignore Console.messageAdded unless whitelisted.
    """
    if not should_log_cdp_event(method, params):
        return
    if not dedupe_filter(method, params):
        return

    logger = get_cdp_logger()
    message = f"{method} - { _safe_json(params) if params is not None else '{}' }"

    level = level.upper()
    if level == "DEBUG":
        logger.debug(message)
    elif level in ("WARN", "WARNING"):
        logger.warning(message)
    elif level == "ERROR":
        logger.error(message)
    else:
        logger.info(message)

# Helper for external raw CDP payloads of form {"method": "...", "params": {...}}
def log_cdp_payload(payload: Dict[str, Any]):
    method = payload.get("method", "")
    params = payload.get("params", {})
    log_cdp_event(method, params)