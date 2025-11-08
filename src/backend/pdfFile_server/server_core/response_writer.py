# -*- coding: utf-8 -*-
"""
HTTP 响应写入封装（依赖 QTcpSocket）
- 统一错误响应写入
"""
from __future__ import annotations

from PyQt6.QtNetwork import QTcpSocket

from src.backend.pdfFile_server.utils.http_utils import build_http_error_response


def send_error(socket: QTcpSocket, code: int, status: str, message: str) -> None:
    """
    写入标准 HTTP 错误响应并刷新。
    """
    socket.write(build_http_error_response(code, status, message))
    socket.flush()

