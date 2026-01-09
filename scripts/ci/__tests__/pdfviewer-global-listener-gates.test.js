import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  computeViolations,
  countGlobalListenerAddsInText,
  runPdfviewerGlobalListenerGates,
} from "../pdfviewer-global-listener-gates.js";

async function mkTmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "global-listener-gates-"));
  return dir;
}

async function writeUtf8(p, text) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const normalized = String(text).replace(/\r\n|\r/g, "\n");
  await fs.writeFile(p, normalized, { encoding: "utf8" });
}

describe("pdfviewer-global-listener-gates", () => {
  test("countGlobalListenerAddsInText counts window/document.addEventListener", () => {
    const code = [
      "window.addEventListener('error', () => {});",
      "document.addEventListener('click', () => {});",
      "el.addEventListener('click', () => {});",
      ""
    ].join("\n");
    expect(countGlobalListenerAddsInText(code)).toBe(2);
  });

  test("computeViolations blocks NEW and GROWN, allows unchanged", () => {
    const baseline = {
      "src/frontend/pdf-viewer/a.js": 1
    };

    const fileCounts = {
      "src/frontend/pdf-viewer/a.js": 2,
      "src/frontend/pdf-viewer/b.js": 1,
      "src/frontend/pdf-viewer/c.js": 0
    };

    expect(computeViolations({ fileCounts, baseline })).toEqual([
      {
        type: "grown-baseline",
        path: "src/frontend/pdf-viewer/a.js",
        baselineCount: 1,
        count: 2
      },
      {
        type: "new-direct-listener",
        path: "src/frontend/pdf-viewer/b.js",
        count: 1
      }
    ]);
  });

  test("runPdfviewerGlobalListenerGates supports write-baseline and check", async () => {
    const root = await mkTmpDir();
    const repoRoot = root;

    const rootDir = "src/frontend/pdf-viewer";
    const baselinePath = "scripts/ci/baselines/pdfviewer-global-listener-gates.json";

    await writeUtf8(path.join(root, "src/frontend/pdf-viewer/a.js"), [
      "window.addEventListener('error', () => {});",
      ""
    ].join("\n"));

    const written = await runPdfviewerGlobalListenerGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: true
    });
    expect(written.mode).toBe("write-baseline");

    const checked = await runPdfviewerGlobalListenerGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: false
    });
    expect(checked.mode).toBe("check");
    expect(checked.violations.length).toBe(0);

    await writeUtf8(path.join(root, "src/frontend/pdf-viewer/a.js"), [
      "window.addEventListener('error', () => {});",
      "document.addEventListener('click', () => {});",
      ""
    ].join("\n"));

    const checked2 = await runPdfviewerGlobalListenerGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: false
    });
    expect(checked2.violations.length).toBe(1);
    expect(checked2.violations[0].type).toBe("grown-baseline");
  });
});

