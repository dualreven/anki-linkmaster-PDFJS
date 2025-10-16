
#!/usr/bin/env python3
"""
前端构建（pdf-viewer 专用）

- 仅构建 src/frontend/pdf-viewer，产出到 dist/latest/src/frontend/pdf-viewer/
- 复制 pdfjs-dist 到 vendor，并注入 window.__PDFJS_VENDOR_BASE__
- 复制前端 Python 启动/桥接代码到 dist/latest/src/frontend/pdf-viewer/
- 复制 src/launcher/*.py 到 dist/latest/src/launcher（供插件打包运行时导入）

使用：
  python -X utf8 build.frontend.pdf_viewer.py [--out-dir dist/latest/src/frontend/pdf-viewer] [--skip-build]
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
DEFAULT_OUT_DIR = REPO_ROOT / "dist" / "latest" / "src" / "frontend" / "pdf-viewer"
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
    if not assets.exists():
        assets = out_dir / "pdf-viewer" / "assets"
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
    env["VITE_BUILD_ONLY"] = "pdf-viewer"
    cmd: list[str]
    if vite is not None:
        cmd = [str(vite), "build", "--base", base, "--outDir", str(out_dir)]
    else:
        cmd = ["npx", "vite", "build", "--base", base, "--outDir", str(out_dir)]
    rc = _run(cmd, cwd=repo_root, env=env)
    if rc != 0:
        raise RuntimeError(f"Vite 构建失败：return code {rc}")

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
    p = argparse.ArgumentParser(description="构建 pdf-viewer 到 dist/latest/src/frontend/pdf-viewer/")
    p.add_argument("--out-dir", default=str(DEFAULT_OUT_DIR), help="输出目录（默认 dist/latest/src/frontend/pdf-viewer）")
    p.add_argument("--skip-build", action="store_true", help="跳过 vite build，仅执行 vendor/py 复制")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.skip_build:
        run_vite_build(REPO_ROOT, out_dir, base="./")

    files, dirs = copy_pdfjs_vendor(REPO_ROOT / "node_modules", STATIC_DIR)
    index_html = out_dir / "index.html"
    if not index_html.exists():
        index_html = out_dir / "pdf-viewer" / "index.html"
    injected = False
    if index_html.exists():
        _rewrite_index_assets_to_static(index_html, static_prefix="/static/")
        injected = inject_pdfjs_vendor_base(index_html, "/static/vendor/pdfjs-dist/")
        target_index = STATIC_DIR / "pdf-viewer" / "index.html"
        target_index.parent.mkdir(parents=True, exist_ok=True)
        target_index.write_text(index_html.read_text(encoding="utf-8"), encoding="utf-8")
    copy_assets_to_static(out_dir, STATIC_DIR)

    dist_root = REPO_ROOT / "dist" / "latest"
    py_stats = copy_frontend_python_pdf_viewer(REPO_ROOT, dist_root)
    common_files, common_dirs = copy_frontend_common(REPO_ROOT, dist_root)

    # 清理 out_dir 的静态子目录，仅保留 Python 运行部件
    try:
        for p in (out_dir / 'assets', out_dir / 'pdf-viewer'):
            if p.exists():
                shutil.rmtree(p)
    except Exception:
        pass

    meta = {
        "name": "frontend-pdf-viewer",
        "out_dir": str(out_dir),
        "vendor_pdfjs": {"files": files, "dirs": dirs},
        "injected_vendor_base": injected,
        "frontend_python": py_stats,
        "common": {"files": common_files, "dirs": common_dirs},
    }
    meta_path = out_dir / "build.frontend.pdf_viewer.meta.json"
    meta_path.write_text(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.stdout.write(__import__("json").dumps(meta, ensure_ascii=False, indent=2) + "\n")
    sys.stdout.flush()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

def copy_launcher_python(repo_root: Path, dist_root: Path):
    src = repo_root / 'src' / 'launcher'
    dst = dist_root / 'src' / 'launcher'
    if not src.exists():
        return 0, 0
    def _copy_py_files(src: Path, dst: Path):
        files_copied = 0
        dirs_created = 0
        IGNORE_DIRS = {'__pycache__','__tests__','tests'}
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
    return _copy_py_files(src, dst)
