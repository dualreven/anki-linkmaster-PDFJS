"""Unit test for DevToolsLogCollector._write_log or websockets mock.

This test attempts to find DevToolsLogCollector or _write_log in app.py,
call it with a sample entry, and assert that logs/pdf-viewer.log contains
a JSON line with expected format (timestamp, message).
"""
import json
import os
from pathlib import Path
import pytest
import importlib

def find_write_fn():
    try:
        app = importlib.import_module("app")
    except Exception as e:
        pytest.fail(f"Failed to import app module: {e}")

    # Try to find an instance _collector
    if hasattr(app, "_collector"):
        c = getattr(app, "_collector")
        if hasattr(c, "_write_log") and callable(getattr(c, "_write_log")):
            return c, c._write_log

    # Try to find DevToolsLogCollector class
    if hasattr(app, "DevToolsLogCollector"):
        cls = getattr(app, "DevToolsLogCollector")
        # attempt to instantiate if possible
        try:
            inst = cls()
            if hasattr(inst, "_write_log"):
                return inst, inst._write_log
        except Exception:
            # maybe class cannot be instantiated; try to find method on class
            if hasattr(cls, "_write_log"):
                return None, cls._write_log

    # Try module-level _write_log
    if hasattr(app, "_write_log") and callable(getattr(app, "_write_log")):
        return app, app._write_log

    pytest.fail("No DevToolsLogCollector or _write_log callable found in app.py")

def read_last_nonempty_line(path):
    with open(path, "rb") as f:
        raw = f.read().decode("utf-8", errors="ignore")
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return None
    return lines[-1]

def test_write_log_creates_json_line(tmp_path, monkeypatch):
    # prepare a temporary logs directory and monkeypatch the cwd to tmp_path so that relative 'logs' resolves here
    monkeypatch.chdir(tmp_path)
    (tmp_path / "logs").mkdir(parents=True, exist_ok=True)
    write_owner, write_fn = find_write_fn()
    # prepare sample entry
    sample = {"timestamp":"2025-09-10T00:00:00Z","level":"info","message":"unit test message"}
    # call the write function; support bound and unbound cases
    try:
        # if it's a function defined on class expecting self as first arg, and write_owner provided
        if write_owner is None:
            # unbound function that requires entry only
            write_fn(sample)
        else:
            # bound to instance? check signature
            try:
                write_fn(sample)
            except TypeError:
                # try as unbound requiring self
                write_fn(write_owner, sample)
    except Exception as e:
        pytest.fail(f"Calling _write_log failed: {e}")

    # locate the log file
    candidate = Path(tmp_path) / "logs" / "pdf-viewer.log"
    if not candidate.exists():
        # also check project-level logs
        candidate = Path(os.getcwd()) / "logs" / "pdf-viewer.log"
    assert candidate.exists(), f"Expected log file {candidate} not found"

    last_line = read_last_nonempty_line(candidate)
    assert last_line is not None, "Log file empty after _write_log"

    # assert parseable JSON line and expected fields
    obj = json.loads(last_line)
    assert "timestamp" in obj and isinstance(obj["timestamp"], str)
    assert "message" in obj and obj["message"] == "unit test message"