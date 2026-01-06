# -*- coding: utf-8 -*-
import os
from pathlib import Path

import pytest

from src.backend.pdfFile_server.utils.http_utils import (
    guess_mime_type,
    build_http_ok_headers,
    build_http_error_response,
)
from src.backend.pdfFile_server.utils.path_resolver import resolve_path


def test_guess_mime_type_common():
    assert guess_mime_type("a.js") == "text/javascript"
    assert guess_mime_type("a.mjs") == "text/javascript"
    assert guess_mime_type("a.css") == "text/css"
    assert guess_mime_type("a.json") == "application/json"
    assert guess_mime_type("a.map") == "application/json"
    assert guess_mime_type("a.pdf") == "application/pdf"
    # default
    assert guess_mime_type("a.unknownext") == "application/octet-stream"


def test_build_http_ok_headers_and_error_response_bytes():
    ok = build_http_ok_headers(1234, "text/plain")
    text = ok.decode("utf-8")
    assert text.startswith("HTTP/1.1 200 OK")
    assert "Content-Length: 1234" in text
    assert "Content-Type: text/plain" in text
    assert "Access-Control-Allow-Origin: *" in text
    # 结束有空行
    assert text.rstrip().endswith("Connection: close")

    err = build_http_error_response(404, "Not Found", "xx")
    etext = err.decode("utf-8")
    assert etext.startswith("HTTP/1.1 404 Not Found")
    assert "Content-Type: text/html; charset=utf-8" in etext
    assert "<h1>404 Not Found</h1><p>xx</p>" in etext


def test_resolve_path_basic_and_traversal(tmp_path: Path):
    # 建立目录结构
    static_root = tmp_path / "static"
    pdfs_root = tmp_path / "pdfs"
    root_dir = tmp_path / "root"
    (static_root / "pdf-home").mkdir(parents=True, exist_ok=True)
    (static_root / "pdf-home" / "index.html").write_text("<html>home</html>\n", encoding="utf-8", newline="\n")
    (static_root / "pdf-viewer").mkdir(parents=True, exist_ok=True)
    (static_root / "pdf-viewer" / "main.js").write_text("console.log(1);\n", encoding="utf-8", newline="\n")
    (static_root / "app.js").write_text("console.log('app');\n", encoding="utf-8", newline="\n")
    pdfs_root.mkdir(parents=True, exist_ok=True)
    (pdfs_root / "a.pdf").write_text("%PDF-1.7\n", encoding="utf-8", newline="\n")
    root_dir.mkdir(parents=True, exist_ok=True)
    (root_dir / "foo.txt").write_text("hi\n", encoding="utf-8", newline="\n")

    pr = tmp_path  # project_root 仅作占位

    # /pdf-home → index.html
    p = resolve_path("/pdf-home/", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr)
    assert p == (static_root / "pdf-home" / "index.html")

    # /pdf-viewer/main.js
    p = resolve_path("/pdf-viewer/main.js", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr)
    assert p == (static_root / "pdf-viewer" / "main.js")

    # /static/app.js
    p = resolve_path("/static/app.js", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr)
    assert p == (static_root / "app.js")

    # /pdfs/a.pdf
    p = resolve_path("/pdfs/a.pdf", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr)
    assert p == (pdfs_root / "a.pdf")

    # 默认 root_dir
    p = resolve_path("/foo.txt", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr)
    assert p == (root_dir / "foo.txt")

    # 路径穿越阻断
    assert resolve_path("/pdfs/../../etc/passwd", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None
    assert resolve_path("/static/../../a.js", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None
    assert resolve_path("/../../evil", static_root=static_root, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None


def test_resolve_path_without_static_root_blocks_static_routes(tmp_path: Path):
    pdfs_root = tmp_path / "pdfs"
    root_dir = tmp_path / "root"
    pdfs_root.mkdir(parents=True, exist_ok=True)
    root_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_root / "a.pdf").write_text("%PDF-1.7\n", encoding="utf-8", newline="\n")

    pr = tmp_path

    assert resolve_path("/pdfs/a.pdf", static_root=None, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) == (pdfs_root / "a.pdf")
    assert resolve_path("/static/app.js", static_root=None, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None
    assert resolve_path("/pdf-home/", static_root=None, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None
    assert resolve_path("/pdf-viewer/main.js", static_root=None, pdfs_root=pdfs_root, root_dir=root_dir, mounts=None, project_root=pr) is None
