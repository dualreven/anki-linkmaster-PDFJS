# -*- coding: utf-8 -*-
"""
HTTP 工具函数：
- MIME 类型判断（修正常见前端类型在 Windows 下的缺省问题）
- HTTP 响应头/错误响应 构造（纯函数，便于测试）
"""
from __future__ import annotations

from pathlib import Path
import mimetypes


def guess_mime_type(file_path: Path | str) -> str:
    """
    模块级 MIME 猜测（供服务端与测试复用）。
    显式修正常见前端类型在部分平台下的错误 MIME（如 Windows 下 .js 未注册）。
    """
    p = str(file_path).lower()
    if p.endswith('.mjs') or p.endswith('.js'):
        return 'text/javascript'
    if p.endswith('.css'):
        return 'text/css'
    if p.endswith('.json') or p.endswith('.map'):
        return 'application/json'
    if p.endswith('.pdf'):
        return 'application/pdf'
    try:
        mime_type, _ = mimetypes.guess_type(str(file_path))
    except Exception:
        mime_type = None
    return mime_type or 'application/octet-stream'


def build_http_ok_headers(
    file_size: int,
    mime_type: str,
    *,
    cors: bool = True,
    cache_control: str = "max-age=3600",
) -> bytes:
    """
    构造 200 OK 的响应头（不含空行后的主体），返回 bytes。
    - 保留 Content-Length 以便前端进度显示
    - 可选 CORS 与 Cache-Control
    """
    headers = [
        "HTTP/1.1 200 OK",
        f"Content-Length: {file_size}",
        f"Content-Type: {mime_type}",
    ]
    if cors:
        headers.append("Access-Control-Allow-Origin: *")
    if cache_control:
        headers.append(f"Cache-Control: {cache_control}")
    headers.append("Connection: close")
    headers.append("")  # 头部结束
    return ("\r\n".join(headers).encode("utf-8") + b"\r\n")


def build_http_error_response(code: int, status: str, message: str) -> bytes:
    """
    构造完整的错误响应（含头与 HTML body），返回 bytes。
    """
    body = f"<h1>{code} {status}</h1><p>{message}</p>"
    headers = [
        f"HTTP/1.1 {code} {status}",
        "Content-Type: text/html; charset=utf-8",
        f"Content-Length: {len(body)}",
        "Connection: close",
        "",
        body,
    ]
    return "\r\n".join(headers).encode("utf-8")

