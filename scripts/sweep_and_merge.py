#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Set, Tuple


def _ts() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _print_ln(text: str) -> None:
    sys.stdout.write(text.replace("\r\n", "\n") + "\n")


def _fail(message: str) -> "NoReturn":
    raise RuntimeError(message)


def _run(
    args: Sequence[str],
    cwd: Optional[Path] = None,
    check: bool = True,
) -> str:
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
        cmdline = " ".join(args)
        _fail(f"命令失败（exit={proc.returncode}）：{cmdline}\n{out}")
    return out


def _repo_root() -> Path:
    out = _run(["git", "rev-parse", "--show-toplevel"]).strip()
    if not out:
        _fail("无法定位 git 仓库根目录")
    return Path(out)


def _main_commit(repo_root: Path, base_branch: str) -> str:
    return _run(["git", "rev-parse", base_branch], cwd=repo_root).strip()


def _worktrees(repo_root: Path) -> List[Path]:
    out = _run(["git", "worktree", "list", "--porcelain"], cwd=repo_root)
    paths: List[Path] = []
    current: Optional[str] = None
    for raw in out.split("\n"):
        line = raw.strip()
        if line.startswith("worktree "):
            current = line[len("worktree ") :].strip()
            continue
        if line == "":
            if current:
                paths.append(Path(current))
            current = None
            continue
    if current:
        paths.append(Path(current))

    # Normalize and keep deterministic ordering.
    norm = []
    for p in paths:
        try:
            norm.append(p.resolve())
        except FileNotFoundError:
            continue
    norm.sort(key=lambda x: str(x).lower())
    return norm


def _is_same_path(a: Path, b: Path) -> bool:
    try:
        return a.resolve() == b.resolve()
    except FileNotFoundError:
        return False


def _is_ancestor(repo_path: Path, maybe_ancestor: str, commit: str) -> bool:
    proc = subprocess.run(
        ["git", "merge-base", "--is-ancestor", maybe_ancestor, commit],
        cwd=str(repo_path),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    return proc.returncode == 0


@dataclass(frozen=True)
class CommitInfo:
    hash: str
    subject: str


def _commits_between(repo_path: Path, base: str, head: str) -> List[CommitInfo]:
    out = _run(["git", "log", f"{base}..{head}", "--format=%H %s", "--reverse"], cwd=repo_path)
    commits: List[CommitInfo] = []
    for line in out.split("\n"):
        line = line.strip()
        if not line:
            continue
        parts = line.split(" ", 1)
        if len(parts) != 2:
            continue
        commits.append(CommitInfo(hash=parts[0], subject=parts[1]))
    return commits


def _changed_files(repo_path: Path, base: str, head: str) -> List[str]:
    out = _run(["git", "diff", "--name-only", base, head], cwd=repo_path)
    files = [x.strip() for x in out.split("\n") if x.strip()]
    return files


def _infer_test_candidates(changed: Iterable[str]) -> List[str]:
    tests: List[str] = []
    for f in changed:
        f = f.replace("\\", "/")
        if f.endswith((".test.js", ".test.mjs", ".test.ts", ".spec.js", ".spec.mjs", ".spec.ts")):
            tests.append(f)
            continue

        if f.endswith((".js", ".mjs", ".ts")):
            # sibling: foo.test.js
            base, ext = os.path.splitext(f)
            tests.append(f"{base}.test{ext}")

            # __tests__/foo.test.js
            dir_path, name = os.path.split(f)
            name_base, name_ext = os.path.splitext(name)
            tests.append(f"{dir_path}/__tests__/{name_base}.test{name_ext}" if dir_path else f"__tests__/{name_base}.test{name_ext}")
    return tests


def _exists_in_worktree(worktree: Path, repo_rel: str) -> bool:
    return (worktree / repo_rel).exists()


def _dedupe_keep_order(items: Iterable[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for x in items:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _write_json_utf8_lf(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(payload, ensure_ascii=False, indent=2)
    normalized = raw.replace("\r\n", "\n") + "\n"
    path.write_text(normalized, encoding="utf-8", newline="\n")


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="扫描 worktree 并生成 merge-fastlane 队列（Fail-Fast）")
    p.add_argument("--base-branch", default="main")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-todo-only", action="store_true", help='跳过仅包含 "chore(todo)" 的 worktree 提交')
    p.add_argument("--queue-file", default=None, help="输出 QueueFile 路径（默认写入 AItemp/reports）")
    p.add_argument("--report-path", default=None, help="merge-fastlane 报告输出路径（默认写入 AItemp/reports）")
    p.add_argument("--integration-branch", default=None, help="integration 分支名（默认 integration/sweep-<timestamp>）")
    return p.parse_args(list(argv))


def main(argv: Sequence[str]) -> int:
    args = _parse_args(argv)

    repo_root = _repo_root()
    os.chdir(str(repo_root))

    base_branch = str(args.base_branch)
    main_commit = _main_commit(repo_root, base_branch)
    _print_ln(f"[info] baseBranch={base_branch}")
    _print_ln(f"[info] mainCommit={main_commit}")

    roots_worktrees = _worktrees(repo_root)
    if not roots_worktrees:
        _fail("未发现任何 worktree（git worktree list --porcelain 返回为空）")

    commits_to_merge: List[str] = []
    tests_to_run: List[str] = []
    dirty_worktrees = 0

    for wt in roots_worktrees:
        if _is_same_path(wt, repo_root):
            continue
        if not wt.exists():
            continue

        head = _run(["git", "rev-parse", "HEAD"], cwd=wt).strip()
        if head == main_commit:
            _print_ln(f"[skip] {wt} (up to date)")
            continue

        if not _is_ancestor(wt, main_commit, head):
            _print_ln(f"[warn] {wt} HEAD ({head}) is not derived from {base_branch} ({main_commit}). Cherry-pick may conflict.")

        commit_objs = _commits_between(wt, main_commit, head)
        if not commit_objs:
            continue

        if args.skip_todo_only:
            non_todo = [c for c in commit_objs if not c.subject.startswith("chore(todo")]
            if not non_todo:
                _print_ln(f"[skip] {wt} (only chore(todo) commits)")
                continue

        _print_ln(f"[found] {wt} has {len(commit_objs)} new commits")
        dirty_worktrees += 1

        for c in commit_objs:
            commits_to_merge.append(c.hash)

        changed = _changed_files(wt, main_commit, head)
        inferred = _infer_test_candidates(changed)
        # Keep only tests that actually exist in that worktree (repo-relative paths).
        for t in inferred:
            if _exists_in_worktree(wt, t):
                tests_to_run.append(t)

    commits_to_merge = _dedupe_keep_order(commits_to_merge)
    tests_to_run = _dedupe_keep_order(tests_to_run)

    if not commits_to_merge:
        _print_ln("[info] No work to merge.")
        return 0

    _print_ln("")
    _print_ln(f"[plan] Merging {len(commits_to_merge)} commits from {dirty_worktrees} worktrees")
    _print_ln(f"[plan] Running {len(tests_to_run)} tests")
    if tests_to_run:
        for t in tests_to_run:
            _print_ln(f"  - {t}")
    else:
        _print_ln("  [err] 未能推断任何测试文件（Fail-Fast）。请在各 worktree 提交中显式包含/更新对应 *.test.*，或使用 merge-fastlane QueueFile 显式提供 testPaths。")
        return 2

    ts = _ts()
    integration_branch = str(args.integration_branch or f"integration/sweep-{ts}")
    report_path = str(args.report_path or f"AItemp/reports/{ts}-merge-fastlane-report.md")
    queue_path = Path(args.queue_file or f"AItemp/reports/{ts}-merge-fastlane-queue.json")

    queue = {
        "baseBranch": base_branch,
        "integrationBranch": integration_branch,
        "commits": commits_to_merge,
        "testPaths": tests_to_run,
        "reportPath": report_path,
    }

    _print_ln("")
    _print_ln(f"[info] queueFile={queue_path.as_posix()}")
    if args.dry_run:
        _print_ln("[dry-run] 不写入 queueFile，不执行 merge-fastlane。")
        return 0

    _write_json_utf8_lf(queue_path, queue)

    _print_ln("")
    _print_ln("[exec] Invoking merge-fastlane...")
    _run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str((repo_root / "scripts" / "merge-fastlane.ps1").as_posix()),
            "-QueueFile",
            str(queue_path.as_posix()),
        ],
        cwd=repo_root,
        check=True,
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except Exception as e:
        _print_ln(f"[err] {e}")
        raise SystemExit(1)

