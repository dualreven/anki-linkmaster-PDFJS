#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
集成层构建脚本（Integrations Build）

目的：
- 将 `src/integrations` 目录复制到目标构建目录（默认：`dist/latest/src/integrations`）。
- 为 Anki 插件侧调用提供可分发的桥接模块（如 anki_event_bridge.py）。

特性：
- 显式 UTF-8 文件写入；
- 过滤复制（忽略缓存、测试与无关目录/文件）；
- 支持 --clean 清理目标中的 integrations 目录；
- 输出元信息 JSON 文件，便于追踪。

用法：
  python build.integrations.py [--dist <path>] [--clean]

示例：
  python build.integrations.py --dist dist/latest --clean
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Tuple


REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_DIST = REPO_ROOT / "dist" / "latest"


IGNORE_DIR_NAMES = {
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".github",
    ".venv",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__tests__",
    "tests",
}

IGNORE_FILE_SUFFIXES = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".log",
}


def _should_ignore(path: Path) -> bool:
    name = path.name
    if path.is_dir() and name in IGNORE_DIR_NAMES:
        return True
    if path.is_file() and any(name.endswith(suf) for suf in IGNORE_FILE_SUFFIXES):
        return True
    return False


def _copytree_filtered(src: Path, dst: Path) -> Tuple[int, int]:
    files_copied = 0
    dirs_created = 0
    for root, dirnames, filenames in os.walk(src):
        root_path = Path(root)
        dirnames[:] = [d for d in dirnames if not _should_ignore(root_path / d)]

        rel = root_path.relative_to(src)
        target_dir = dst / rel
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
            dirs_created += 1

        for fn in filenames:
            src_file = root_path / fn
            if _should_ignore(src_file):
                continue
            dst_file = target_dir / fn
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            files_copied += 1
    return files_copied, dirs_created


def build_integrations(dist_root: Path) -> dict:
    """复制 src/integrations → <dist_root>/src/integrations。

    返回统计信息字典。
    """
    src_dir = REPO_ROOT / "src" / "integrations"
    if not src_dir.exists():
        raise FileNotFoundError(f"integrations 源目录不存在: {src_dir}")

    (dist_root / "src").mkdir(parents=True, exist_ok=True)
    (dist_root / "logs").mkdir(parents=True, exist_ok=True)

    files, dirs = _copytree_filtered(src_dir, dist_root / "src" / "integrations")
    info = {
        "source": str(src_dir),
        "target": str(dist_root / "src" / "integrations"),
        "files": int(files),
        "dirs": int(dirs),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    # 写入元信息 JSON（UTF-8 + LF）
    meta_path = dist_root / "build.integrations.meta.json"
    text = json.dumps(info, ensure_ascii=False, indent=2) + "\n"
    with open(meta_path, "w", encoding="utf-8", newline="\n") as fp:
        fp.write(text)

    return info


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Build integrations (copy src/integrations to dist)")
    parser.add_argument("--dist", dest="dist", type=str, default=str(DEFAULT_DIST), help="Target dist root directory")
    parser.add_argument("--clean", action="store_true", help="Clean target integrations directory before copying")
    args = parser.parse_args(argv)

    dist_root = Path(args.dist).resolve()
    integrations_target = dist_root / "src" / "integrations"

    try:
        if args.clean and integrations_target.exists():
            shutil.rmtree(integrations_target, ignore_errors=True)

        info = build_integrations(dist_root)
        # 结构化输出，便于上层脚本解析
        sys.stdout.write(json.dumps({"ok": True, "info": info}, ensure_ascii=False) + "\n")
        return 0
    except Exception as exc:
        sys.stderr.write(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False) + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

