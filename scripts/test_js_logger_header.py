# -*- coding: utf-8 -*-
# Verifies that JSConsoleLogger writes a BOOT line on init (no Qt event loop needed)
import sys
from pathlib import Path
import importlib.util

project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

js_logger_path = project_root / 'src' / 'frontend' / 'pdf-home' / 'js_console_logger.py'
spec = importlib.util.spec_from_file_location('js_console_logger', js_logger_path)
mod = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)  # type: ignore
JSConsoleLogger = mod.JSConsoleLogger

log_path = Path('logs') / 'js-boot-test.log'
if log_path.exists():
    try:
        log_path.unlink()
    except Exception:
        pass

logger = JSConsoleLogger(debug_port=0, log_file=str(log_path))

exists = log_path.exists()
size = log_path.stat().st_size if exists else -1
print(f"exists={exists} size={size}")

if not exists or size <= 0:
    raise SystemExit(1)
