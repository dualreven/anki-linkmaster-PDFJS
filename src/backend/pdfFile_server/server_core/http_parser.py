# -*- coding: utf-8 -*-
"""
HTTP 请求解析（纯函数）
- 解码原始字节为 UTF-8 文本（严格，禁止兜底）
- 解析请求行，返回 (method, path, version)
"""
from __future__ import annotations

from typing import Tuple


def decode_request_bytes(data: bytes) -> str:
    """
    将原始请求字节按 UTF-8 严格解码为文本。
    失败时抛出 UnicodeDecodeError。
    """
    # 禁止宽松解码，保持 Fail-Fast
    return data.decode("utf-8")


def parse_request_line(line: str) -> Tuple[str, str, str]:
    """
    解析 HTTP 请求行
    Args:
        line: 形如 "GET /path HTTP/1.1"
    Returns:
        (method, path, version)
    Raises:
        ValueError: 格式非法或字段缺失
    """
    if not line or "\r" in line or "\n" in line:
        raise ValueError("Invalid request line")
    parts = line.split(" ")
    if len(parts) < 2:
        raise ValueError("Invalid request line")
    method = parts[0].strip()
    path = parts[1].strip()
    version = parts[2].strip() if len(parts) >= 3 else ""
    if not method or not path:
        raise ValueError("Invalid request line")
    return method, path, version


def parse_method_and_path_from_bytes(data: bytes) -> Tuple[str, str]:
    """
    从原始请求字节直接解析 (method, path)。
    仅解析首行；遇到非法数据抛出相应异常。
    """
    text = decode_request_bytes(data)
    # 请求以 CRLF 分隔
    first_line = (text.split("\r\n", 1)[0]) if text else ""
    method, path, _ = parse_request_line(first_line)
    return method, path

