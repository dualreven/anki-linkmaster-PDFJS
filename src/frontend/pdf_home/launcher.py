#!/usr/bin/env python3
"""
PDF-Home Standalone Launcher

Runs the pdf-home window on its own, without going through ai-launcher.
Assumes base services (Vite dev server and Standard WebSocket server) are
already running. The launcher auto-resolves ports from logs/runtime-ports.json
and logs/npm-dev.log where possible.

Usage:
  python src/frontend/pdf-home/launcher.py
"""

from __future__ import annotations

import os
import json
import sys
import logging
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from src.backend.qt.compat import QApplication, QUrl, QWebChannel, QWebSocket
from src.frontend.common.pyqtui.main_window import MainWindow
from src.frontend.pdf_home.pdf_home_bridge import PdfHomeBridge
# Simplified get_vite_port function for standalone launcher


logger = logging.getLogger("pdf-home.launcher")


def get_vite_port():
    """Get Vite port from npm-dev-vite.log file or return default.
    Reads the actual running Vite port from log file.
    """
    import re

    # Try to read from npm-dev-vite.log first
    log_file_path = Path(__file__).parent.parent.parent.parent / 'logs' / 'npm-dev-vite.log'

    try:
        if log_file_path.exists():
            with open(log_file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Look for "Local: http://localhost:PORT/" pattern
            match = re.search(r'Local:\s+http://localhost:(\d+)/', content)
            if match:
                port = int(match.group(1))
                logger.info("Found Vite port %d from npm-dev-vite.log", port)
                return port

            # Fallback: look for runtime-ports.json
            ports_file = Path(__file__).parent.parent.parent.parent / 'logs' / 'runtime-ports.json'
            if ports_file.exists():
                import json
                with open(ports_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                port = data.get('npm_port', 3000)
                logger.info("Found Vite port %d from runtime-ports.json", port)
                return port
    except Exception as e:
        logger.warning("Failed to read Vite port from logs: %s", e)

    # Final fallback
    logger.info("Using default Vite port 3000")
    return 3000


def _read_runtime_ports(cwd: Path | None = None) -> tuple[int, int]:
    """Read logs/runtime-ports.json and return (ws_port, pdf_port).
    Fallback to (8765, 8080) if missing or malformed.
    """
    try:
        base = Path(cwd) if cwd else Path(os.getcwd())
        cfg_path = base / 'logs' / 'runtime-ports.json'
        if cfg_path.exists():
            data = json.loads(cfg_path.read_text(encoding='utf-8') or '{}')
            ws_port = int(data.get('ws_port') or 8765)
            pdf_port = int(data.get('pdf_port') or 8080)
            return ws_port, pdf_port
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed reading runtime-ports.json: %s", exc)
    return 8765, 8080


def _setup_logging() -> None:
    # Use project root for logs directory
    logs_dir = project_root / 'logs'
    os.makedirs(logs_dir, exist_ok=True)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        handlers=[
            logging.FileHandler(logs_dir / 'pdf-home.log', encoding='utf-8'),
            logging.StreamHandler(sys.stdout),
        ],
    )


def main() -> int:
    _setup_logging()
    logger.info("Launching pdf-home standalone window")

    # Create Qt app
    app = QApplication(sys.argv)

    # Host window
    window = MainWindow(app)

    # Ports
    ws_port, pdf_port = _read_runtime_ports()
    try:
        vite_port = get_vite_port()
    except Exception:
        vite_port = 3000
    logger.info("Resolved ports: vite=%s ws=%s pdf=%s", vite_port, ws_port, pdf_port)

    # Simple WebSocket client for the bridge to send messages to the backend
    ws_client = QWebSocket()
    ws_client.open(QUrl(f"ws://127.0.0.1:{ws_port}"))

    # QWebChannel bridge for local JS-Python interaction
    try:
        channel = QWebChannel(window)
        bridge = PdfHomeBridge(ws_client, window)
        channel.registerObject('pdfHomeBridge', bridge)
        if window.web_page:
            window.web_page.setWebChannel(channel)
        logger.info("QWebChannel initialized and pdfHomeBridge registered")
    except Exception as exc:
        logger.warning("Failed to initialize QWebChannel bridge: %s", exc)

    # Load front-end page
    url = f"http://localhost:{vite_port}/pdf_home/index.html?ws={ws_port}&pdfs={pdf_port}"
    logger.info("Loading front-end: %s", url)
    window.load_frontend(url)
    window.show()

    rc = app.exec()
    logger.info("pdf-home window exited with code %s", rc)
    ws_client.close()
    return int(rc)


if __name__ == '__main__':
    sys.exit(main())

