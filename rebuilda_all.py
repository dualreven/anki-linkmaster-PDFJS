#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重建脚本：rebuilda_all

功能
- 停止后端（若在运行）
- 彻底清空 dist/latest 和 Anki 插件目录（包含重试与 Windows 句柄占用容错）
- 按集中 /static 策略重建：后端 → pdf-viewer → pdf-home
- 默认：清空并复制到 Anki 插件目录（可用 --no-copy-to-anki 禁用）
- 可选：启动后端、pdf-home（--start-backend / --start-home）

用法
  python -X utf8 rebuilda_all.py              # 停止→清空→重建→复制到 Anki（默认）
  python -X utf8 rebuilda_all.py --no-copy-to-anki  # 仅重建，不复制到 Anki
  python -X utf8 rebuilda_all.py --start-backend --start-home  # 重建并启动服务

注意
- 显式使用 UTF-8 编码写入元数据；所有换行均为 \n。
- 默认会清空 Anki 插件目录，然后复制所有 dist/latest/ 内容。
- --start-backend 和 --start-home 启动的是 dist/latest/ 中的服务。
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
ANKI_PLUGIN_DIR = Path(r"C:\Users\napretep\AppData\Roaming\Anki2\addons21\hjp_linkmaster_dev\lib\pdf_sys")


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


def clean_anki_plugin_dir(retry: int = 7, delay: float = 0.5) -> None:
    """清空 Anki 插件目录 pdf_sys"""
    if not ANKI_PLUGIN_DIR.exists():
        ANKI_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
        return
    print(f"== 清空 Anki 插件目录 {ANKI_PLUGIN_DIR} ==", flush=True)
    for i in range(retry):
        try:
            shutil.rmtree(ANKI_PLUGIN_DIR, onerror=_on_rm_error)
            break
        except Exception as e:
            print(f"[WARN] 删除 Anki 插件目录失败({i+1}/{retry}): {e}", flush=True)
            time.sleep(delay)
    ANKI_PLUGIN_DIR.mkdir(parents=True, exist_ok=True)


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

    print("== 构建 integrations（桥接模块） ==", flush=True)
    rc = _run([sys.executable, "-X", "utf8", str(REPO_ROOT / "build.integrations.py"), "--dist", str(DIST_LATEST), "--clean"])
    if rc != 0:
        raise SystemExit(rc)


def start_backend() -> None:
    """启动 dist/latest 下的后端服务"""
    launcher = DIST_LATEST / "src" / "backend" / "launcher.py"
    if not launcher.exists():
        print("[WARN] 找不到后端 launcher.py，跳过启动", flush=True)
        return
    print("== 启动后端 ==", flush=True)
    rc = _run([sys.executable, "-X", "utf8", str(launcher), "start"])
    if rc != 0:
        print(f"[WARN] 后端启动返回码: {rc}", flush=True)


def start_pdf_home() -> None:
    """启动 dist/latest 下的 pdf-home"""
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


def copy_to_anki_plugin() -> dict:
    """复制 dist/latest/ 的所有内容到 Anki 插件目录"""
    if not DIST_LATEST.exists():
        print(f"[ERROR] dist/latest 不存在: {DIST_LATEST}", flush=True)
        return {"success": False, "error": "dist/latest not found"}

    print(f"== 复制 {DIST_LATEST} 到 {ANKI_PLUGIN_DIR} ==", flush=True)

    files_copied = 0
    dirs_created = 0

    try:
        # 遍历 dist/latest 下的所有内容
        for item in DIST_LATEST.iterdir():
            src_path = item
            dst_path = ANKI_PLUGIN_DIR / item.name

            if src_path.is_dir():
                # 复制目录
                if dst_path.exists():
                    shutil.rmtree(dst_path, onerror=_on_rm_error)
                shutil.copytree(src_path, dst_path)
                # 统计目录中的文件数
                for root, dirs, files in os.walk(dst_path):
                    dirs_created += len(dirs)
                    files_copied += len(files)
                print(f"  [COPY DIR] {item.name} ({files_copied} files)", flush=True)
            else:
                # 复制文件
                shutil.copy2(src_path, dst_path)
                files_copied += 1
                print(f"  [COPY FILE] {item.name}", flush=True)

        info = {
            "success": True,
            "files_copied": files_copied,
            "dirs_created": dirs_created,
            "source": str(DIST_LATEST),
            "destination": str(ANKI_PLUGIN_DIR),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        # 写入复制元数据到 Anki 插件目录
        meta_path = ANKI_PLUGIN_DIR / "copy.meta.json"
        meta_path.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        print(f"== 复制完成: {files_copied} 文件, {dirs_created} 目录 ==", flush=True)
        return info

    except Exception as e:
        print(f"[ERROR] 复制失败: {e}", flush=True)
        return {"success": False, "error": str(e)}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="停止→清空→重建（后端 + 前端），集中静态到 /static，默认复制到 Anki 插件目录")
    p.add_argument("--start-backend", action="store_true", help="重建后启动后端")
    p.add_argument("--start-home", action="store_true", help="重建后启动 pdf-home (--prod)")
    p.add_argument("--no-copy-to-anki", action="store_true", help="禁用复制到 Anki 插件目录（默认会复制）")
    return p.parse_args(argv if argv is not None else sys.argv[1:])


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    # 默认复制到 Anki，除非明确禁用
    should_copy_to_anki = not args.no_copy_to_anki

    # 步骤 1: 停止后端服务
    stop_backend_if_running()

    # 步骤 2: 清空 dist/latest 和 Anki 插件目录（默认清空）
    if should_copy_to_anki:
        clean_anki_plugin_dir()
    clean_dist_latest()

    # 步骤 3: 构建所有模块
    build_all()

    # 步骤 4: 验证静态文件
    info = validate_static()

    # 步骤 5: 复制到 Anki 插件目录（默认复制）
    copy_result = {}
    if should_copy_to_anki:
        copy_result = copy_to_anki_plugin()
        if not copy_result.get("success", False):
            print("[ERROR] 复制到 Anki 插件目录失败", flush=True)
            return 1

    # 步骤 6: 写入元数据
    write_meta({
        "message": "rebuild completed",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "static": info,
        "options": {
            "start_backend": bool(args.start_backend),
            "start_home": bool(args.start_home),
            "copy_to_anki": should_copy_to_anki,
        },
        "copy_to_anki": copy_result if should_copy_to_anki else None,
    })

    # 步骤 7: 启动服务（如果指定）
    if args.start_backend:
        start_backend()
    if args.start_home:
        start_pdf_home()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
