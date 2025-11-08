#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: event-bus naming from TablePlugin._emit_event
- Accepts new canonical 'table:pdf-outline:create:completed'
- Keeps compatibility with legacy 'table:pdf-bookmark:create:completed'
"""
from __future__ import annotations

import sys
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.backend.database.executor import SQLExecutor  # noqa
from src.backend.database.plugins.pdf_bookmark_plugin import PDFBookmarkTablePlugin  # noqa


class _StubBus:
    def __init__(self):
        self.events: list[str] = []
    def emit(self, name: str, data=None):
        self.events.append(name)
    def on(self, event_name: str, handler, subscriber_id: str):
        # minimal stub; we don't dispatch in this smoke
        return


def main():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    execu = SQLExecutor(conn)
    bus = _StubBus()
    plugin = PDFBookmarkTablePlugin(execu, bus, logger=None)
    plugin.enable()  # ensure table exists
    # Use the protected helper to emit (绕过 insert 的双事件兼容逻辑，直测命名规范)
    plugin._emit_event('create', 'completed', {'x': 1})  # type: ignore[attr-defined]
    assert bus.events, "no event emitted"
    last = bus.events[-1]
    ok = ("table:pdf-outline:create:completed" in last) or ("table:pdf-bookmark:create:completed" in last)
    assert ok, f"unexpected event: {last}"
    print("OK event-bus naming")

if __name__ == "__main__":
    main()

