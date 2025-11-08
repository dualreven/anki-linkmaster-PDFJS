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
    real_sidebars = ROOT / "src" / "frontend" / "pdf-viewer" / "features" / "infra-sidebar" / "real-sidebars.js"
    assert bootstrap.exists(), f"missing {bootstrap}"
    assert real_sidebars.exists(), f"missing {real_sidebars}"
    # 强制注册的静态提示（bootstrap）
    must_contain(bootstrap, "Outline feature enforced")
    # 侧边栏偏好：应出现 OutlineSidebarUI 的引用；并包含 BookmarkSidebarUI 作为回退
    must_contain(real_sidebars, "outlineSidebarUI")
    must_contain(real_sidebars, "BookmarkSidebarUI")
    print("OK outline static config")

if __name__ == "__main__":
    main()

