#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重建脚本：rebuilda_all

功能
- 停止后端（若在运行）
- 彻底清空 dist/latest（包含重试与 Windows 句柄占用容错）
- 按集中 /static 策略重建：后端 → pdf-viewer → pdf-home
- 可选：启动后端、启动 pdf-home（--start-backend / --start-home）

用法
  python -X utf8 rebuilda_all.py              # 停止→清空→重建（不启动）
  python -X utf8 rebuilda_all.py --start-backend --start-home

注意
- 显式使用 UTF-8 编码写入元数据；所有换行均为 \n。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent
DIST_LATEST = REPO_ROOT / "dist" / "latest"


def _run(cmd: list[str], *, cwd: Path | None = None) -> int:
    print(f"$ {' '.join(cmd)}", flush=True)
    try:
        proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
        return proc.returncode
    except KeyboardInterrupt:
        raise
    except Exception as e:
        print(f"[ERROR] run failed: {e}", flush=True)
        return 1


def stop_backend_if_running() -> None:
    launcher = DIST_LATEST / "src" / "backend" / "launcher.py"
    if launcher.exists():
        print("== 停止后端服务 ==", flush=True)
        _run([sys.executable, "-X", "utf8", str(launcher), "stop"])  # 忽略返回码
        time.sleep(0.2)


def _on_rm_error(func, path, exc_info):
    try:
        os.chmod(path, 0o666)
        func(path)
    except Exception:
        pass


def clean_dist_latest(retry: int = 7, delay: float = 0.5) -> None:
    if not DIST_LATEST.exists():
        DIST_LATEST.mkdir(parents=True, exist_ok=True)
        return
    print(f"== 清空 {DIST_LATEST} ==", flush=True)
    for i in range(retry):
        try:
            shutil.rmtree(DIST_LATEST, onerror=_on_rm_error)
            break
        except Exception as e:
            print(f"[WARN] 删除失败({i+1}/{retry}): {e}", flush=True)
            time.sleep(delay)
    DIST_LATEST.mkdir(parents=True, exist_ok=True)


def build_all() -> None:
    print("== 构建后端 ==", flush=True)
    rc = _run([sys.executable, "-X", "utf8", str(REPO_ROOT / "build.backend.py"), "--dist", str(DIST_LATEST)])
    if rc != 0:
        raise SystemExit(rc)

    print("== 构建 pdf-viewer（集中 /static） ==", flush=True)
    out_viewer = DIST_LATEST / "src" / "frontend" / "pdf-viewer"
    rc = _run([sys.executable, "-X", "utf8", str(REPO_ROOT / "build.frontend.pdf_viewer.py"), "--out-dir", str(out_viewer)])
    if rc != 0:
        raise SystemExit(rc)

    print("== 构建 pdf-home（集中 /static） ==", flush=True)
    out_home = DIST_LATEST / "pdf-home"
    rc = _run([sys.executable, "-X", "utf8", str(REPO_ROOT / "build.frontend.pdf_home.py"), "--out-dir", str(out_home)])
    if rc != 0:
        raise SystemExit(rc)


def start_backend() -> None:
    launcher = DIST_LATEST / "src" / "backend" / "launcher.py"
    if not launcher.exists():
        print("[WARN] 找不到后端 launcher.py，跳过启动", flush=True)
        return
    print("== 启动后端 ==", flush=True)
    rc = _run([sys.executable, "-X", "utf8", str(launcher), "start"])
    if rc != 0:
        print(f"[WARN] 后端启动返回码: {rc}", flush=True)


def start_pdf_home() -> None:
    launcher = DIST_LATEST / "src" / "frontend" / "pdf-home" / "launcher.py"
    if not launcher.exists():
        print("[WARN] 找不到 pdf-home launcher.py，跳过启动", flush=True)
        return
    print("== 启动 pdf-home (--prod) ==", flush=True)
    rc = _run([sys.executable, "-X", "utf8", str(launcher), "--prod"])
    if rc != 0:
        print(f"[WARN] pdf-home 启动返回码: {rc}", flush=True)


def validate_static() -> dict:
    static_dir = DIST_LATEST / "static"
    ok = static_dir.exists()
    samples: list[str] = []
    if ok:
        for p in static_dir.glob("*.js"):
            samples.append(str(p))
            if len(samples) >= 5:
                break
    info = {
        "static_exists": ok,
        "static_dir": str(static_dir),
        "sample_files": samples,
    }
    print(json.dumps(info, ensure_ascii=False, indent=2), flush=True)
    return info


def write_meta(info: dict) -> None:
    meta_path = DIST_LATEST / "rebuilda_all.meta.json"
    text = json.dumps(info, ensure_ascii=False, indent=2) + "\n"
    meta_path.write_text(text, encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="停止→清空→重建（后端 + 前端），集中静态到 /static")
    p.add_argument("--start-backend", action="store_true", help="重建后启动后端")
    p.add_argument("--start-home", action="store_true", help="重建后启动 pdf-home (--prod)")
    return p.parse_args(argv if argv is not None else sys.argv[1:])


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    stop_backend_if_running()
    clean_dist_latest()
    build_all()
    info = validate_static()
    write_meta({
        "message": "rebuild completed",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "static": info,
        "options": {"start_backend": bool(args.start_backend), "start_home": bool(args.start_home)},
    })
    if args.start_backend:
        start_backend()
    if args.start_home:
        start_pdf_home()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

