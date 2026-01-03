import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  computeWeekOfMonth,
  computeWeekRangeLabel,
  runMemoryBankLimit
} from "../memory-bank-limit.js";

async function mkTmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mb-limit-"));
  return dir;
}

async function writeUtf8(p, text) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, String(text).replace(/\r\n|\r/g, "\n"), { encoding: "utf8" });
}

async function readUtf8(p) {
  return String(await fs.readFile(p, { encoding: "utf8" })).replace(/\r\n|\r/g, "\n");
}

describe("memory-bank-limit", () => {
  test("computeWeekOfMonth aligns to 01-07/08-14 buckets", () => {
    expect(computeWeekOfMonth("2025-12-01")).toBe(1);
    expect(computeWeekOfMonth("2025-12-07")).toBe(1);
    expect(computeWeekOfMonth("2025-12-08")).toBe(2);
    expect(computeWeekOfMonth("2025-12-31")).toBe(5);
  });

  test("computeWeekRangeLabel format", () => {
    expect(computeWeekRangeLabel("2025-12-31")).toBe("12-29 ~ 12-31");
  });

  test("--fix archives outdated sections and updates README", async () => {
    const root = await mkTmpDir();
    const now = new Date(Date.UTC(2025, 11, 31, 0, 0, 0, 0)); // 2025-12-31

    const contextPath = path.join(root, ".kilocode/rules/memory-bank/context.md");
    const readmePath = path.join(root, "docs/context-archive/README.md");

    await writeUtf8(readmePath, [
      "# Context 归档索引",
      "",
      "## 📁 归档文件",
      "",
      "### 2025 年",
      "",
      "#### 11 月",
      "- 📄 第1周（11-01 ~ 11-07）：[context-2025-11-week1.md](2025-11/context-2025-11-week1.md)",
      ""
    ].join("\n"));

    await writeUtf8(contextPath, [
      "# Memory Bank - Context（精简版）",
      "",
      "## 2025-12-30 近7日记录",
      "- keep",
      "",
      "## 2025-12-23 过时记录",
      "- archive-me",
      ""
    ].join("\n"));

    const cwdBefore = process.cwd();
    try {
      process.chdir(root);
      const res = await runMemoryBankLimit({ fix: true, now });
      expect(res.changed).toBe(true);
      expect(res.archivedCount).toBeGreaterThan(0);

      const contextAfter = await readUtf8(contextPath);
      expect(contextAfter).toContain("## 2025-12-30");
      expect(contextAfter).not.toContain("## 2025-12-23");

      const archiveFile = path.join(root, "docs/context-archive/2025-12/context-2025-12-week4.md");
      const archiveText = await readUtf8(archiveFile);
      expect(archiveText).toContain("### 2025-12-23");

      const readmeAfter = await readUtf8(readmePath);
      expect(readmeAfter).toContain("#### 12 月");
      expect(readmeAfter).toContain("context-2025-12-week4.md");
    } finally {
      process.chdir(cwdBefore);
    }
  });
});

