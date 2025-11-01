#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lightweight Smoke Test Runner
- Discovers and runs *_smoke.py under **/__smoke__/ in src/**
- Prints a concise summary and writes a markdown report into AItemp/reports

Usage:
  python -X utf8 scripts/smoke.py                # run all
  python -X utf8 scripts/smoke.py --feature pdf-viewer   # run only matching paths
  python -X utf8 scripts/smoke.py --changed      # (reserved) run changed subset (future)

Notes:
- Tests should be self-contained and keep runtime short (<10s each).
- Avoid GUI automation; prefer launching lightweight code paths or log assertions.
"""
from __future__ import annotations

import argparse
import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = ROOT / "AItemp" / "reports"
SMOKE_PATTERNS = ["src/frontend/**/__smoke__/*_smoke.py", "src/backend/**/__smoke__/*_smoke.py", "src/**/__smoke__/*_smoke.py"]


def discover_tests(feature_filter: str | None) -> list[Path]:
    out: list[Path] = []
    try:
        import glob
        for pattern in SMOKE_PATTERNS:
            for p in glob.glob(str(ROOT / pattern), recursive=True):
                if not p.endswith("_smoke.py"):
                    continue
                path = Path(p)
                if feature_filter:
                    if feature_filter.lower() not in str(path).lower():
                        continue
                out.append(path)
    except Exception:
        pass
    # Stable order
    out = sorted(set(out), key=lambda p: str(p).lower())
    return out


def run_test(path: Path, timeout_s: int = 40) -> tuple[bool, str]:
    try:
        # Tests are regular Python scripts; success indicated by exit code 0
        proc = subprocess.run([sys.executable, "-X", "utf8", str(path)],
                              cwd=str(ROOT),
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,
                              timeout=timeout_s,
                              text=True,
                              encoding="utf-8",
                              errors="replace")
        ok = (proc.returncode == 0)
        output = proc.stdout.strip()
        return ok, output
    except subprocess.TimeoutExpired as e:
        return False, f"[TIMEOUT] {path} after {timeout_s}s\n{e}"
    except Exception as e:
        return False, f"[ERROR] {path}: {e}"


def write_report(results: list[tuple[Path, bool, str]]) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    report = REPORTS_DIR / f"smoke-{ts}.md"
    lines = []
    passed = sum(1 for _, ok, _ in results if ok)
    failed = len(results) - passed
    lines.append(f"# Smoke Report — {ts}")
    lines.append("")
    lines.append(f"- Total: {len(results)}  Passed: {passed}  Failed: {failed}")
    lines.append("")
    for path, ok, out in results:
        status = "PASS" if ok else "FAIL"
        lines.append(f"## {status} — {path.as_posix()}")
        if out:
            lines.append("")
            lines.append("```")
            lines.append(out)
            lines.append("```")
            lines.append("")
    report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feature", help="Filter by feature/path substring", default=None)
    ap.add_argument("--changed", action="store_true", help="Run only changed subset (reserved)")
    args = ap.parse_args()

    tests = discover_tests(args.feature)
    if not tests:
        print("No smoke tests found.")
        sys.exit(0)

    results: list[tuple[Path, bool, str]] = []
    for t in tests:
        ok, out = run_test(t)
        print(f"[{'OK' if ok else 'XX'}] {t}")
        results.append((t, ok, out))

    report = write_report(results)
    print(f"\nReport: {report.as_posix()}")

    # Exit non-zero if any failed
    if any(not ok for _, ok, _ in results):
        sys.exit(1)


if __name__ == "__main__":
    main()

