import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_TARGET_PATH = "src/frontend/pdf-viewer/features/pdf-annotation/models/annotation.js";
const EXPECTED_SOURCE_PATH = "../../../../common/models/annotation.js";

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n|\r/g, "\n");
}

export function stripComments(text) {
  const normalized = normalizeNewlines(text);
  const withoutBlock = normalized.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlock.replace(/^\s*\/\/.*$/gm, "");
}

export function analyzeAnnotationSingleSourceGuard({ fileText, targetRelPath } = {}) {
  if (typeof fileText !== "string") {
    throw new Error("[pdfviewer-annotation-single-source-guard] fileText must be a string");
  }
  if (!targetRelPath) {
    throw new Error("[pdfviewer-annotation-single-source-guard] targetRelPath is required");
  }

  const violations = [];
  const normalized = normalizeNewlines(fileText);

  if (/\bimport\s+/.test(normalized)) {
    violations.push({
      type: "has-import",
      path: targetRelPath,
      message: "feature-side annotation model must be pure re-export (no import statements)"
    });
  }

  if (/\bexport\s+default\b/.test(normalized)) {
    violations.push({
      type: "has-export-default",
      path: targetRelPath,
      message: "feature-side annotation model must not use export default"
    });
  }

  const forbidden = [
    { type: "has-class-annotation", re: /\bclass\s+Annotation\b/ },
    { type: "has-export-class-annotation", re: /\bexport\s+class\s+Annotation\b/ },
    { type: "has-generate-annotation-id", re: /\bfunction\s+generateAnnotationId\b/ },
    { type: "has-generate-base64url16", re: /\bfunction\s+generateBase64Url16\b/ },
    { type: "has-annotation-type-const", re: /\bconst\s+AnnotationType\b/ },
    { type: "has-highlight-color-const", re: /\bconst\s+HighlightColor\b/ },
  ];

  for (const f of forbidden) {
    if (f.re.test(normalized)) {
      violations.push({
        type: f.type,
        path: targetRelPath,
        message: "feature-side annotation model must not define implementation symbols"
      });
    }
  }

  let code = stripComments(normalized).trim();

  const exportFromRe = /export\s*(?:\*|\{[\s\S]*?\})\s*from\s*["']([^"']+)["']\s*;?/g;
  let exportFromCount = 0;
  code = code.replace(exportFromRe, (m, fromPath) => {
    exportFromCount += 1;
    if (fromPath !== EXPECTED_SOURCE_PATH) {
      violations.push({
        type: "invalid-export-source",
        path: targetRelPath,
        from: fromPath,
        expected: EXPECTED_SOURCE_PATH
      });
    }
    return "";
  }).trim();

  if (exportFromCount === 0) {
    violations.push({
      type: "missing-export-from",
      path: targetRelPath,
      message: "feature-side annotation model must re-export from common"
    });
  }

  if (code.length > 0) {
    violations.push({
      type: "has-non-export-code",
      path: targetRelPath,
      message: "feature-side annotation model must contain only export-from statements"
    });
  }

  return { scanned: 1, violations };
}

export async function runPdfviewerAnnotationSingleSourceGuard({
  targetRelPath = DEFAULT_TARGET_PATH,
  repoRoot = process.cwd(),
} = {}) {
  const absRoot = path.resolve(repoRoot);
  const absTarget = path.resolve(absRoot, targetRelPath);

  let text;
  try {
    text = await fs.readFile(absTarget, { encoding: "utf8" });
  } catch (e) {
    throw new Error(
      `[pdfviewer-annotation-single-source-guard] failed to read target: ${targetRelPath} (${e instanceof Error ? e.message : String(e)})`
    );
  }

  return analyzeAnnotationSingleSourceGuard({ fileText: text, targetRelPath });
}

function parseArgs(argv) {
  const args = {
    target: DEFAULT_TARGET_PATH
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--target") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --target");
      }
      args.target = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const res = await runPdfviewerAnnotationSingleSourceGuard({ targetRelPath: args.target });
  process.stdout.write(
    `[pdfviewer-annotation-single-source-guard] scanned=${res.scanned} target=${args.target}\n`
  );

  if (!res.violations || res.violations.length === 0) {
    process.stdout.write("[pdfviewer-annotation-single-source-guard] OK\n");
    return;
  }

  process.stdout.write(`[pdfviewer-annotation-single-source-guard] FAILED (${res.violations.length})\n`);
  for (const v of res.violations) {
    if (v.type === "invalid-export-source") {
      process.stdout.write(`- [BAD SOURCE] ${v.path} from=${v.from} expected=${v.expected}\n`);
      continue;
    }
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
    process.stderr.write(`[pdfviewer-annotation-single-source-guard] fatal: ${msg}\n`);
    process.exitCode = 1;
  });
}

