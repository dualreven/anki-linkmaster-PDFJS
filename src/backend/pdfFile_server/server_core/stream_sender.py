# -*- coding: utf-8 -*-
"""
文件流式传输核心（依赖 PyQt QTcpSocket/QFile）
将具体发送逻辑与 EmbedFileServer 解耦，便于入口类瘦身与复用。
"""
from __future__ import annotations

import time
import logging
from pathlib import Path
from typing import Optional

from PyQt6.QtCore import QFile, QIODevice, QCoreApplication
from PyQt6.QtNetwork import QTcpSocket

from src.backend.pdfFile_server.utils.http_utils import build_http_ok_headers, guess_mime_type

logger = logging.getLogger(__name__)


def stream_send_file(
    socket: QTcpSocket,
    file_path: Path,
    *,
    chunk_size: int = 64 * 1024,
    max_buffer_size: int = 64 * 1024 * 4,
    enable_process_events: bool = True,
) -> None:
    """
    以流式方式发送文件至 QTcpSocket。
    - 先写入 200 OK 头（含 Content-Length/Type/CORS/Cache-Control）
    - 使用 Qt QFile 分块读取，避免大文件占用内存
    - 按缓冲区大小做流控，必要时调用 processEvents
    """
    qfile: Optional[QFile] = None
    try:
        file_size = file_path.stat().st_size
        mime_type = guess_mime_type(file_path)

        # 发送响应头
        header = build_http_ok_headers(file_size, mime_type, cors=True, cache_control="max-age=3600")
        socket.write(header)

        # 打开文件
        qfile = QFile(str(file_path))
        if not qfile.open(QIODevice.OpenModeFlag.ReadOnly):
            raise RuntimeError(f"无法打开文件: {qfile.errorString()}")

        bytes_sent = 0
        chunk_count = 0
        logger.debug("📤 开始流式传输: %s (%d bytes, %s)", file_path.name, file_size, mime_type)

        while not qfile.atEnd():
            chunk = qfile.read(chunk_size)
            if not chunk or len(chunk) == 0:
                break
            socket.write(chunk)
            bytes_sent += len(chunk)
            chunk_count += 1

            # 流控
            if socket.bytesToWrite() > max_buffer_size:
                start = time.perf_counter()
                while socket.bytesToWrite() > max_buffer_size:
                    socket.waitForBytesWritten(50)
                    if enable_process_events:
                        try:
                            QCoreApplication.processEvents()
                        except Exception:
                            pass
                    if time.perf_counter() - start > 30.0:
                        logger.warning(
                            "⚠️ Socket 写入阻塞超过30秒，缓冲区仍有 %d bytes 待写，已发送 %d/%d bytes",
                            socket.bytesToWrite(), bytes_sent, file_size
                        )
                        break

        # 尽量刷新缓冲
        socket.flush()
        start_flush = time.perf_counter()
        while socket.bytesToWrite() > 0 and (time.perf_counter() - start_flush) <= 30.0:
            socket.waitForBytesWritten(50)
            if enable_process_events:
                try:
                    QCoreApplication.processEvents()
                except Exception:
                    pass

        if bytes_sent == file_size:
            logger.debug("✅ 流式传输完成: %s (%d bytes, %d chunks, %s)", file_path.name, bytes_sent, chunk_count, mime_type)
        else:
            logger.warning("⚠️ 传输不完整: %s (%d/%d bytes, %d chunks)", file_path.name, bytes_sent, file_size, chunk_count)

    finally:
        if qfile is not None:
            qfile.close()

