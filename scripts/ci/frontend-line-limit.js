import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { runFeatureInternalEventbusGates } from "./feature-internal-eventbus-gates.js";
import { runPdfviewerGlobalListenerGates } from "./pdfviewer-global-listener-gates.js";

const DEFAULT_LIMIT = 500;
const DEFAULT_ROOT_DIR = "src/frontend";
const DEFAULT_BASELINE_PATH = "scripts/ci/baselines/frontend-line-limit.json";

function toPosixPath(p) {
  return p.split(path.sep).join("/");
}

export function countLines(text) {
  if (text.length === 0) {
    return 0;
  }

  const parts = text.split(/\r\n|\r|\n/);
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts.length;
}

export function isExcludedRelPath(relPath) {
  const p = relPath.replaceAll("\\", "/");
  return (
    p.includes("/dist/") ||
    p.includes("/__tests__/") ||
    p.includes("/__smoke__/") ||
    p.startsWith("src/frontend/dist/")
  );
}

export function isSourceFileRelPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext);
}

export function computeViolations({ fileLineCounts, baseline, limit }) {
  const violations = [];

  for (const [relPath, lines] of Object.entries(fileLineCounts)) {
    if (lines <= limit) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(baseline, relPath)) {
      const baselineLines = baseline[relPath];
      if (lines > baselineLines) {
        violations.push({
          type: "grown-baseline",
          path: relPath,
          baselineLines,
          lines
        });
      }
      continue;
    }

    violations.push({
      type: "new-over-limit",
      path: relPath,
      limit,
      lines
    });
  }

  violations.sort((a, b) => a.path.localeCompare(b.path));
  return violations;
}

async function walkDir(absDir, absRoot, relFilePaths) {
  const dirEntries = await fs.readdir(absDir, { withFileTypes: true });

  for (const entry of dirEntries) {
    const absPath = path.join(absDir, entry.name);
    const relPath = toPosixPath(path.relative(absRoot, absPath));

    if (entry.isDirectory()) {
      if (isExcludedRelPath(relPath) || entry.name === "node_modules") {
        continue;
      }
      await walkDir(absPath, absRoot, relFilePaths);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }
    if (!isSourceFileRelPath(relPath)) {
      continue;
    }
    if (isExcludedRelPath(relPath)) {
      continue;
    }

    relFilePaths.push(relPath);
  }
}

async function readJsonFile(absPath) {
  const raw = await fs.readFile(absPath, "utf8");
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
    rootDir: DEFAULT_ROOT_DIR,
    baselinePath: DEFAULT_BASELINE_PATH,
    writeBaseline: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--write-baseline") {
      args.writeBaseline = true;
      continue;
    }

    if (token === "--limit") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --limit");
      }
      const n = Number.parseInt(next, 10);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid --limit: ${next}`);
      }
      args.limit = n;
      i += 1;
      continue;
    }

    if (token === "--root") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --root");
      }
      args.rootDir = next;
      i += 1;
      continue;
    }

    if (token === "--baseline") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --baseline");
      }
      args.baselinePath = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown arg: ${token}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const absRoot = process.cwd();
  const absScanRoot = path.resolve(absRoot, args.rootDir);
  const absBaseline = path.resolve(absRoot, args.baselinePath);

  const relFilePaths = [];
  await walkDir(absScanRoot, absRoot, relFilePaths);
  relFilePaths.sort();

  const fileLineCounts = {};
  for (const relPath of relFilePaths) {
    const absPath = path.resolve(absRoot, relPath);
    const text = await fs.readFile(absPath, "utf8");
    fileLineCounts[relPath] = countLines(text);
  }

  const baseline = await readJsonFile(absBaseline);
  if (baseline === null || typeof baseline !== "object" || Array.isArray(baseline)) {
    throw new Error(`Baseline must be a JSON object: ${args.baselinePath}`);
  }
  for (const [k, v] of Object.entries(baseline)) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`Baseline value must be a number: ${k}=${String(v)}`);
    }
  }

  if (args.writeBaseline) {
    const nextBaseline = {};
    for (const [relPath, lines] of Object.entries(fileLineCounts)) {
      if (lines > args.limit) {
        nextBaseline[relPath] = lines;
      }
    }

    const sorted = Object.fromEntries(
      Object.entries(nextBaseline).sort(([a], [b]) => a.localeCompare(b))
    );
    await fs.writeFile(absBaseline, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
    process.stdout.write(
      `[frontend-line-limit] baseline written: ${args.baselinePath} (${Object.keys(sorted).length} files)\n`
    );
    return;
  }

  const violations = computeViolations({
    fileLineCounts,
    baseline,
    limit: args.limit
  });

  process.stdout.write(
    `[frontend-line-limit] scanned=${relFilePaths.length} limit=${args.limit} baseline=${Object.keys(baseline).length}\n`
  );

  if (violations.length === 0) {
    process.stdout.write("[frontend-line-limit] OK\n");

    // ✅ Feature 内部 EventBus 订阅增量门禁（不改 package.json，复用 lint 流程）
    try {
      const res = await runFeatureInternalEventbusGates();
      process.stdout.write(
        `[feature-internal-eventbus-gates] scanned=${res.scanned} baseline=${res.baselineSize}\n`
      );
      if (!res.violations || res.violations.length === 0) {
        process.stdout.write("[feature-internal-eventbus-gates] OK\n");
      } else {
        process.stdout.write(`[feature-internal-eventbus-gates] FAILED (${res.violations.length})\n`);
        for (const v of res.violations) {
          if (v.type === "new-subscription") {
            process.stdout.write(`- [NEW] ${v.path} subscriptions=${v.count}\n`);
            continue;
          }
          process.stdout.write(`- [GROWN] ${v.path} baseline=${v.baselineCount} now=${v.count}\n`);
        }
        process.exitCode = 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack ?? e.message : String(e);
      process.stderr.write(`[feature-internal-eventbus-gates] fatal: ${msg}\n`);
      process.exitCode = 1;
    }

    // ✅ pdf-viewer 全局监听增量门禁（window/document.addEventListener 统一入口）
    try {
      const res = await runPdfviewerGlobalListenerGates();
      process.stdout.write(
        `[pdfviewer-global-listener-gates] scanned=${res.scanned} baseline=${res.baselineSize}\n`
      );
      if (!res.violations || res.violations.length === 0) {
        process.stdout.write("[pdfviewer-global-listener-gates] OK\n");
      } else {
        process.stdout.write(`[pdfviewer-global-listener-gates] FAILED (${res.violations.length})\n`);
        for (const v of res.violations) {
          if (v.type === "new-direct-listener") {
            process.stdout.write(`- [NEW] ${v.path} addEventListener=${v.count}\n`);
            continue;
          }
          process.stdout.write(`- [GROWN] ${v.path} baseline=${v.baselineCount} now=${v.count}\n`);
        }
        process.exitCode = 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack ?? e.message : String(e);
      process.stderr.write(`[pdfviewer-global-listener-gates] fatal: ${msg}\n`);
      process.exitCode = 1;
    }
    return;
  }

  process.stdout.write(`[frontend-line-limit] FAILED (${violations.length})\n`);
  for (const v of violations) {
    if (v.type === "new-over-limit") {
      process.stdout.write(`- [NEW>${v.limit}] ${v.path} lines=${v.lines}\n`);
      continue;
    }
    process.stdout.write(`- [GROWN] ${v.path} baseline=${v.baselineLines} now=${v.lines}\n`);
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
    process.stderr.write(`[frontend-line-limit] fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}
