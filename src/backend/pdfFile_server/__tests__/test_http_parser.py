# -*- coding: utf-8 -*-
import pytest

from src.backend.pdfFile_server.server_core.http_parser import (
    decode_request_bytes,
    parse_request_line,
    parse_method_and_path_from_bytes,
)


def test_decode_request_bytes_utf8_ok():
    raw = b"GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n"
    text = decode_request_bytes(raw)
    assert text.startswith("GET /hello")


def test_decode_request_bytes_invalid_utf8_raises():
    with pytest.raises(UnicodeDecodeError):
        decode_request_bytes(b"\xff\xfe\xfd")


def test_parse_request_line_ok_with_version():
    m, p, v = parse_request_line("GET /a/b HTTP/1.1")
    assert (m, p, v) == ("GET", "/a/b", "HTTP/1.1")


def test_parse_request_line_ok_without_version():
    m, p, v = parse_request_line("GET /only")
    assert (m, p) == ("GET", "/only")


def test_parse_request_line_invalid_raises():
    with pytest.raises(ValueError):
        parse_request_line("")
    with pytest.raises(ValueError):
        parse_request_line("BROKEN")


def test_parse_method_and_path_from_bytes_ok():
    raw = b"GET /x HTTP/1.0\r\nHost: x\r\n\r\n"
    m, p = parse_method_and_path_from_bytes(raw)
    assert (m, p) == ("GET", "/x")

