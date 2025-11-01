#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: viewer URL builder should append outline-item-id when provided via extra_params
"""
from __future__ import annotations

import sys
from pathlib import Path
import importlib.util as _il

ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.frontend.common.launch_config import LaunchConfig  # noqa


def main():
    launcher_path = ROOT / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    spec = _il.spec_from_file_location("pdf_viewer_launcher_smoke_outline", str(launcher_path))
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
        extra_params={"outline_item_id": "outlineItem-XYZ"}
    )
    app = PdfViewerApp(cfg, parent_app=None)
    url = app._build_frontend_url(vite_port=5173, msgCenter_port=8765, pdfFile_port=8080)
    assert "pdf-id=c83c60c58ad2" in url, f"missing pdf-id in url: {url}"
    assert "outline-item-id=outlineItem-XYZ" in url, f"missing outline-item-id in url: {url}"
    print("OK url-builder outline-item-id present")


if __name__ == "__main__":
    main()

