#!/usr/bin/env python3
"""
前端构建脚本（Step 2/3）

- 使用 Vite 进行多入口构建（pdf-home / pdf-viewer）
- 产出写入 dist/latest/（可配置）
- 复制 pdfjs-dist 到 vendor 并注入 window.__PDFJS_VENDOR_BASE__

注意：
- 所有文件读写显式 UTF-8，尾部包含 \n；
- 不强制安装依赖，允许 --skip-install；
- 可选择通过本地 vite 可执行文件（node_modules）执行构建，避免网络；

用法：
  python build.frontend.py [--out-dir dist/latest] [--skip-install] [--skip-build]

示例：
  python build.frontend.py --out-dir dist/latest --skip-install
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Optional, Tuple


REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = REPO_ROOT / "dist" / "latest"


def _run(cmd: list[str], cwd: Optional[Path] = None) -> int:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    return proc.returncode


def _has_command(name: str) -> bool:
    from shutil import which
    return which(name) is not None


def _vite_bin(repo_root: Path) -> Optional[Path]:
    cand = repo_root / "node_modules" / ".bin" / ("vite.cmd" if os.name == 'nt' else "vite")
    return cand if cand.exists() else None


def inject_pdfjs_vendor_base(html_path: Path, vendor_rel: str = "./vendor/pdfjs-dist/") -> bool:
    """在 html <head> 后注入 window.__PDFJS_VENDOR_BASE__ 脚本（幂等）。

    Returns True 若发生写入（新增注入），False 若已存在而未修改。
    """
    text = html_path.read_text(encoding="utf-8")
    if "__PDFJS_VENDOR_BASE__" in text:
        return False
    snippet = f"<script>window.__PDFJS_VENDOR_BASE__='{vendor_rel}'</script>\n"
    idx = text.find("<head>")
    if idx != -1:
        idx_end = idx + len("<head>")
        new_text = text[:idx_end] + "\n" + snippet + text[idx_end:]
    else:
        new_text = snippet + text
    html_path.write_text(new_text if new_text.endswith("\n") else new_text + "\n", encoding="utf-8")
    return True


def copy_pdfjs_vendor(node_modules_root: Path, out_dir: Path) -> Tuple[int, int]:
    """复制 node_modules/pdfjs-dist → out_dir/vendor/pdfjs-dist。
    返回 (files, dirs)。
    """
    src = node_modules_root / "pdfjs-dist"
    if not src.exists():
        raise FileNotFoundError(f"未找到 pdfjs-dist: {src}")
    dst = out_dir / "vendor" / "pdfjs-dist"
    if dst.exists():
        shutil.rmtree(dst)
    files = 0
    dirs = 0
    for root, dirnames, filenames in os.walk(src):
        root_path = Path(root)
        rel = root_path.relative_to(src)
        target_dir = dst / rel
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
            dirs += 1
        for fn in filenames:
            s = root_path / fn
            d = target_dir / fn
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, d)
            files += 1
    return files, dirs


# ==== 复制前端 Python 侧代码（用于从 dist/src/frontend 下直接运行） ====
IGNORE_DIR_NAMES = {
    "__pycache__",
    ".pytest_cache",
    ".git",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__tests__",
    "tests",
}

IGNORE_FILE_SUFFIXES = {".pyc", ".pyo", ".pyd", ".log"}


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
            sf = root_path / fn
            if _should_ignore(sf):
                continue
            df = target_dir / fn
            df.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(sf, df)
            files_copied += 1
    return files_copied, dirs_created


def copy_frontend_python(repo_root: Path, out_dir: Path) -> dict:
    """复制前端 Python/启动器相关代码到 out_dir/src/frontend 下。

    - src/frontend/pyqtui → out_dir/src/frontend/pyqtui
    - src/frontend/pdf-home → out_dir/src/frontend/pdf-home
    - src/frontend/pdf-viewer/pyqt → out_dir/src/frontend/pdf-viewer/pyqt
    - src/frontend/pdf-viewer/launcher.py → out_dir/src/frontend/pdf-viewer/launcher.py
    """
    stats = {
        "pyqtui": {"files": 0, "dirs": 0},
        "pdf_home": {"files": 0, "dirs": 0},
        "pdf_viewer_pyqt": {"files": 0, "dirs": 0},
        "pdf_viewer_launcher": {"files": 0, "dirs": 0},
    }

    dst_root = out_dir / "src" / "frontend"
    dst_root.mkdir(parents=True, exist_ok=True)

    # pyqtui
    src_pyqtui = repo_root / "src" / "frontend" / "pyqtui"
    if src_pyqtui.exists():
        f, d = _copytree_filtered(src_pyqtui, dst_root / "pyqtui")
        stats["pyqtui"].update(files=f, dirs=d)

    # pdf-home（全部拷贝，过滤缓存与测试）
    src_pdf_home = repo_root / "src" / "frontend" / "pdf-home"
    if src_pdf_home.exists():
        f, d = _copytree_filtered(src_pdf_home, dst_root / "pdf-home")
        stats["pdf_home"].update(files=f, dirs=d)

    # pdf-viewer/pyqt
    src_pdf_viewer_pyqt = repo_root / "src" / "frontend" / "pdf-viewer" / "pyqt"
    if src_pdf_viewer_pyqt.exists():
        f, d = _copytree_filtered(src_pdf_viewer_pyqt, dst_root / "pdf-viewer" / "pyqt")
        stats["pdf_viewer_pyqt"].update(files=f, dirs=d)

    # pdf-viewer/launcher.py（单文件）
    src_pdf_viewer_launcher = repo_root / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    if src_pdf_viewer_launcher.exists():
        dst = dst_root / "pdf-viewer"
        dst.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_pdf_viewer_launcher, dst / "launcher.py")
        stats["pdf_viewer_launcher"].update(files=1, dirs=0)

    return stats


def run_vite_build(repo_root: Path, out_dir: Path, base: str = "./") -> None:
    # 优先本地 vite 二进制，避免 npx 联网
    vite = _vite_bin(repo_root)
    cmd: list[str]
    if vite is not None:
        cmd = [str(vite), "build", "--base", base, "--outDir", str(out_dir)]
    elif _has_command("pnpm"):
        cmd = ["pnpm", "exec", "vite", "build", "--base", base, "--outDir", str(out_dir)]
    else:
        cmd = ["npx", "vite", "build", "--base", base, "--outDir", str(out_dir)]

    rc = _run(cmd, cwd=repo_root)
    if rc != 0:
        raise RuntimeError(f"Vite 构建失败：return code {rc}")


def publish_frontend(out_dir: Path, skip_build: bool = False) -> dict:
    repo_root = REPO_ROOT
    out_dir.mkdir(parents=True, exist_ok=True)

    if not skip_build:
        run_vite_build(repo_root, out_dir, base="./")

    # 复制 pdfjs-dist vendor
    files, dirs = copy_pdfjs_vendor(repo_root / "node_modules", out_dir)

    # 注入 vendor base
    html_candidates = [
        out_dir / "pdf-viewer" / "index.html",
        out_dir / "pdf-viewer.html",
        out_dir / "pdf-home" / "index.html",
        out_dir / "pdf-home.html",
    ]
    injected = []
    for hp in html_candidates:
        if hp.exists():
            changed = inject_pdfjs_vendor_base(hp)
            injected.append({"file": str(hp), "changed": changed})

    # 复制 pdf-home 的运行时配置（例如 feature-flags.json）到 dist/pdf-home/config/
    cfg_src = repo_root / "src" / "frontend" / "pdf-home" / "config"
    cfg_dst = out_dir / "pdf-home" / "config"
    cfg_stats = {"copied": 0}
    if cfg_src.exists():
        for root, _, files in os.walk(cfg_src):
            r = Path(root)
            rel = r.relative_to(cfg_src)
            td = cfg_dst / rel
            td.mkdir(parents=True, exist_ok=True)
            for fn in files:
                if fn.lower().endswith((".json", ".cfg", ".conf")):
                    s = r / fn
                    d = td / fn
                    shutil.copy2(s, d)
                    cfg_stats["copied"] += 1

    # 复制前端 Python 侧代码
    py_stats = copy_frontend_python(repo_root, out_dir)

    meta = {
        "name": "frontend",
        "out_dir": str(out_dir),
        "vendor_pdfjs": {"files": files, "dirs": dirs},
        "injected": injected,
        "copied_config": cfg_stats,
        "frontend_python": py_stats,
    }
    meta_path = out_dir / "build.frontend.meta.json"
    content = ("" + __import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n")
    meta_path.write_text(content, encoding="utf-8")
    return meta


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="构建前端产物到 dist/latest/")
    p.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="输出目录（默认 dist/latest）")
    p.add_argument("--skip-install", action="store_true", help="跳过安装依赖（默认跳过）")
    p.add_argument("--skip-build", action="store_true", help="跳过 vite build，仅执行 vendor 复制与注入")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    out_dir = Path(args.out_dir).resolve()

    # 依赖检查（最小化）：存在 node_modules 即认为可构建
    if not args.skip_build and not (REPO_ROOT / "node_modules").exists():
        raise RuntimeError("未检测到 node_modules，请先安装依赖或使用 --skip-build")

    meta = publish_frontend(out_dir, skip_build=args.skip_build)
    sys.stdout.write(__import__("json").dumps({
        "message": "frontend build completed",
        "out_dir": str(out_dir),
        "vendor": meta.get("vendor_pdfjs"),
        "injected": meta.get("injected"),
    }, ensure_ascii=False, indent=2) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
