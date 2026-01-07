#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


def _print_ln(text: str) -> None:
    sys.stdout.write(text.replace("\r\n", "\n") + "\n")


def _now_ts() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _run(
    args: Sequence[str],
    cwd: Optional[Path] = None,
    dry_run: bool = False,
    check: bool = True,
) -> str:
    cmdline = " ".join([f'"{a}"' if " " in a else a for a in args])
    if dry_run:
        _print_ln(f"[dry-run] {cmdline}")
        return ""
    _print_ln(f"[cmd] {cmdline}")
    proc = subprocess.run(
        list(args),
        cwd=str(cwd) if cwd else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
    )
    out = (proc.stdout or "").replace("\r\n", "\n")
    if check and proc.returncode != 0:
        raise RuntimeError(f"命令失败（exit={proc.returncode}）：{cmdline}\n{out}")
    return out


def _repo_root() -> Path:
    out = _run(["git", "rev-parse", "--show-toplevel"]).strip()
    if not out:
        raise RuntimeError("无法定位 git 仓库根目录")
    return Path(out)

def _resolve_cmd(name: str, fallbacks: Sequence[str]) -> str:
    found = shutil.which(name)
    if found:
        return found
    for fb in fallbacks:
        found2 = shutil.which(fb)
        if found2:
            return found2
    # Let it fail later with a clearer message.
    return name


def _ensure_clean(repo_root: Path) -> None:
    out = _run(["git", "status", "--porcelain"], cwd=repo_root).strip()
    if out:
        raise RuntimeError("工作区不干净（请先提交/还原改动后再跑 fastlane）")


def _assert_branch_exists(repo_root: Path, branch: str) -> None:
    _run(["git", "rev-parse", "--verify", branch], cwd=repo_root)


def _branch_exists(repo_root: Path, branch: str) -> bool:
    proc = subprocess.run(
        ["git", "rev-parse", "--verify", branch],
        cwd=str(repo_root),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    return proc.returncode == 0


def _assert_commits_exist(repo_root: Path, commits: Sequence[str]) -> None:
    for c in commits:
        _run(["git", "rev-parse", "--verify", f"{c}^{{commit}}"], cwd=repo_root)


def _assert_testpaths_exist(repo_root: Path, test_paths: Sequence[str]) -> None:
    for p in test_paths:
        if not (repo_root / p).exists():
            raise RuntimeError(f"测试文件不存在：{p}")


def _write_utf8_lf(path: Path, content: str, dry_run: bool) -> None:
    normalized = content.replace("\r\n", "\n")
    if not normalized.endswith("\n"):
        normalized += "\n"
    if dry_run:
        _print_ln(f"[dry-run] write report -> {path.as_posix()}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(normalized, encoding="utf-8", newline="\n")


def _load_queue(queue_file: Path) -> Dict:
    if not queue_file.exists():
        raise RuntimeError(f"QueueFile 不存在：{queue_file.as_posix()}")
    raw = queue_file.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"QueueFile JSON 解析失败：{queue_file.as_posix()}\n{e}") from e


@dataclass
class Config:
    base_branch: str
    integration_branch: str
    commits: List[str]
    test_paths: List[str]
    report_path: str


def _normalize_cfg(
    *,
    repo_root: Path,
    base_branch: str,
    integration_branch: Optional[str],
    commits: Optional[List[str]],
    test_paths: Optional[List[str]],
    report_path: Optional[str],
    queue: Optional[Dict],
) -> Config:
    cfg_base = base_branch
    cfg_integration = integration_branch
    cfg_commits = commits[:] if commits else []
    cfg_tests = test_paths[:] if test_paths else []
    cfg_report = report_path

    if queue is not None:
        if queue.get("baseBranch"):
            cfg_base = str(queue["baseBranch"])
        if queue.get("integrationBranch"):
            cfg_integration = str(queue["integrationBranch"])
        if queue.get("reportPath"):
            cfg_report = str(queue["reportPath"])

        if queue.get("commits"):
            cfg_commits = [str(x) for x in queue["commits"]]
        if queue.get("testPaths"):
            cfg_tests = [str(x) for x in queue["testPaths"]]

    if not cfg_integration:
        cfg_integration = f"integration/fastlane-{_now_ts()}"
    if not cfg_report:
        cfg_report = f"AItemp/reports/{_now_ts()}-merge-fastlane-report.md"

    if not cfg_commits:
        raise RuntimeError("必须提供 commits（--commits 或 QueueFile.commits）")
    if not cfg_tests:
        raise RuntimeError("必须提供 testPaths（--test-paths 或 QueueFile.testPaths）")

    # Keep repo-relative paths normalized with forward slashes.
    cfg_tests = [p.replace("\\", "/") for p in cfg_tests]

    return Config(
        base_branch=cfg_base,
        integration_branch=cfg_integration,
        commits=cfg_commits,
        test_paths=cfg_tests,
        report_path=cfg_report,
    )


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="批量 cherry-pick + lint + jest（Fail-Fast）")
    p.add_argument("--commits", nargs="*", default=None, help="提交 hash 列表（与 --queue-file 互斥）")
    p.add_argument("--queue-file", default=None, help="QueueFile(JSON)，包含 commits/testPaths 等")
    p.add_argument("--base-branch", default="main")
    p.add_argument("--integration-branch", default=None)
    p.add_argument("--test-paths", nargs="*", default=None)
    p.add_argument("--report-path", default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--force-integration-branch", action="store_true")
    p.add_argument("--allow-dirty", action="store_true")
    return p.parse_args(list(argv))


def main(argv: Sequence[str]) -> int:
    args = _parse_args(argv)
    repo_root = _repo_root()

    if args.queue_file and args.commits:
        raise RuntimeError("不能同时提供 --queue-file 与 --commits")

    queue = _load_queue(Path(args.queue_file)) if args.queue_file else None
    cfg = _normalize_cfg(
        repo_root=repo_root,
        base_branch=str(args.base_branch),
        integration_branch=args.integration_branch,
        commits=list(args.commits) if args.commits else None,
        test_paths=list(args.test_paths) if args.test_paths else None,
        report_path=args.report_path,
        queue=queue,
    )

    _print_ln(f"[info] repoRoot={repo_root.as_posix()}")
    _print_ln(f"[info] baseBranch={cfg.base_branch}")
    _print_ln(f"[info] integrationBranch={cfg.integration_branch}")
    _print_ln(f"[info] dryRun={bool(args.dry_run)}")

    git_cmd = _resolve_cmd("git", ["git.exe"])
    pnpm_cmd = _resolve_cmd("pnpm", ["pnpm.cmd", "pnpm.exe"])

    _assert_commits_exist(repo_root, cfg.commits)
    if not args.allow_dirty:
        _ensure_clean(repo_root)
    else:
        _print_ln("[warn] allowDirty=true：已跳过工作区干净检查（仅建议用于自检/调试）")

    _assert_branch_exists(repo_root, cfg.base_branch)

    if _branch_exists(repo_root, cfg.integration_branch):
        if not args.force_integration_branch:
            raise RuntimeError(f"integration 分支已存在：{cfg.integration_branch}（如需覆盖请加 --force-integration-branch）")
        _run(["git", "branch", "-D", cfg.integration_branch], cwd=repo_root, dry_run=args.dry_run)

    steps: List[Tuple[str, str, int]] = []
    started = datetime.now()

    def step(name: str, fn) -> None:
        s = datetime.now()
        try:
            fn()
            result = "OK"
        except Exception:
            result = "FAILED"
            raise
        finally:
            e = datetime.now()
            ms = int((e - s).total_seconds() * 1000)
            steps.append((name, result, ms))

    step("checkout baseBranch", lambda: _run([git_cmd, "checkout", cfg.base_branch], cwd=repo_root, dry_run=args.dry_run))
    step("create integration branch", lambda: _run([git_cmd, "checkout", "-b", cfg.integration_branch], cwd=repo_root, dry_run=args.dry_run))

    picked: List[str] = []
    for c in cfg.commits:
        def _pick(c_hash: str = c) -> None:
            _run([git_cmd, "cherry-pick", c_hash], cwd=repo_root, dry_run=args.dry_run)
        try:
            step(f"cherry-pick {c}", _pick)
            picked.append(c)
        except Exception:
            if not args.dry_run:
                try:
                    _run([git_cmd, "cherry-pick", "--abort"], cwd=repo_root, dry_run=False, check=False)
                except Exception:
                    pass
            raise

    # 注意：测试文件可能由本次 cherry-pick 引入，必须在合入后再校验
    if not args.dry_run:
        _assert_testpaths_exist(repo_root, cfg.test_paths)

    step("pnpm -s run lint", lambda: _run([pnpm_cmd, "-s", "run", "lint"], cwd=repo_root, dry_run=args.dry_run))
    step(
        "pnpm exec jest --runTestsByPath",
        lambda: _run([pnpm_cmd, "exec", "jest", "--runTestsByPath", *cfg.test_paths, "-i"], cwd=repo_root, dry_run=args.dry_run),
    )

    ended = datetime.now()
    total_ms = int((ended - started).total_seconds() * 1000)

    lines: List[str] = []
    lines.append("# merge-fastlane report")
    lines.append("")
    lines.append(f"time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"repoRoot: {repo_root.as_posix()}")
    lines.append(f"baseBranch: {cfg.base_branch}")
    lines.append(f"integrationBranch: {cfg.integration_branch}")
    lines.append(f"dryRun: {bool(args.dry_run)}")
    lines.append(f"totalMs: {total_ms}")
    lines.append("")
    lines.append("## commits")
    for c in cfg.commits:
        lines.append(f"- {c}")
    lines.append("")
    lines.append("## tests")
    for p in cfg.test_paths:
        lines.append(f"- {p}")
    lines.append("")
    lines.append("## steps")
    for name, result, ms in steps:
        lines.append(f"- {name}: {result} ({ms}ms)")
    lines.append("")
    lines.append("result: OK")

    report = "\n".join(lines) + "\n"
    report_path = repo_root / cfg.report_path
    _write_utf8_lf(report_path, report, dry_run=args.dry_run)
    _print_ln(f"[ok] report={cfg.report_path}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as e:
        _print_ln(f"[err] {e}")
        raise SystemExit(1)
