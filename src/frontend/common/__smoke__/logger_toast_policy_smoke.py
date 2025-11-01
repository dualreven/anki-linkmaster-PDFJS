#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: logger toast policy exports
- Ensure setToastPolicy/getToastPolicy/setDefaultToastEnabled are present in src logger.js
"""
from __future__ import annotations

from pathlib import Path
import sys

# __smoke__ → common → frontend → src → <ROOT>
ROOT = Path(__file__).resolve().parents[4]

def main():
    p = ROOT / "src" / "frontend" / "common" / "utils" / "logger.js"
    assert p.exists(), f"missing {p}"
    s = p.read_text(encoding="utf-8")
    for needle in [
        "export function setToastPolicy(",
        "export function getToastPolicy(",
        "export function setDefaultToastEnabled(",
    ]:
        assert needle in s, f"missing export: {needle}"
    print("OK logger toast policy exports present")

if __name__ == "__main__":
    main()
