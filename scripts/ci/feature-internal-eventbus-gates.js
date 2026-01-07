import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_ROOT_DIR = "src/frontend/pdf-viewer/features";
const DEFAULT_BASELINE_PATH = "scripts/ci/baselines/feature-internal-eventbus-gates.json";

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
    p.startsWith("src/frontend/dist/")
  );
}

export function isSourceFileRelPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext);
}

export function extractEventBusBoundAliases(text) {
  const aliases = new Set();
  const normalized = normalizeNewlines(text);

  // Pattern: const onGlobal = this.#eventBus.onGlobal.bind(this.#eventBus)
  const bindRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:this\s*\.\s*#eventBus|eventBus|globalEventBus|scopedEventBus)\s*\.\s*(?:on|onGlobal|once)\s*\.bind\s*\(/g;
  let m = null;
  while ((m = bindRe.exec(normalized))) {
    aliases.add(m[1]);
  }

  // Pattern: const { onGlobal, on, once } = this.#eventBus
  const destrRe = /\b(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*(?:this\s*\.\s*#eventBus|eventBus|globalEventBus|scopedEventBus)\b/g;
  while ((m = destrRe.exec(normalized))) {
    const inside = m[1];
    for (const raw of inside.split(",")) {
      const token = raw.trim();
      if (!token) {
        continue;
      }
      // handle "onGlobal" or "onGlobal: og"
      const parts = token.split(":").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        aliases.add(parts[0]);
        continue;
      }
      if (parts.length === 2) {
        aliases.add(parts[1]);
      }
    }
  }

  return Array.from(aliases).sort();
}

export function countEventBusSubscriptionsInText(text) {
  const normalized = normalizeNewlines(text);

  // Direct calls: eventBus.on(...) / this.#eventBus.onGlobal(...)
  const directRe = /\b(?:this\s*\.\s*#eventBus|eventBus|globalEventBus|scopedEventBus)\s*\.\s*(?:on|onGlobal|once)\s*\(/g;
  const directCount = (normalized.match(directRe) || []).length;

  // Aliases bound from event bus: onGlobal(...) / on(...)
  const aliases = extractEventBusBoundAliases(normalized);
  let aliasCount = 0;
  for (const name of aliases) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Avoid double-counting ".onGlobal(" style method calls.
    const re = new RegExp(`(?<![\\w$.])${escaped}\\s*\\(`, "g");
    aliasCount += (normalized.match(re) || []).length;
  }

  return directCount + aliasCount;
}

export function computeViolations({ fileSubscriptionCounts, baseline }) {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    throw new Error("[feature-internal-eventbus-gates] baseline must be a JSON object");
  }

  const violations = [];
  for (const [relPath, count] of Object.entries(fileSubscriptionCounts)) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`[feature-internal-eventbus-gates] invalid subscription count: ${relPath}=${String(count)}`);
    }

    if (n === 0) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(baseline, relPath)) {
      const base = baseline[relPath];
      if (typeof base !== "number" || !Number.isFinite(base) || base < 0) {
        throw new Error(`[feature-internal-eventbus-gates] invalid baseline value: ${relPath}=${String(base)}`);
      }
      if (n > base) {
        violations.push({ type: "grown-baseline", path: relPath, baselineCount: base, count: n });
      }
      continue;
    }

    violations.push({ type: "new-subscription", path: relPath, count: n });
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

export async function runFeatureInternalEventbusGates({
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

  const fileSubscriptionCounts = {};
  for (const relPath of relFilePaths) {
    const absPath = path.resolve(absRoot, relPath);
    const text = await fs.readFile(absPath, { encoding: "utf8" });
    fileSubscriptionCounts[relPath] = countEventBusSubscriptionsInText(text);
  }

  if (writeBaseline) {
    const nextBaseline = {};
    for (const [relPath, count] of Object.entries(fileSubscriptionCounts)) {
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
  const violations = computeViolations({ fileSubscriptionCounts, baseline });

  return {
    mode: "check",
    scanned: relFilePaths.length,
    baselineSize: Object.keys(baseline || {}).length,
    violations
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const res = await runFeatureInternalEventbusGates({
    rootDir: args.rootDir,
    baselinePath: args.baselinePath,
    writeBaseline: args.writeBaseline
  });

  if (res.mode === "write-baseline") {
    process.stdout.write(
      `[feature-internal-eventbus-gates] baseline written: ${args.baselinePath} (${res.baselineSize} files)\n`
    );
    return;
  }

  process.stdout.write(
    `[feature-internal-eventbus-gates] scanned=${res.scanned} baseline=${res.baselineSize}\n`
  );

  if (!res.violations || res.violations.length === 0) {
    process.stdout.write("[feature-internal-eventbus-gates] OK\n");
    return;
  }

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
    process.stderr.write(`[feature-internal-eventbus-gates] fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}
