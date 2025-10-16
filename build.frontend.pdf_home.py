#!/usr/bin/env python3
"""
前端构建（pdf-home 专用）

- 仅构建 src/frontend/pdf-home，产出到 dist/latest/pdf-home/
- 复制 pdfjs-dist 到 vendor，并注入 window.__PDFJS_VENDOR_BASE__
- 复制 pdf-home/config/*.json 到 dist/latest/pdf-home/config/
- 复制前端 Python 启动/桥接代码（仅 pdf-home 相关）到 dist/latest/src/frontend/
- 复制 src/launcher/*.py 到 dist/latest/src/launcher（供插件打包运行时导入）

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
    dst_cfg = out_dir / "config"
    if dst_cfg.exists():
        shutil.rmtree(dst_cfg)
    count = 0
    for root, dirnames, filenames in os.walk(src_cfg):
        root_path = Path(root)
        rel = root_path.relative_to(src_cfg)
        target_dir = dst_cfg / rel
        target_dir.mkdir(parents=True, exist_ok=True)
        for fn in filenames:
            s = root_path / fn
            d = target_dir / fn
            shutil.copy2(s, d)
            count += 1
    return count

def _copy_py_files(src: Path, dst: Path):
    files_copied = 0
    dirs_created = 0
    IGNORE_DIRS = {"__pycache__", "__tests__", "tests"}
    for root, dirnames, filenames in os.walk(src):
        root_path = Path(root)
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
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

def copy_frontend_python_pdf_home(repo_root: Path, dist_root: Path) -> dict:
    stats = {"pdf_home": {"files": 0, "dirs": 0}}
    src = repo_root / "src" / "frontend" / "pdf-home"
    dst = dist_root / "src" / "frontend" / "pdf-home"
    if not src.exists():
        return stats
    files, dirs = _copy_py_files(src, dst)
    stats["pdf_home"].update(files=files, dirs=dirs)
    return stats

def copy_frontend_python_pdf_viewer(repo_root: Path, dist_root: Path) -> dict:
    stats = {"pdf_viewer": {"files": 0, "dirs": 0}}
    dst_root = dist_root / "src" / "frontend" / "pdf-viewer"
    dst_root.mkdir(parents=True, exist_ok=True)
    src_pdf_viewer_pyqt = repo_root / "src" / "frontend" / "pdf-viewer" / "pyqt"
    if src_pdf_viewer_pyqt.exists():
        f, d = _copy_py_files(src_pdf_viewer_pyqt, dst_root / "pyqt")
        stats["pdf_viewer"].update(files=f, dirs=d)
    launcher_py = repo_root / "src" / "frontend" / "pdf-viewer" / "launcher.py"
    if launcher_py.exists():
        target = dst_root / "launcher.py"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(launcher_py, target)
        stats["pdf_viewer"]["files"] = stats["pdf_viewer"].get("files", 0) + 1
    return stats

def copy_frontend_common(repo_root: Path, dist_root: Path):
    src_common = repo_root / "src" / "frontend" / "common"
    dst_common = dist_root / "src" / "frontend" / "common"
    if not src_common.exists():
        return 0, 0
    return _copy_py_files(src_common, dst_common)

def copy_launcher_python(repo_root: Path, dist_root: Path):
    src = repo_root / "src" / "launcher"
    dst = dist_root / "src" / "launcher"
    if not src.exists():
        return 0, 0
    return _copy_py_files(src, dst)

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="构建 pdf-home 到 dist/latest/pdf-home/")
    p.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="输出目录（默认 dist/latest/pdf-home）")
    p.add_argument("--skip-build", action="store_true", help="跳过 vite build，仅执行 vendor/配置/py 复制")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.skip_build:
        run_vite_build(REPO_ROOT, out_dir, base="./")

    files, dirs = copy_pdfjs_vendor(REPO_ROOT / "node_modules", STATIC_DIR)
    cfg_copied = copy_pdf_home_config(REPO_ROOT, out_dir)

    index_html = out_dir / "index.html"
    if not index_html.exists():
        alt = out_dir / "pdf-home" / "index.html"
        if alt.exists():
            index_html = alt
    injected = False
    if index_html.exists():
        _rewrite_index_assets_to_static(index_html, static_prefix="/static/")
        injected = inject_pdfjs_vendor_base(index_html, "/static/vendor/pdfjs-dist/")
        target_index = STATIC_DIR / "pdf-home" / "index.html"
        target_index.parent.mkdir(parents=True, exist_ok=True)
        target_index.write_text(index_html.read_text(encoding="utf-8"), encoding="utf-8")
        # 复制配置目录到 /static/pdf-home/config
        src_cfg_dir = REPO_ROOT / "src" / "frontend" / "pdf-home" / "config"
        if src_cfg_dir.exists():
            dst_cfg_dir = STATIC_DIR / "pdf-home" / "config"
            _copy_py_files(src_cfg_dir, dst_cfg_dir)

    copy_assets_to_static(out_dir, STATIC_DIR)
    dist_root = REPO_ROOT / "dist" / "latest"
    py_stats_home = copy_frontend_python_pdf_home(REPO_ROOT, dist_root)
    py_stats_viewer = copy_frontend_python_pdf_viewer(REPO_ROOT, dist_root)
    common_files, common_dirs = copy_frontend_common(REPO_ROOT, dist_root)

    # 复制 GUI 启动器至 dist/latest 根
    try:
        src_launcher = REPO_ROOT / "gui_launcher.py"
        if src_launcher.exists():
            dst_main = REPO_ROOT / "dist" / "latest" / "gui_launcher.py"
            dst_compat = REPO_ROOT / "dist" / "latest" / "gui_launcher_dist.py"
            shutil.copy2(src_launcher, dst_main)
            try:
                shutil.copy2(src_launcher, dst_compat)
            except Exception:
                pass
    except Exception:
        pass

    # 复制 AI 启动器脚本到 dist/latest 根目录
    try:
        src_ai = REPO_ROOT / "ai_launcher.py"
        dst_ai = REPO_ROOT / "dist" / "latest" / "ai_launcher_dist.py"
        if src_ai.exists():
            shutil.copy2(src_ai, dst_ai)
    except Exception:
        pass

    # 清理 out_dir 下中间产物
    try:
        if out_dir.exists():
            shutil.rmtree(out_dir)
    except Exception:
        pass

    meta = {
        "name": "frontend-pdf-home",
        "out_dir": str(out_dir),
        "vendor_pdfjs": {"files": files, "dirs": dirs},
        "injected_vendor_base": injected,
        "copied_config": cfg_copied,
        "frontend_python": {**py_stats_home, **py_stats_viewer},
        "common": {"files": common_files, "dirs": common_dirs},
    }
    meta_path = REPO_ROOT / "dist" / "latest" / "build.frontend.pdf_home.meta.json"
    meta_path.write_text(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n")
    sys.stdout.flush()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
