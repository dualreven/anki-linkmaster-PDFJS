import { describe, expect, test } from "@jest/globals";

import {
  analyzeNoEventbusOnInComponentsGate,
} from "../pdfviewer-no-eventbus-on-in-components-gate.js";

describe("pdfviewer-no-eventbus-on-in-components-gate", () => {
  test("fails when components contains eventBus.on", () => {
    const res = analyzeNoEventbusOnInComponentsGate({
      relPath: "src/frontend/pdf-viewer/features/x/components/a.js",
      fileText: "eventBus.on('x', () => {});\n",
    });
    expect(res.violations.length).toBe(1);
    expect(res.violations[0].type).toBe("forbidden-on-in-components");
  });

  test("fails when components contains this.#eventBus.on", () => {
    const res = analyzeNoEventbusOnInComponentsGate({
      relPath: "src/frontend/pdf-viewer/features/x/components/a.js",
      fileText: "this.#eventBus.on('x', () => {});\n",
    });
    expect(res.violations.length).toBe(1);
  });

  test("passes for subscriptions path", () => {
    const res = analyzeNoEventbusOnInComponentsGate({
      relPath: "src/frontend/pdf-viewer/features/x/subscriptions/a.js",
      fileText: "eventBus.on('x', () => {});\n",
    });
    expect(res.violations).toEqual([]);
  });

  test("passes when no forbidden pattern", () => {
    const res = analyzeNoEventbusOnInComponentsGate({
      relPath: "src/frontend/pdf-viewer/features/x/components/a.js",
      fileText: "pdfjsEventBus.on('pagerendered', () => {});\n",
    });
    expect(res.violations).toEqual([]);
  });
});

