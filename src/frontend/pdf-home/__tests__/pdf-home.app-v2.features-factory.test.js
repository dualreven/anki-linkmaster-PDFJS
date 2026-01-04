/**
 * @jest-environment jsdom
 *
 * 目的：为 pdf-home-app-v2 的“功能域列表外移/拆分”提供最小回归保护。
 * - 断言：features 列表中不应出现已移除的 pdf-editor
 * - 断言：必须包含 pdf-edit（统一编辑入口）
 */

import { describe, test, expect } from "@jest/globals";
import { createPDFHomeAppV2Features } from "../core/pdf-home-app-v2-features.js";

describe("pdf-home v2 — features factory", () => {
  test("features 列表不包含 pdf-editor，且包含 pdf-edit", () => {
    const features = createPDFHomeAppV2Features();
    const names = features.map((f) => f?.name).filter(Boolean);

    expect(names.includes("pdf-editor")).toBe(false);
    expect(names.includes("pdf-edit")).toBe(true);
  });
});

