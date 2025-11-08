# -*- coding: utf-8 -*-
import os
from pathlib import Path

from src.backend.pdfFile_server.server_core.stream_sender import stream_send_file


class FakeSocket:
    """
    伪 QTcpSocket：
    - write(): 追加到缓冲并累计 bytesToWrite
    - waitForBytesWritten(): 模拟按比例“写出”一些字节
    - flush(): 清空缓冲
    """
    def __init__(self, drain_per_wait: int = 1024):
        self._buffer = bytearray()
        self._pending = 0
        self._drain = int(drain_per_wait)
        self.wait_calls = 0

    def write(self, data: bytes):
        if isinstance(data, (bytes, bytearray)):
            self._buffer.extend(data)
            self._pending += len(data)
        else:
            raise TypeError("write() expects bytes-like object")

    def bytesToWrite(self) -> int:
        return int(self._pending)

    def waitForBytesWritten(self, _timeout_ms: int) -> bool:
        self.wait_calls += 1
        # 模拟网络写出
        if self._pending > 0:
            drained = min(self._pending, self._drain)
            self._pending -= drained
        return True

    def flush(self):
        # 刷新后缓冲仍在 _buffer，但“待写”置 0
        self._pending = 0

    # 兼容 PyQt 接口
    def __getattr__(self, item):
        # 兼容被调用但未实现的非关键方法
        raise AttributeError(item)

    # 测试辅助
    @property
    def data(self) -> bytes:
        return bytes(self._buffer)


def _split_header_and_body(payload: bytes) -> tuple[str, bytes]:
    parts = payload.split(b"\r\n\r\n", 1)
    header = parts[0].decode("utf-8", errors="strict")
    body = parts[1] if len(parts) > 1 else b""
    return header, body


def test_stream_send_file_small_pdf_no_flow_control(tmp_path: Path):
    # 构造小文件
    pdf = tmp_path / "sample.pdf"
    pdf.write_bytes(b"%PDF-1.4\nHello\n")
    size = pdf.stat().st_size

    sock = FakeSocket()
    stream_send_file(
        sock,
        pdf,
        chunk_size=64 * 1024,
        max_buffer_size=10_000_000,  # 足够大，避免触发流控
        enable_process_events=False,
    )
    header, body = _split_header_and_body(sock.data)
    assert "HTTP/1.1 200 OK" in header
    assert f"Content-Length: {size}" in header
    # pdf 扩展名 → application/pdf
    assert "Content-Type: application/pdf" in header
    assert body == pdf.read_bytes()


def test_stream_send_file_flow_control(tmp_path: Path):
    # 构造稍大文件（> 32KB）
    data = os.urandom(96 * 1024)
    f = tmp_path / "blob.bin"
    f.write_bytes(data)

    sock = FakeSocket(drain_per_wait=256)  # 小写出速率，促使触发 waitForBytesWritten
    stream_send_file(
        sock,
        f,
        chunk_size=2048,
        max_buffer_size=1024,  # 很小，确保触发流控
        enable_process_events=False,
    )
    header, body = _split_header_and_body(sock.data)
    assert "HTTP/1.1 200 OK" in header
    assert f"Content-Length: {f.stat().st_size}" in header
    # 未知扩展名 → application/octet-stream
    assert "Content-Type: application/octet-stream" in header
    assert body == data
    # 触发过流控
    assert sock.wait_calls >= 1

