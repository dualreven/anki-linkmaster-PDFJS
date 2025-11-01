#!/usr/bin/env node
// -*- coding: utf-8 -*-
/**
 * Changed Tests Impact (lightweight)
 * - 输入：git diff 基准（默认 HEAD~1）
 * - 解析：收集“可疑契约符号”（类名/函数名/导出常量/事件字符串/文件路径）
 * - 输出：可能受影响的测试文件清单，并可选执行 Jest
 *
 * 用法：
 *   node -X utf8 scripts/impact/changed-tests.mjs                 # 基于 HEAD~1
 *   node -X utf8 scripts/impact/changed-tests.mjs --base <ref>    # 自定义基准
 *   node -X utf8 scripts/impact/changed-tests.mjs --run           # 找到后直接跑 jest -i
 *
 * 说明：
 * - 仅基于 diff 的启发式分析；不安装额外依赖；
 * - 着重于“契约级”关键词：export class/func/const、PDF_VIEWER_EVENTS 常量字段、字符串事件（:requested/:success等）。
 * - 将结果写入 AItemp/reports/impact-*.md，UTF-8 和 \n。
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

function sh(cmd, opts = {}) {
  const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], ...opts });
  return out.replace(/\r\n/g, "\n");
}

function parseArgs(argv) {
  const args = { base: "HEAD~1", run: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base" && argv[i + 1]) { args.base = argv[++i]; }
    else if (a === "--run") { args.run = true; }
  }
  return args;
}

function collectChangedFiles(base) {
  const diffList = sh(`git diff --name-status ${base} --`, { cwd: process.cwd() }).trim().split("\n").filter(Boolean);
  return diffList.map(line => {
    const [status, file] = line.split(/\s+/, 2);
    return { status, file };
  });
}

function collectChangedSymbols(base) {
  // 只取新增/删除的行，便于捕获“重命名/改名前后的痕迹”
  const diff = sh(`git diff -U0 ${base} --`, { cwd: process.cwd() });
  const add = [], del = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) add.push(line.slice(1));
    if (line.startsWith("-") && !line.startsWith("---")) del.push(line.slice(1));
  }
  const patExports = /\bexport\s+(class|function|const|let|var)\s+([A-Za-z0-9_]+)/g;
  const patEventConst = /\bPDF_VIEWER_EVENTS\b[^\n;]+/g;
  const patEventString = /["'`](?:[a-z0-9-]+:){1,4}(requested|success|failed|completed)["'`]/gi;
  const pick = (lines) => {
    const out = new Set();
    for (const l of lines) {
      let m;
      while ((m = patExports.exec(l))) out.add(m[2]);
      while ((m = patEventConst.exec(l))) out.add(m[0].trim());
      while ((m = patEventString.exec(l))) out.add(m[0].slice(1, -1));
    }
    return Array.from(out);
  };
  return { added: pick(add), removed: pick(del) };
}

function rg(query) {
  try {
    const r = sh(`rg -n --color never -S ${JSON.stringify(query)} src`, { cwd: process.cwd() });
    return r.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function findImpactedTests(symbols, files) {
  const impacted = new Set();
  const addIfTest = (path) => {
    if (path.includes("__tests__") || path.includes("__smoke__")) impacted.add(path.split(":")[0]);
  };
  for (const s of symbols.removed.concat(symbols.added)) {
    const hits = rg(s);
    hits.forEach(addIfTest);
  }
  for (const f of files) {
    // 变更文件本身若在前端 viewer 目录，按约定推测其 tests 路径
    if (f.file.startsWith("src/frontend/pdf-viewer/")) {
      const dir = dirname(f.file);
      const t1 = join(dir, "__tests__");
      const t2 = join(dir, "__smoke__");
      if (existsSync(t1)) impacted.add(t1);
      if (existsSync(t2)) impacted.add(t2);
    }
  }
  return Array.from(impacted);
}

function writeReport(files, symbols, impacted) {
  const reports = join(process.cwd(), "AItemp", "reports");
  mkdirSync(reports, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const path = join(reports, `impact-${ts}.md`);
  const lines = [
    `# Impact Report — ${ts}`,
    "",
    "## Changed Files",
    ...files.map(f => `- ${f.status} ${f.file}`),
    "",
    "## Changed Symbols (added)",
    ...symbols.added.map(s => `- ${s}`),
    "",
    "## Changed Symbols (removed)",
    ...symbols.removed.map(s => `- ${s}`),
    "",
    "## Impacted Tests/Dirs",
    ...(impacted.length ? impacted.map(p => `- ${p}`) : ["- (none)"]),
    ""
  ];
  writeFileSync(path, lines.join("\n"), { encoding: "utf-8" });
  return path;
}

function runJest(paths) {
  if (!paths.length) return { code: 0 };
  const args = ["exec", "jest"].concat(paths).concat(["-i"]);
  const r = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, { stdio: "inherit", cwd: process.cwd() });
  return { code: r.status ?? 1 };
}

function main() {
  const args = parseArgs(process.argv);
  const files = collectChangedFiles(args.base);
  const symbols = collectChangedSymbols(args.base);
  const impacted = findImpactedTests(symbols, files);
  const report = writeReport(files, symbols, impacted);
  console.log(`Report: ${report}`);
  if (args.run) {
    const toRun = impacted.filter(p => p.endsWith(".test.js") || p.endsWith(".smoke.test.js"));
    const rc = runJest(toRun);
    process.exit(rc.code);
  }
}

main();

