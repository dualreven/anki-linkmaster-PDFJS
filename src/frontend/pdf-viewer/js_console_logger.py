#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JavaScript Console Logger wrapper for PDF-Viewer

Usage:
  python src/frontend/pdf-viewer/js_console_logger.py <debug_port> <pdf_id>

Writes logs to UTF-8 file: logs/pdf-viewer-<pdf_id>-js.log
Based on simplified architecture for stability and pdf_id support.
"""

from __future__ import annotations

import sys
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec


def _load_js_console_logger_class():
    """Load JSConsoleLogger from current directory."""
    current_dir = Path(__file__).parent
    impl_path = current_dir / 'js_console_logger_qt.py'
    spec = spec_from_file_location('pdf_viewer_js_logger_qt', impl_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Cannot load JSConsoleLogger from {impl_path}')
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return getattr(mod, 'JSConsoleLogger')


def main() -> int:
    try:
        debug_port = int(sys.argv[1]) if len(sys.argv) > 1 else 9223  # pdf-viewer默认端口
        pdf_id = sys.argv[2] if len(sys.argv) > 2 else 'empty'
        Path('logs').mkdir(parents=True, exist_ok=True)
        log_file = str(Path('logs') / f'pdf-viewer-{pdf_id}-js.log')

        JSConsoleLogger = _load_js_console_logger_class()
        logger = JSConsoleLogger(debug_port=debug_port, log_file=log_file, pdf_id=pdf_id)
        if not logger.start():
            print(f"Failed to start PDF-Viewer console logger on port {debug_port} for pdf_id {pdf_id}")
            return 1

        print(f"Monitoring PDF-Viewer JavaScript console on debug port {debug_port}, pdf_id={pdf_id}")
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

# Expose class symbol expected by launcher.py (保持向后兼容)
JSConsoleLogger = _load_js_console_logger_class()
