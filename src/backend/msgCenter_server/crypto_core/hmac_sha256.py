# -*- coding: utf-8 -*-
"""
HMAC-SHA256 核心（纯函数）
"""
from __future__ import annotations

import os
import base64
import hashlib
import hmac as _hmac
from typing import Optional

KEY_SIZE = 32


def generate_key() -> bytes:
    return os.urandom(KEY_SIZE)


def compute_hmac(data: bytes, key: bytes) -> bytes:
    return _hmac.new(key, data, hashlib.sha256).digest()


def compute_hmac_base64(data: bytes, key: bytes) -> str:
    return base64.b64encode(compute_hmac(data, key)).decode("utf-8")


def verify_hmac(data: bytes, expected: bytes, key: bytes) -> bool:
    actual = compute_hmac(data, key)
    return _hmac.compare_digest(actual, expected)


def verify_hmac_base64(data: bytes, expected_b64: str, key: bytes) -> bool:
    try:
        expected = base64.b64decode(expected_b64)
    except Exception:
        return False
    return verify_hmac(data, expected, key)

