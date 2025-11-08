# -*- coding: utf-8 -*-
import pytest
from pathlib import Path

from src.backend.pdfFile_server.server_core import stream_sender as ss
from src.backend.pdfFile_server.__tests__.test_stream_sender import FakeSocket  # 复用桩


class FakeQFileFailOpen:
    def __init__(self, *_args, **_kwargs):
        self._closed = True

    def open(self, *_args, **_kwargs):
        return False

    def errorString(self):
        return "open failed"

    def atEnd(self):
        return True

    def read(self, *_args, **_kwargs):
        return b""

    def close(self):
        self._closed = True


def test_stream_send_file_open_fail_raises(monkeypatch, tmp_path: Path):
    # 准备存在的文件以通过 stat() 与 header 写入
    f = tmp_path / "file.bin"
    f.write_bytes(b"abcdefg")
    sock = FakeSocket()
    # 让 QFile 打开失败
    monkeypatch.setattr(ss, "QFile", FakeQFileFailOpen)
    with pytest.raises(RuntimeError):
        ss.stream_send_file(sock, f, chunk_size=1024, max_buffer_size=1024, enable_process_events=False)

