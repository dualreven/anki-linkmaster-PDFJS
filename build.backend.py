#!/usr/bin/env python3
"""
后端构建脚本（Step 1/3）

将仓库中的后端源码复制到 dist/latest/ 下，保持必要的目录结构，
并处理运行时相对路径依赖（如 core_utils、logs 目录）。

注意：
- 所有文件写入均显式 UTF-8 编码；
- 使用过滤复制，排除缓存、测试与无关目录；
- 默认复制：src/backend → dist/latest/src/backend；core_utils → dist/latest/core_utils；
- 创建 dist/latest/logs 以满足 launcher 运行时的日志要求。

用法：
  python build.backend.py [--dist <path>] [--clean]

示例：
  python build.backend.py --dist dist/latest --clean
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Tuple


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
    """复制目录（带忽略规则）。返回 (files_copied, dirs_created)。"""
    files_copied = 0
    dirs_created = 0
    for root, dirnames, filenames in os.walk(src):
        root_path = Path(root)
        # 过滤要忽略的子目录（就地修改 dirnames 以阻止 os.walk 进入）
        dirnames[:] = [d for d in dirnames if not _should_ignore(root_path / d)]

        # 创建对应目标目录
        rel = root_path.relative_to(src)
        target_dir = dst / rel
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
            dirs_created += 1

        # 复制文件
        for fn in filenames:
            src_file = root_path / fn
            if _should_ignore(src_file):
                continue
            dst_file = target_dir / fn
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            files_copied += 1
    return files_copied, dirs_created


def copy_backend_sources(repo_root: Path, dist_root: Path) -> dict:
    """复制后端相关源码到 dist_root。

    结构：
      - src/backend → dist_root/src/backend
      - src/qt     → dist_root/src/qt
      - core_utils → dist_root/core_utils
      - 创建 dist_root/logs
    返回统计信息字典。
    """
    src_backend = repo_root / "src" / "backend"
    src_core_utils = repo_root / "core_utils"
    src_qt = repo_root / "src" / "qt"

    if not src_backend.exists():
        raise FileNotFoundError(f"后端目录不存在: {src_backend}")

    # 确保目标基础目录存在
    (dist_root / "src").mkdir(parents=True, exist_ok=True)
    (dist_root / "logs").mkdir(parents=True, exist_ok=True)

    stats = {
        "backend": {"files": 0, "dirs": 0},
        "qt": {"files": 0, "dirs": 0},
        "core_utils": {"files": 0, "dirs": 0},
        "public_js": {"files": 0, "dirs": 0},
    }

    # 复制后端
    files, dirs = _copytree_filtered(src_backend, dist_root / "src" / "backend")
    stats["backend"]["files"] = files
    stats["backend"]["dirs"] = dirs

    # 复制 qt（若存在）
    if src_qt.exists():
        files_qt, dirs_qt = _copytree_filtered(src_qt, dist_root / "src" / "qt")
        stats["qt"]["files"] = files_qt
        stats["qt"]["dirs"] = dirs_qt

    # 复制 core_utils（若存在）
    if src_core_utils.exists():
        files_cu, dirs_cu = _copytree_filtered(src_core_utils, dist_root / "core_utils")
        stats["core_utils"]["files"] = files_cu
        stats["core_utils"]["dirs"] = dirs_cu

    # 复制 public/js（如 qwebchannel.js）到 dist/static，供生产静态服务器提供
    public_js = repo_root / "public" / "js"
    if public_js.exists():
        files_pj, dirs_pj = _copytree_filtered(public_js, dist_root / "static")
        stats["public_js"]["files"] = files_pj
        stats["public_js"]["dirs"] = dirs_pj

    # 写入构建元数据
    meta = {
        "name": "backend",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "repo_root": str(repo_root),
        "dist_root": str(dist_root),
        "stats": stats,
    }
    meta_path = dist_root / "build.backend.meta.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return meta


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="构建后端源码到 dist/latest/")
    p.add_argument("--dist", dest="dist", default=str(DEFAULT_DIST), help="目标输出根目录（默认：dist/latest）")
    p.add_argument("--clean", action="store_true", help="输出前清空目标目录")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    dist_root = Path(args.dist).resolve()

    if args.clean and dist_root.exists():
        # 小心清理，仅清理我们要生成的层级
        # 这里直接删除整个 dist_root 目录
        shutil.rmtree(dist_root)

    dist_root.mkdir(parents=True, exist_ok=True)

    meta = copy_backend_sources(REPO_ROOT, dist_root)

    # 控制台输出（UTF-8）
    out = {
        "message": "backend build completed",
        "dist_root": str(dist_root),
        "stats": meta.get("stats", {}),
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
