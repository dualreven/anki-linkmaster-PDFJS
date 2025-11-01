#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smoke: static config for Outline feature
- Assert bootstrap enforces Outline registration
- Assert real-sidebars prefer OutlineSidebarUI

This is a static guard (no UI launch), helps catch accidental disablement.
"""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[6]

def must_contain(p: Path, needle: str):
    s = p.read_text(encoding="utf-8")
    assert needle in s, f"missing '{needle}' in {p}"

def main():
    bootstrap = ROOT / "src" / "frontend" / "pdf-viewer" / "bootstrap" / "app-bootstrap-feature.js"
    real_sidebars = ROOT / "src" / "frontend" / "pdf-viewer" / "features" / "sidebar-manager" / "real-sidebars.js"
    assert bootstrap.exists(), f"missing {bootstrap}"
    assert real_sidebars.exists(), f"missing {real_sidebars}"
    must_contain(bootstrap, "Outline feature enforced")
    must_contain(real_sidebars, "Using OutlineSidebarUI (flag enabled)")
    print("OK outline static config")

if __name__ == "__main__":
    main()

