#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JavaScript Console Logger wrapper for PDF-Viewer

Usage:
  python src/frontend/pdf-viewer/js_console_logger.py <debug_port> <pdf_id>

Writes logs to UTF-8 file: logs/pdf-viewer-<pdf_id>-js.log
Relies on the shared JSConsoleLogger implementation under pdf-home for now.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Reuse the existing logger implementation
from src.frontend.pdf-home.js_console_logger import JSConsoleLogger  # type: ignore


def main() -> int:
    try:
        debug_port = int(sys.argv[1]) if len(sys.argv) > 1 else 9222
        pdf_id = sys.argv[2] if len(sys.argv) > 2 else 'default'
        Path('logs').mkdir(parents=True, exist_ok=True)
        log_file = str(Path('logs') / f'pdf-viewer-{pdf_id}-js.log')

        logger = JSConsoleLogger(debug_port=debug_port, log_file=log_file)
        if not logger.start():
            print(f"Failed to start console logger on port {debug_port}")
            return 1

        print(f"Monitoring JavaScript console on debug port {debug_port}, pdf_id={pdf_id}")
        print("Press Ctrl+C to stop...")
        import time
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            logger.stop()
        return 0
    except Exception as e:
        # Ensure UTF-8
        sys.stderr.write((str(e) + "\n").encode('utf-8', errors='ignore').decode('utf-8'))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

