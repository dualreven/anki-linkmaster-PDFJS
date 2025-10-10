#!/usr/bin/env python3
"""
前端构建（pdf-home 专用）

- 仅构建 src/frontend/pdf-home，产出到 dist/latest/pdf-home/
- 复制 pdfjs-dist 到 vendor，并注入 window.__PDFJS_VENDOR_BASE__
- 复制 pdf-home/config/*.json 到 dist/latest/pdf-home/config/
- 复制前端 Python 启动/桥接代码（仅 pdf-home 相关）到 dist/latest/src/frontend/

使用：
  python -X utf8 build.frontend.pdf_home.py [--out-dir dist/latest/pdf-home] [--skip-build]
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_OUT_DIR = REPO_ROOT / "dist" / "latest" / "pdf-home"
STATIC_DIR = REPO_ROOT / "dist" / "latest" / "static"

def _run(cmd: list[str], cwd: Optional[Path] = None, env: Optional[dict] = None) -> int:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, env=env)
    return proc.returncode

def _vite_bin(repo_root: Path) -> Optional[Path]:
    cand = repo_root / "node_modules" / ".bin" / ("vite.cmd" if os.name == 'nt' else "vite")
    return cand if cand.exists() else None

def inject_pdfjs_vendor_base(html_path: Path, vendor_rel: str = "./vendor/pdfjs-dist/") -> bool:
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
    if not new_text.endswith("\n"):
        new_text += "\n"
    html_path.write_text(new_text, encoding="utf-8")
    return True

def _rewrite_index_assets_to_static(html_path: Path, *, static_prefix: str = "/static/") -> bool:
    text = html_path.read_text(encoding="utf-8")
    new_text = text
    for prefix in ("../assets/", "./assets/", "/assets/"):
        new_text = new_text.replace(f"src=\"{prefix}", f"src=\"{static_prefix}")
        new_text = new_text.replace(f"href=\"{prefix}", f"href=\"{static_prefix}")
    # 额外：修正 qwebchannel.js 的路径，确保从 /static 加载
    new_text = new_text.replace('src="../js/qwebchannel.js"', 'src="/static/qwebchannel.js"')
    new_text = new_text.replace('src="/js/qwebchannel.js"', 'src="/static/qwebchannel.js"')
    new_text = new_text.replace('src="js/qwebchannel.js"', 'src="/static/qwebchannel.js"')
    changed = new_text != text
    if changed:
        html_path.write_text(new_text, encoding="utf-8")
    return changed

def copy_pdfjs_vendor(node_modules_root: Path, out_dir: Path) -> Tuple[int, int]:
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

def copy_assets_to_static(out_dir: Path, static_dir: Path) -> Tuple[int, int]:
    assets = out_dir / "assets"
    files = 0
    dirs = 0
    if not assets.exists():
        return files, dirs
    static_dir.mkdir(parents=True, exist_ok=True)
    for root, dirnames, filenames in os.walk(assets):
        root_path = Path(root)
        rel = root_path.relative_to(assets)
        target_dir = static_dir / rel
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

def run_vite_build(repo_root: Path, out_dir: Path, base: str = "./") -> None:
    vite = _vite_bin(repo_root)
    env = os.environ.copy()
    env["VITE_BUILD_ONLY"] = "pdf-home"
    cmd: list[str]
    if vite is not None:
        cmd = [str(vite), "build", "--base", base, "--outDir", str(out_dir)]
    else:
        cmd = ["npx", "vite", "build", "--base", base, "--outDir", str(out_dir)]
    rc = _run(cmd, cwd=repo_root, env=env)
    if rc != 0:
        raise RuntimeError(f"Vite 构建失败：return code {rc}")

def copy_pdf_home_config(repo_root: Path, out_dir: Path) -> int:
    src_cfg = repo_root / "src" / "frontend" / "pdf-home" / "config"
    if not src_cfg.exists():
        return 0
    # 直接放入集中静态目录下的 /static/pdf-home/config
    dst_cfg = STATIC_DIR / "pdf-home" / "config"
    cnt = 0
    for root, _, files in os.walk(src_cfg):
        r = Path(root)
        rel = r.relative_to(src_cfg)
        td = dst_cfg / rel
        td.mkdir(parents=True, exist_ok=True)
        for fn in files:
            if fn.lower().endswith((".json", ".cfg", ".conf")):
                shutil.copy2(r / fn, td / fn)
                cnt += 1
    return cnt

def copy_frontend_python_pdf_home(repo_root: Path, dist_root: Path) -> dict:
    """复制与 pdf-home 启动相关的 Python 代码到 dist/latest/src/frontend 下。"""
    stats = {"pyqtui": {"files": 0, "dirs": 0}, "pdf_home": {"files": 0, "dirs": 0}}
    dst_root = dist_root / "src" / "frontend"
    dst_root.mkdir(parents=True, exist_ok=True)
    # pyqtui
    src_pyqtui = repo_root / "src" / "frontend" / "pyqtui"
    if src_pyqtui.exists():
        f, d = _copytree_filtered(src_pyqtui, dst_root / "pyqtui")
        stats["pyqtui"].update(files=f, dirs=d)
    # pdf-home python 部分（含 launcher.py 等）
    src_pdf_home = repo_root / "src" / "frontend" / "pdf-home"
    if src_pdf_home.exists():
        f, d = _copytree_filtered(src_pdf_home, dst_root / "pdf-home")
        stats["pdf_home"].update(files=f, dirs=d)
    return stats

def _copy_py_files(src: Path, dst: Path) -> tuple[int, int]:
    files_copied = 0
    dirs_created = 0
    for root, dirnames, filenames in os.walk(src):
        root_path = Path(root)
        # 排除 __pycache__ 与测试目录
        dirnames[:] = [d for d in dirnames if d not in {"__pycache__", "__tests__", "tests"}]
        rel = root_path.relative_to(src)
        target_dir = dst / rel
        if not target_dir.exists():
            target_dir.mkdir(parents=True, exist_ok=True)
            dirs_created += 1
        for fn in filenames:
            if not fn.lower().endswith('.py'):
                continue
            sf = root_path / fn
            df = target_dir / fn
            df.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(sf, df)
            files_copied += 1
    return files_copied, dirs_created

def copy_frontend_python_pdf_viewer(repo_root: Path, dist_root: Path) -> dict:
    """复制 pdf-viewer 的 Python 部分（仅 .py 文件）到 dist/latest/src/frontend/pdf-viewer。

    复制内容：
      - src/frontend/pdf-viewer/pyqt/**/* .py → dist/latest/src/frontend/pdf-viewer/pyqt
      - src/frontend/pdf-viewer/launcher.py → dist/latest/src/frontend/pdf-viewer/launcher.py
    """
    stats = {"pdf_viewer": {"files": 0, "dirs": 0}}
    dst_root = dist_root / "src" / "frontend" / "pdf-viewer"
    dst_root.mkdir(parents=True, exist_ok=True)

    src_pdf_viewer_pyqt = repo_root / "src" / "frontend" / "pdf-viewer" / "pyqt"
    if src_pdf_viewer_pyqt.exists():
        f, d = _copy_py_files(src_pdf_viewer_pyqt, dst_root / "pyqt")
        stats["pdf_viewer"].update(files=f, dirs=d)

    # 单文件：launcher.py（如果存在）
    launcher_py = repo_root / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    if launcher_py.exists():
        target = dst_root / "launcher.py"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(launcher_py, target)
        stats["pdf_viewer"]["files"] = stats["pdf_viewer"].get("files", 0) + 1

    return stats

IGNORE_DIR_NAMES = {"__pycache__", ".pytest_cache", ".git", ".vscode", "node_modules", "dist", "build", "coverage", "__tests__", "tests"}
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

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="构建 pdf-home 到 dist/latest/pdf-home/")
    p.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="输出目录（默认 dist/latest/pdf-home）")
    p.add_argument("--skip-build", action="store_true", help="跳过 vite build，仅执行 vendor/配置/py 复制")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.skip_build:
        # 仅构建 pdf-home，资源位于 out_dir 内部（不共享）
        run_vite_build(REPO_ROOT, out_dir, base="./")

    # 统一 vendor 到 /static 下（pdf-home 目前不直接依赖 pdfjs-dist，但保持一致性）
    files, dirs = copy_pdfjs_vendor(REPO_ROOT / "node_modules", STATIC_DIR)
    cfg_copied = copy_pdf_home_config(REPO_ROOT, out_dir)
    injected = False
    index_html = out_dir / "index.html"
    if not index_html.exists():
        # 兼容嵌套布局：out_dir/pdf-home/index.html
        alt = out_dir / "pdf-home" / "index.html"
        if alt.exists():
            index_html = alt
    if index_html.exists():
        # 调整 index.html 内资源至 /static/ 并复制到 /static/pdf-home/index.html
        _rewrite_index_assets_to_static(index_html, static_prefix="/static/")
        injected = inject_pdfjs_vendor_base(index_html, "/static/vendor/pdfjs-dist/")
        target_index = STATIC_DIR / "pdf-home" / "index.html"
        target_index.parent.mkdir(parents=True, exist_ok=True)
        # 始终以 UTF-8 明确写入
        target_index.write_text(index_html.read_text(encoding="utf-8"), encoding="utf-8")
    # 复制 assets/* 到 /static
    copy_assets_to_static(out_dir, STATIC_DIR)
    py_stats = copy_frontend_python_pdf_home(REPO_ROOT, REPO_ROOT / "dist" / "latest")
    # 复制 pdf-viewer 的 Python 运行部件，供 pdf-home 调用 viewer 窗口
    viewer_py_stats = copy_frontend_python_pdf_viewer(REPO_ROOT, REPO_ROOT / "dist" / "latest")

    # 构建完成后清理 out_dir（避免在 dist/latest 下保留 pdf-home 目录）
    try:
        if out_dir.exists():
            import shutil as _sh
            _sh.rmtree(out_dir)
    except Exception:
        pass

    meta = {
        "name": "frontend-pdf-home",
        "out_dir": str(out_dir),
        "vendor_pdfjs": {"files": files, "dirs": dirs},
        "injected_vendor_base": injected,
        "copied_config": cfg_copied,
        "frontend_python": {**py_stats, **viewer_py_stats},
    }
    # out_dir 已清理，元数据写入 dist/latest 根目录
    meta_path = REPO_ROOT / "dist" / "latest" / "build.frontend.pdf_home.meta.json"
    meta_path.write_text(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n")
    sys.stdout.flush()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
