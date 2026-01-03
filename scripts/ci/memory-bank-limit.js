import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_CONTEXT_PATH = ".kilocode/rules/memory-bank/context.md";
const DEFAULT_ARCHIVE_ROOT = "docs/context-archive";
const DEFAULT_ARCHIVE_README = "docs/context-archive/README.md";
const DEFAULT_MAX_LINES = 200;
const DEFAULT_KEEP_DAYS = 7;

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n|\r/g, "\n");
}

export function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  const parts = text.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts.length;
}

export function parseDateFromHeadingLine(line) {
  const m = /^##\s+(\d{4}-\d{2}-\d{2})\b/.exec(line);
  if (!m) {
    return null;
  }
  return m[1];
}

export function parseYmdToUtcDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) {
    throw new Error(`[memory-bank] invalid YYYY-MM-DD: ${ymd}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`[memory-bank] invalid date: ${ymd}`);
  }
  return dt;
}

export function computeWeekOfMonth(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) {
    throw new Error(`[memory-bank] invalid YYYY-MM-DD: ${ymd}`);
  }
  const day = Number(m[3]);
  if (!Number.isInteger(day) || day <= 0) {
    throw new Error(`[memory-bank] invalid day in date: ${ymd}`);
  }
  return Math.floor((day - 1) / 7) + 1;
}

export function daysInMonthUtc(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`[memory-bank] invalid year/month: ${year}-${month}`);
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function computeWeekRangeLabel(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) {
    throw new Error(`[memory-bank] invalid YYYY-MM-DD: ${ymd}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const week = computeWeekOfMonth(ymd);
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, daysInMonthUtc(year, month));
  const mm = String(month).padStart(2, "0");
  const sd = String(startDay).padStart(2, "0");
  const ed = String(endDay).padStart(2, "0");
  return `${mm}-${sd} ~ ${mm}-${ed}`;
}

export function splitContextIntoDatedSections(text) {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");
  const indices = [];
  for (let i = 0; i < lines.length; i++) {
    if (parseDateFromHeadingLine(lines[i])) {
      indices.push(i);
    }
  }

  if (indices.length === 0) {
    return { preamble: normalized, sections: [] };
  }

  const preamble = lines.slice(0, indices[0]).join("\n");
  const sections = [];
  for (let s = 0; s < indices.length; s++) {
    const start = indices[s];
    const end = s + 1 < indices.length ? indices[s + 1] : lines.length;
    const headerLine = lines[start];
    const ymd = parseDateFromHeadingLine(headerLine);
    if (!ymd) {
      throw new Error(`[memory-bank] internal: expected dated heading at line ${start + 1}`);
    }
    sections.push({
      ymd,
      headerLine,
      body: lines.slice(start + 1, end).join("\n"),
      raw: lines.slice(start, end).join("\n")
    });
  }

  return { preamble, sections };
}

export function computeCutoffUtc({ nowUtc = new Date(), keepDays = DEFAULT_KEEP_DAYS } = {}) {
  if (!Number.isInteger(keepDays) || keepDays <= 0) {
    throw new Error(`[memory-bank] keepDays must be positive integer, got ${keepDays}`);
  }
  const dt = new Date(nowUtc.getTime());
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() - keepDays);
  return dt;
}

export function shouldArchiveSection({ ymd, cutoffUtc }) {
  const dt = parseYmdToUtcDate(ymd);
  return dt.getTime() < cutoffUtc.getTime();
}

function buildArchiveFileHeader({ year, month, week, weekRangeLabel, todayYmd }) {
  const mm = String(month).padStart(2, "0");
  return [
    `# Context 归档 - ${year}年${mm}月第${week}周（${weekRangeLabel}）`,
    "",
    `**归档日期**：${todayYmd}`,
    "**来源**：从 context.md 迁移的历史记录",
    "",
    "---",
    ""
  ].join("\n");
}

export function formatArchivedSection({ ymd, headerLine, body }) {
  const title = String(headerLine || "").replace(/^##\s+/, "").trim();
  const lines = [];
  lines.push(`### ${ymd}`);
  if (title && title !== ymd) {
    lines.push(`- 原标题：${title}`);
  }
  lines.push("");
  if (body && body.trim()) {
    lines.push(body.replace(/^\n+/, "").replace(/\n+$/, ""));
    lines.push("");
  }
  return lines.join("\n");
}

async function ensureDir(absDir) {
  await fs.mkdir(absDir, { recursive: true });
}

async function fileExists(absPath) {
  try {
    await fs.stat(absPath);
    return true;
  } catch {
    return false;
  }
}

async function readUtf8(absPath) {
  const raw = await fs.readFile(absPath, { encoding: "utf8" });
  return normalizeNewlines(raw);
}

async function writeUtf8(absPath, text) {
  await fs.writeFile(absPath, normalizeNewlines(text), { encoding: "utf8" });
}

async function appendUniqueArchiveEntries({ archiveAbsPath, entries, header }) {
  const exists = await fileExists(archiveAbsPath);
  const current = exists ? await readUtf8(archiveAbsPath) : "";
  const out = [];

  let base = current;
  if (!exists) {
    base = header;
  }

  const existing = base;
  for (const entry of entries) {
    const ymd = entry.ymd;
    if (existing.includes(`### ${ymd}`)) {
      continue;
    }
    out.push(entry.text);
  }

  if (out.length === 0) {
    if (!exists) {
      await writeUtf8(archiveAbsPath, base);
      return { wrote: true, appended: 0 };
    }
    return { wrote: false, appended: 0 };
  }

  const combined = (base.replace(/\n+$/, "") + "\n\n" + out.join("\n")).replace(/\n+$/, "") + "\n";
  await writeUtf8(archiveAbsPath, combined);
  return { wrote: true, appended: out.length };
}

export function upsertArchiveReadmeLink({ readmeText, year, month, week, weekRangeLabel, fileRelPath }) {
  const normalized = normalizeNewlines(readmeText);
  const lines = normalized.split("\n");

  const monthLabel = `${month} 月`;
  const yearHeader = `${year} 年`;
  const weekLine = `- 📄 第${week}周（${weekRangeLabel}）：[${path.basename(fileRelPath)}](${fileRelPath.replaceAll("\\", "/")})`;

  const yearIdx = lines.findIndex((l) => l.trim() === `### ${yearHeader}`);
  if (yearIdx < 0) {
    throw new Error(`[memory-bank] README missing year header: ### ${yearHeader}`);
  }

  const computeYearEnd = () => {
    for (let i = yearIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith("### ")) {
        return i;
      }
    }
    return lines.length;
  };
  let yearEnd = computeYearEnd();

  // 在 year 区块内找 month header
  const monthHeader = `#### ${monthLabel}`;
  let monthIdx = -1;
  for (let i = yearIdx + 1; i < yearEnd; i++) {
    if (lines[i].trim() === monthHeader) {
      monthIdx = i;
      break;
    }
  }

  if (monthIdx < 0) {
    // 插入一个新的 month 区块，按降序（12→1）尽量插在正确位置
    const desired = month;
    let insertAt = yearEnd;
    for (let i = yearIdx + 1; i < yearEnd; i++) {
      const m = /^####\s+(\d{1,2})\s+月\s*$/.exec(lines[i].trim());
      if (m) {
        const existingMonth = Number(m[1]);
        if (Number.isInteger(existingMonth) && existingMonth < desired) {
          insertAt = i;
          break;
        }
      }
    }
    lines.splice(insertAt, 0, "", monthHeader);
    monthIdx = insertAt + 1; // monthHeader index after leading blank
    yearEnd = computeYearEnd();
  }

  // month 区块范围：到下一个 #### 或 ### 或 EOF
  let monthEnd = yearEnd;
  for (let i = monthIdx + 1; i < yearEnd; i++) {
    const t = lines[i].trim();
    if (t.startsWith("#### ") && i !== monthIdx) { monthEnd = i; break; }
  }

  // 若已存在该 weekLine，直接返回
  const already = lines.slice(monthIdx + 1, monthEnd).some((l) => l.trim() === weekLine.trim());
  if (already) {
    return normalized;
  }

  // 插入 weekLine：保持 week 从小到大
  let insertWeekAt = monthEnd;
  for (let i = monthIdx + 1; i < monthEnd; i++) {
    const m = /^-\s+📄\s+第(\d+)周/.exec(lines[i].trim());
    if (m) {
      const existingWeek = Number(m[1]);
      if (Number.isInteger(existingWeek) && existingWeek > week) {
        insertWeekAt = i;
        break;
      }
    }
  }
  lines.splice(insertWeekAt, 0, weekLine);

  return lines.join("\n");
}

export async function runMemoryBankLimit({ fix = false, now = new Date() } = {}) {
  const repoRoot = process.cwd();
  const contextAbsPath = path.resolve(repoRoot, DEFAULT_CONTEXT_PATH);
  const archiveRootAbs = path.resolve(repoRoot, DEFAULT_ARCHIVE_ROOT);
  const readmeAbs = path.resolve(repoRoot, DEFAULT_ARCHIVE_README);

  const raw = await readUtf8(contextAbsPath);
  const beforeLines = countLines(raw);
  const cutoffUtc = computeCutoffUtc({ nowUtc: now, keepDays: DEFAULT_KEEP_DAYS });

  const { preamble, sections } = splitContextIntoDatedSections(raw);
  if (sections.length === 0) {
    // 无法自动归档：没有可识别的日期段
    if (beforeLines > DEFAULT_MAX_LINES) {
      throw new Error(`[memory-bank] context.md lines=${beforeLines} > ${DEFAULT_MAX_LINES} but no dated sections found; cannot auto-compress`);
    }
    return { changed: false, beforeLines, afterLines: beforeLines, archivedCount: 0 };
  }

  const toArchive = sections.filter((s) => shouldArchiveSection({ ymd: s.ymd, cutoffUtc }));
  const keep = sections.filter((s) => !shouldArchiveSection({ ymd: s.ymd, cutoffUtc }));

  const overLineLimit = beforeLines > DEFAULT_MAX_LINES;
  const needsArchive = toArchive.length > 0 || overLineLimit;
  if (!needsArchive) {
    return { changed: false, beforeLines, afterLines: beforeLines, archivedCount: 0 };
  }

  if (!fix) {
    throw new Error(`[memory-bank] context.md exceeds limits (lines=${beforeLines}, outdatedSections=${toArchive.length}); run with --fix`);
  }

  // 若仅因行数超限但没有过时内容，无法自动归档（需人工压缩近7天内容）
  if (toArchive.length === 0 && overLineLimit) {
    throw new Error(`[memory-bank] context.md lines=${beforeLines} > ${DEFAULT_MAX_LINES} but no outdated sections (> ${DEFAULT_KEEP_DAYS} days) to archive; manual compression required`);
  }

  // 归档过时段
  const todayYmd = (() => {
    const d = new Date(now.getTime());
    d.setUTCHours(0, 0, 0, 0);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const archiveByFile = new Map();
  for (const sec of toArchive) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sec.ymd);
    if (!m) { throw new Error(`[memory-bank] invalid ymd in section: ${sec.ymd}`); }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const week = computeWeekOfMonth(sec.ymd);
    const yyyyMm = `${m[1]}-${m[2]}`;
    const weekRangeLabel = computeWeekRangeLabel(sec.ymd);
    const relArchiveFile = path.join(DEFAULT_ARCHIVE_ROOT, yyyyMm, `context-${yyyyMm}-week${week}.md`);
    const absArchiveFile = path.resolve(repoRoot, relArchiveFile);

    const entryText = formatArchivedSection({ ymd: sec.ymd, headerLine: sec.headerLine, body: sec.body });
    const list = archiveByFile.get(absArchiveFile) || [];
    list.push({ ymd: sec.ymd, text: entryText, year, month, week, weekRangeLabel, relArchiveFile });
    archiveByFile.set(absArchiveFile, list);
  }

  const readmeBefore = await readUtf8(readmeAbs);
  let readmeAfter = readmeBefore;

  const archivedFiles = [];
  let archivedCount = 0;
  for (const [absArchiveFile, entries] of archiveByFile.entries()) {
    const first = entries[0];
    const archiveDir = path.dirname(absArchiveFile);
    await ensureDir(archiveDir);
    const header = buildArchiveFileHeader({
      year: first.year,
      month: first.month,
      week: first.week,
      weekRangeLabel: first.weekRangeLabel,
      todayYmd
    });

    const res = await appendUniqueArchiveEntries({ archiveAbsPath: absArchiveFile, entries, header });
    archivedCount += res.appended;
    archivedFiles.push({ abs: absArchiveFile, rel: first.relArchiveFile, ...first });

    // README：插入链接（幂等）
    readmeAfter = upsertArchiveReadmeLink({
      readmeText: readmeAfter,
      year: first.year,
      month: first.month,
      week: first.week,
      weekRangeLabel: first.weekRangeLabel,
      fileRelPath: path.relative(path.dirname(readmeAbs), absArchiveFile)
    });
  }

  if (readmeAfter !== readmeBefore) {
    await writeUtf8(readmeAbs, readmeAfter.replace(/\n+$/, "") + "\n");
  }

  // 写回 context.md（保留 preamble + keep）
  const newContext = [
    preamble.replace(/\n+$/, ""),
    keep.map((s) => s.raw.replace(/\n+$/, "")).join("\n\n")
  ]
    .filter((p) => p.trim().length > 0)
    .join("\n\n")
    .replace(/\n+$/, "") + "\n";

  await writeUtf8(contextAbsPath, newContext);

  const after = await readUtf8(contextAbsPath);
  const afterLines = countLines(after);
  if (afterLines > DEFAULT_MAX_LINES) {
    throw new Error(`[memory-bank] auto-archive done but context.md still lines=${afterLines} > ${DEFAULT_MAX_LINES}; manual compression required`);
  }

  return {
    changed: true,
    beforeLines,
    afterLines,
    archivedCount,
    archivedFiles: archivedFiles.map((f) => path.relative(repoRoot, f.abs).replaceAll("\\", "/"))
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  try {
    const res = await runMemoryBankLimit({ fix });
    if (res.changed) {
      console.log(`[memory-bank] OK (auto-archived=${res.archivedCount}, lines ${res.beforeLines} -> ${res.afterLines})`);
      if (Array.isArray(res.archivedFiles) && res.archivedFiles.length > 0) {
        console.log(`[memory-bank] archived files:\n- ${res.archivedFiles.join("\n- ")}`);
      }
    } else {
      console.log(`[memory-bank] OK (lines=${res.afterLines})`);
    }
  } catch (e) {
    console.error(String(e?.message || e));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
