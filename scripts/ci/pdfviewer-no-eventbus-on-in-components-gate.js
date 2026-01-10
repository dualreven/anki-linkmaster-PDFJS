import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import childProcess from "child_process";

const DEFAULT_REPO_ROOT = process.cwd();

function toPosixPath(p) {
  return p.split(path.sep).join("/");
}

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n|\r/g, "\n");
}

export function isTargetComponentRelPath(relPath) {
  const p = relPath.replaceAll("\\", "/");
  return p.startsWith("src/frontend/pdf-viewer/features/") && p.includes("/components/");
}

export function isExcludedRelPath(relPath) {
  const p = relPath.replaceAll("\\", "/");
  return (
    p.includes("/__tests__/") ||
    p.includes("/fixtures/") ||
    p.includes("/docs/") ||
    p.includes("/SPEC/")
  );
}

export function hasForbiddenEventbusOn(text) {
  const normalized = normalizeNewlines(text);
  const re = /\b(?:this\s*\.\s*#?\s*eventBus|eventBus)\s*\.\s*on\s*\(/g;
  return re.test(normalized);
}

export function analyzeNoEventbusOnInComponentsGate({ relPath, fileText } = {}) {
  if (!relPath) {
    throw new Error("[pdfviewer-no-eventbus-on-in-components] relPath is required");
  }
  if (typeof fileText !== "string") {
    throw new Error("[pdfviewer-no-eventbus-on-in-components] fileText must be a string");
  }

  if (!isTargetComponentRelPath(relPath) || isExcludedRelPath(relPath)) {
    return { scanned: 0, violations: [] };
  }

  if (!hasForbiddenEventbusOn(fileText)) {
    return { scanned: 1, violations: [] };
  }

  return {
    scanned: 1,
    violations: [
      {
        type: "forbidden-on-in-components",
        path: relPath,
        message: "components/** must not call eventBus.on(...); move subscriptions to subscriptions/**"
      }
    ]
  };
}

function execGitLines(args, repoRoot) {
  const out = childProcess.execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return String(out).split(/\r\n|\r|\n/).filter(Boolean);
}

export async function runPdfviewerNoEventbusOnInComponentsGate({
  repoRoot = DEFAULT_REPO_ROOT,
  baseRef = "main",
} = {}) {
  const absRoot = path.resolve(repoRoot);

  // 增量严格：只扫描本分支相对 baseRef 的变更文件，避免历史存量一次性炸裂
  let mergeBase;
  try {
    mergeBase = execGitLines(["merge-base", baseRef, "HEAD"], absRoot)[0];
  } catch (e) {
    throw new Error(`[pdfviewer-no-eventbus-on-in-components] failed to resolve merge-base for ${baseRef}`);
  }

  const changed = execGitLines(["diff", "--name-only", `${mergeBase}..HEAD`], absRoot)
    .map((p) => toPosixPath(p));

  const targets = changed.filter((relPath) => isTargetComponentRelPath(relPath) && !isExcludedRelPath(relPath));
  targets.sort();

  const violations = [];
  let scanned = 0;

  for (const relPath of targets) {
    const absPath = path.resolve(absRoot, relPath);
    let text;
    try {
      text = await fs.readFile(absPath, { encoding: "utf8" });
    } catch (e) {
      // 增量扫描基于 git diff：变更中可能包含“已删除/已移动”的路径；此类路径无需扫描。
      if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
        continue;
      }
      throw new Error(`[pdfviewer-no-eventbus-on-in-components] failed to read: ${relPath}`);
    }

    const res = analyzeNoEventbusOnInComponentsGate({ relPath, fileText: text });
    scanned += res.scanned;
    if (res.violations.length > 0) {
      violations.push(...res.violations);
    }
  }

  violations.sort((a, b) => a.path.localeCompare(b.path));

  return { scanned, baseRef, mergeBase, violations };
}

function parseArgs(argv) {
  const args = {
    baseRef: "main",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--base-ref") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --base-ref");
      }
      args.baseRef = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const res = await runPdfviewerNoEventbusOnInComponentsGate({ baseRef: args.baseRef });

  process.stdout.write(
    `[pdfviewer-no-eventbus-on-in-components] scanned=${res.scanned} baseRef=${res.baseRef} mergeBase=${res.mergeBase}\n`
  );

  if (!res.violations || res.violations.length === 0) {
    process.stdout.write("[pdfviewer-no-eventbus-on-in-components] OK\n");
    return;
  }

  process.stdout.write(`[pdfviewer-no-eventbus-on-in-components] FAILED (${res.violations.length})\n`);
  for (const v of res.violations) {
    process.stdout.write(`- [${v.type}] ${v.path}\n`);
  }
  process.exitCode = 1;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  const absEntry = path.resolve(entry);
  return import.meta.url === pathToFileURL(absEntry).href;
}

if (isMainModule()) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`[pdfviewer-no-eventbus-on-in-components] fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}
