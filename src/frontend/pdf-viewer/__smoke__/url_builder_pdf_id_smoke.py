#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: viewer URL builder must always include pdf-id (for Outline/Bookmark recognition)
- Build URL in prod mode with standard ports
- Assert &file=/pdfs/<id>.pdf and &pdf-id=<id> both present
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.frontend.common.launch_config import LaunchConfig  # noqa
import importlib.util as _il
from pathlib import Path as _P

def main():
    # import PdfViewerApp by absolute path to avoid module-name with hyphen
    launcher_path = ROOT / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    spec = _il.spec_from_file_location("pdf_viewer_launcher_smoke", str(launcher_path))
    assert spec and spec.loader, "Failed to load pdf-viewer/launcher.py"
    mod = _il.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    PdfViewerApp = getattr(mod, "PdfViewerApp")

    cfg = LaunchConfig(
        is_prod=True,
        msgCenter_port=8765,
        pdfFile_port=8080,
        logs_dir=str(ROOT / "dist" / "latest" / "logs"),
        pdf_id="c83c60c58ad2",
        page_at=None,
        position=None,
        anchor_id=None,
        annotation_id=None,
    )
    app = PdfViewerApp(cfg, parent_app=None)
    url = app._build_frontend_url(vite_port=5173, msgCenter_port=8765, pdfFile_port=8080)
    assert "file=/pdfs/c83c60c58ad2.pdf" in url, f"missing file param in url: {url}"
    assert "pdf-id=c83c60c58ad2" in url, f"missing pdf-id in url: {url}"
    print("OK url-builder pdf-id present")

if __name__ == "__main__":
    main()
