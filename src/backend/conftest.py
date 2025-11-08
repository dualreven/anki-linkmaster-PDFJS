# -*- coding: utf-8 -*-
"""
Pytest 配置：为测试添加仓库根到 sys.path，保证 `import src.*` 可用。
"""
from __future__ import annotations

import sys
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[2]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

