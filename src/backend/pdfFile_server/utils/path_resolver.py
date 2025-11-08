# -*- coding: utf-8 -*-
"""
路径解析工具：
- 将 URL 路径解析为文件系统路径（纯函数）
- 复用 embed_fileserver 中的逻辑（含 /static、/pdf-home、/pdf-viewer、/pdfs、/pdf-files 规则）
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional, Dict
from urllib.parse import unquote
import logging

logger = logging.getLogger(__name__)


def _ensure_within(base: Path, candidate: Path) -> bool:
    """检测 candidate 是否在 base 目录之内。"""
    try:
        candidate.relative_to(base)
        return True
    except Exception:
        return False


def resolve_path(
    url_path: str,
    *,
    static_root: Path,
    pdfs_root: Optional[Path],
    root_dir: Path,
    mounts: Optional[Dict[str, Path]] = None,
    project_root: Optional[Path] = None,
    allow_fallbacks: bool = False,
) -> Optional[Path]:
    """
    将 URL 路径解析为文件系统路径。
    - 最长前缀匹配已注册挂载点（mounts）
    - 默认 /static → static_root
    - 默认 /pdf-home → static_root/pdf-home（支持回退候选）
    - 默认 /pdf-viewer → static_root/(src/frontend|pdf-viewer)（支持回退候选）
    - /pdfs/* 与 /pdf-files/* → 指向 pdfs_root
    - 其余走 root_dir
    - 目录自动尝试 index.html
    返回 None 表示 404 或路径穿越被拒绝。
    """
    # URL 解码并去掉查询参数
    url_path = unquote(url_path or "")
    if "?" in url_path:
        url_path = url_path.split("?", 1)[0]

    # 准备挂载点副本
    m: Dict[str, Path] = dict(mounts or {})
    # /static
    try:
        if static_root and Path(static_root).exists():
            m.setdefault("/static", Path(static_root))
    except Exception:
        pass

    # 推断 pdf-home/pdf-viewer 基础目录（若存在）
    try:
        home_base = (static_root / "pdf-home")
        viewer_a = static_root / "src" / "frontend" / "pdf-viewer"
        viewer_b = static_root / "pdf-viewer"
        viewer_base = viewer_a if viewer_a.exists() else viewer_b
    except Exception:
        home_base = static_root
        viewer_base = static_root
    m.setdefault("/pdf-home", home_base)
    m.setdefault("/pdf-viewer", viewer_base)

    # 1) 已挂载前缀（最长优先）
    for prefix, base in sorted(m.items(), key=lambda kv: len(kv[0]), reverse=True):
        if url_path == prefix or url_path.startswith(prefix + "/"):
            base_path = Path(base)
            if allow_fallbacks and (not base_path.exists()) and project_root:
                # 回退候选（仅在明确允许时启用，以适配不同打包布局）
                fallback_candidates = []
                if prefix == "/pdf-home":
                    fallback_candidates = [
                        static_root / "pdf-home",
                        static_root / "src" / "frontend" / "pdf-home",
                        project_root / "pdf-home",
                        project_root / "src" / "frontend" / "pdf-home",
                        static_root / "static" / "pdf-home",
                    ]
                elif prefix == "/pdf-viewer":
                    fallback_candidates = [
                        static_root / "src" / "frontend" / "pdf-viewer",
                        static_root / "pdf-viewer",
                        project_root / "src" / "frontend" / "pdf-viewer",
                        project_root / "pdf-viewer",
                        static_root / "static" / "pdf-viewer",
                        static_root / "static" / "src" / "frontend" / "pdf-viewer",
                    ]
                for fb in fallback_candidates:
                    if fb.exists():
                        base_path = fb.resolve()
                        break

            remainder = url_path[len(prefix) :]
            relative_path = remainder.lstrip("/")
            candidate = (base_path / relative_path).resolve()
            if not _ensure_within(base_path, candidate):
                logger.warning("路径穿越尝试: %s", url_path)
                return None
            if candidate.exists() and candidate.is_dir():
                index_path = candidate / "index.html"
                return index_path if index_path.exists() and index_path.is_file() else None
            return candidate if candidate.exists() and candidate.is_file() else None

    # 2) /pdfs/*
    if url_path.startswith("/pdfs/") and pdfs_root is not None:
        relative_path = url_path[len("/pdfs/") :].lstrip("/")
        candidate = (pdfs_root / relative_path).resolve()
        if not _ensure_within(pdfs_root, candidate):
            logger.warning("路径穿越尝试: %s", url_path)
            return None
        return candidate if candidate.exists() and candidate.is_file() else None

    # 3) 历史路由 /pdf-files/*
    if url_path.startswith("/pdf-files/") and pdfs_root is not None:
        relative_path = url_path[len("/pdf-files/") :].lstrip("/")
        candidate = (pdfs_root / relative_path).resolve()
        if not _ensure_within(pdfs_root, candidate):
            logger.warning("路径穿越尝试: %s", url_path)
            return None
        return candidate if candidate.exists() and candidate.is_file() else None

    # 4) 默认 root_dir
    relative_path = url_path.lstrip("/")
    file_path = (root_dir / relative_path).resolve()
    if not _ensure_within(root_dir, file_path):
        logger.warning("路径穿越尝试: %s", url_path)
        return None
    if file_path.exists() and file_path.is_dir():
        index_path = file_path / "index.html"
        return index_path if index_path.exists() and index_path.is_file() else None
    return file_path if file_path.exists() and file_path.is_file() else None

