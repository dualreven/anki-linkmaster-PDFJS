import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  computeViolations,
  countEventBusSubscriptionsInText,
  extractEventBusBoundAliases,
  runFeatureInternalEventbusGates
} from "../feature-internal-eventbus-gates.js";

async function mkTmpDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eventbus-gates-"));
  return dir;
}

async function writeUtf8(p, text) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const normalized = String(text).replace(/\r\n|\r/g, "\n");
  await fs.writeFile(p, normalized, { encoding: "utf8" });
}

describe("feature-internal-eventbus-gates", () => {
  test("extractEventBusBoundAliases detects bind + destructuring", () => {
    const code = [
      "const onGlobal = this.#eventBus.onGlobal.bind(this.#eventBus);",
      "const { on: on2, once } = eventBus;",
      "onGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {});",
      "on2(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {});",
      "once(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {});",
      ""
    ].join("\n");

    expect(extractEventBusBoundAliases(code)).toEqual(["on2", "onGlobal", "once"]);
  });

  test("countEventBusSubscriptionsInText counts direct + alias calls", () => {
    const code = [
      "eventBus.on(PDF_VIEWER_EVENTS.X, () => {});",
      "this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.Y, () => {});",
      "const onGlobal = this.#eventBus.onGlobal.bind(this.#eventBus);",
      "onGlobal(PDF_VIEWER_EVENTS.Z, () => {});",
      ""
    ].join("\n");

    expect(countEventBusSubscriptionsInText(code)).toBe(3);
  });

  test("computeViolations blocks NEW and GROWN, allows unchanged", () => {
    const baseline = {
      "src/frontend/pdf-viewer/features/a.js": 2
    };

    const fileSubscriptionCounts = {
      "src/frontend/pdf-viewer/features/a.js": 3,
      "src/frontend/pdf-viewer/features/b.js": 1,
      "src/frontend/pdf-viewer/features/c.js": 0
    };

    expect(computeViolations({ fileSubscriptionCounts, baseline })).toEqual([
      {
        type: "grown-baseline",
        path: "src/frontend/pdf-viewer/features/a.js",
        baselineCount: 2,
        count: 3
      },
      {
        type: "new-subscription",
        path: "src/frontend/pdf-viewer/features/b.js",
        count: 1
      }
    ]);
  });

  test("runFeatureInternalEventbusGates supports write-baseline and check", async () => {
    const root = await mkTmpDir();
    const repoRoot = root;

    const rootDir = "src/frontend/pdf-viewer/features";
    const baselinePath = "scripts/ci/baselines/feature-internal-eventbus-gates.json";

    await writeUtf8(path.join(root, "src/frontend/pdf-viewer/features/feat-a.js"), [
      "export function x(eventBus) {",
      "  eventBus.on(PDF_VIEWER_EVENTS.X, () => {});",
      "}",
      ""
    ].join("\n"));

    // 1) write baseline
    const written = await runFeatureInternalEventbusGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: true
    });
    expect(written.mode).toBe("write-baseline");

    // 2) check should pass without violations
    const checked = await runFeatureInternalEventbusGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: false
    });
    expect(checked.mode).toBe("check");
    expect(checked.violations.length).toBe(0);

    // 3) grow subscriptions => violation
    await writeUtf8(path.join(root, "src/frontend/pdf-viewer/features/feat-a.js"), [
      "export function x(eventBus) {",
      "  eventBus.on(PDF_VIEWER_EVENTS.X, () => {});",
      "  eventBus.on(PDF_VIEWER_EVENTS.Y, () => {});",
      "}",
      ""
    ].join("\n"));

    const checked2 = await runFeatureInternalEventbusGates({
      repoRoot,
      rootDir,
      baselinePath,
      writeBaseline: false
    });
    expect(checked2.violations.length).toBe(1);
    expect(checked2.violations[0].type).toBe("grown-baseline");
  });
});

