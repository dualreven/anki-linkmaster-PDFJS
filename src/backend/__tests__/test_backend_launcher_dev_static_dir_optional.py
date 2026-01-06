# -*- coding: utf-8 -*-
from __future__ import annotations

from pathlib import Path


def test_backend_launcher_dev_allows_missing_static_dir(tmp_path, monkeypatch):
    # 延迟导入并确保项目根可导入
    import sys

    project_root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(project_root))

    from src.backend.launcher import BackendLauncher

    logs_dir = tmp_path / "logs"
    data_dir = tmp_path / "data"
    pdfs_dir = tmp_path / "pdfs"
    for d in (logs_dir, data_dir, pdfs_dir):
        d.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "app.db"
    db_path.write_text("", encoding="utf-8", newline="\n")

    class _FakeWsSignal:
        def connect(self, *_a, **_k):
            return None

    class _FakeWsInner:
        message_received = _FakeWsSignal()

    class _FakeMsgCenter:
        def __init__(self, host, port, parent, db_path, data_dir):
            self.host = host
            self.port = int(port)
            self._server = _FakeWsInner()

        def start(self):
            return True

        def stop(self):
            return None

        def is_running(self):
            return True

        def get_client_count(self):
            return 0

    called = {}

    class _FakeHttp:
        def __init__(self, *, root_dir, host, port, parent, pdfs_dir, static_dir, mounts, logs_dir, require_static):
            called["static_dir"] = static_dir
            called["require_static"] = bool(require_static)
            called["mounts"] = dict(mounts or {})
            self.host = host
            self.port = int(port)

        def start(self):
            return True

        def stop(self):
            return None

        def is_running(self):
            return True

    import src.backend.msgCenter_server.embed_msgcenter as _mm
    import src.backend.pdfFile_server.embed_fileserver as _hf

    monkeypatch.setattr(_mm, "EmbedMsgCenterServer", _FakeMsgCenter, raising=True)
    monkeypatch.setattr(_hf, "EmbedFileServer", _FakeHttp, raising=True)

    launcher = BackendLauncher(
        parent_app=object(),
        logs_dir=str(logs_dir),
        data_dir=str(data_dir),
        pdfs_dir=str(pdfs_dir),
        db_path=str(db_path),
        static_dir=None,
    )

    ok = launcher.start(
        msgCenter_port=18765,
        pdfFile_port=18080,
        url_port=5173,  # dev：url_port != pdfFile_port
    )

    assert ok is True
    assert called.get("require_static") is False
    assert called.get("static_dir") is None
    assert called.get("mounts") == {}


def test_backend_launcher_prod_requires_static_dir(tmp_path):
    import sys

    project_root = Path(__file__).resolve().parents[3]
    sys.path.insert(0, str(project_root))

    from src.backend.launcher import BackendLauncher

    logs_dir = tmp_path / "logs"
    data_dir = tmp_path / "data"
    pdfs_dir = tmp_path / "pdfs"
    for d in (logs_dir, data_dir, pdfs_dir):
        d.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "app.db"
    db_path.write_text("", encoding="utf-8", newline="\n")

    launcher = BackendLauncher(
        parent_app=object(),
        logs_dir=str(logs_dir),
        data_dir=str(data_dir),
        pdfs_dir=str(pdfs_dir),
        db_path=str(db_path),
        static_dir=None,
    )

    ok = launcher.start(
        msgCenter_port=18766,
        pdfFile_port=18081,
        url_port=18081,  # prod：url_port == pdfFile_port
    )
    assert ok is False

