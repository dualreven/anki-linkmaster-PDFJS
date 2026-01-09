import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_ROOT_DIR = "src/frontend/pdf-viewer";
const DEFAULT_BASELINE_PATH = "scripts/ci/baselines/pdfviewer-global-listener-gates.json";

function toPosixPath(p) {
  return p.split(path.sep).join("/");
}

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n|\r/g, "\n");
}

export function isExcludedRelPath(relPath) {
  const p = relPath.replaceAll("\\", "/");
  return (
    p.includes("/dist/") ||
    p.includes("/__tests__/") ||
    p.includes("/__smoke__/") ||
    p.includes("/fixtures/") ||
    p.includes("/docs/") ||
    p.includes("/SPEC/") ||
    p.startsWith("src/frontend/dist/")
  );
}

export function isSourceFileRelPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext);
}

export function isAllowedDirectUsageRelPath(relPath) {
  // 统一入口：允许在此文件内直接使用 window/document.addEventListener
  return relPath.replaceAll("\\", "/") === "src/frontend/pdf-viewer/core/global-listener-scope.js";
}

export function countGlobalListenerAddsInText(text) {
  const normalized = normalizeNewlines(text);
  const re = /\b(?:window|document)\s*\.\s*addEventListener\s*\(/g;
  return (normalized.match(re) || []).length;
}

export function computeViolations({ fileCounts, baseline }) {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    throw new Error("[pdfviewer-global-listener-gates] baseline must be a JSON object");
  }

  const violations = [];
  for (const [relPath, count] of Object.entries(fileCounts)) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`[pdfviewer-global-listener-gates] invalid count: ${relPath}=${String(count)}`);
    }

    if (n === 0) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(baseline, relPath)) {
      const base = baseline[relPath];
      if (typeof base !== "number" || !Number.isFinite(base) || base < 0) {
        throw new Error(`[pdfviewer-global-listener-gates] invalid baseline value: ${relPath}=${String(base)}`);
      }
      if (n > base) {
        violations.push({ type: "grown-baseline", path: relPath, baselineCount: base, count: n });
      }
      continue;
    }

    violations.push({ type: "new-direct-listener", path: relPath, count: n });
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
    if (isAllowedDirectUsageRelPath(relPath)) {
      continue;
    }

    relFilePaths.push(relPath);
  }
}

async function readJsonFile(absPath) {
  const raw = await fs.readFile(absPath, { encoding: "utf8" });
  return JSON.parse(raw);
}

async function writeJsonFile(absPath, obj) {
  const text = `${JSON.stringify(obj, null, 2)}\n`;
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, text, { encoding: "utf8" });
}

function parseArgs(argv) {
  const args = {
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

export async function runPdfviewerGlobalListenerGates({
  rootDir = DEFAULT_ROOT_DIR,
  baselinePath = DEFAULT_BASELINE_PATH,
  writeBaseline = false,
  repoRoot = process.cwd(),
} = {}) {
  const absRoot = path.resolve(repoRoot);
  const absScanRoot = path.resolve(absRoot, rootDir);
  const absBaseline = path.resolve(absRoot, baselinePath);

  const relFilePaths = [];
  await walkDir(absScanRoot, absRoot, relFilePaths);
  relFilePaths.sort();

  const fileCounts = {};
  for (const relPath of relFilePaths) {
    const absPath = path.resolve(absRoot, relPath);
    const text = await fs.readFile(absPath, { encoding: "utf8" });
    fileCounts[relPath] = countGlobalListenerAddsInText(text);
  }

  if (writeBaseline) {
    const nextBaseline = {};
    for (const [relPath, count] of Object.entries(fileCounts)) {
      if (count > 0) {
        nextBaseline[relPath] = count;
      }
    }
    const sorted = Object.fromEntries(
      Object.entries(nextBaseline).sort(([a], [b]) => a.localeCompare(b))
    );
    await writeJsonFile(absBaseline, sorted);
    return { mode: "write-baseline", scanned: relFilePaths.length, baselineSize: Object.keys(sorted).length };
  }

  const baseline = await readJsonFile(absBaseline);
  const violations = computeViolations({ fileCounts, baseline });

  return {
    mode: "check",
    scanned: relFilePaths.length,
    baselineSize: Object.keys(baseline || {}).length,
    violations
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const res = await runPdfviewerGlobalListenerGates({
    rootDir: args.rootDir,
    baselinePath: args.baselinePath,
    writeBaseline: args.writeBaseline
  });

  if (res.mode === "write-baseline") {
    process.stdout.write(
      `[pdfviewer-global-listener-gates] baseline written: ${args.baselinePath} (${res.baselineSize} files)\n`
    );
    return;
  }

  process.stdout.write(
    `[pdfviewer-global-listener-gates] scanned=${res.scanned} baseline=${res.baselineSize}\n`
  );

  if (!res.violations || res.violations.length === 0) {
    process.stdout.write("[pdfviewer-global-listener-gates] OK\n");
    return;
  }

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
    process.stderr.write(`[pdfviewer-global-listener-gates] fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}

