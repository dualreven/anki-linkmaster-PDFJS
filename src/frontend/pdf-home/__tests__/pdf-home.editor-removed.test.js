/**
 * 目的：确保已移除 pdf-editor 功能域，仅保留 pdf-edit
 * 断言：
 * - PDFHomeAppV2 注册与安装流程中，不包含 "pdf-editor"
 * - 注册列表应包含 "pdf-edit"
 */

import PDFHomeAppV2 from "../core/pdf-home-app-v2.js";

describe("pdf-home/editor-removed", () => {
  test("注册与安装列表均不包含 pdf-editor，仅保留 pdf-edit", async () => {
    const app = new PDFHomeAppV2({ environment: "test" });
    await app.initialize(); // loadFromConfig 会因 jest.setup 的 fetch mock 走默认配置分支

    const state = app.getState();
    expect(Array.isArray(state.features.registered)).toBe(true);
    expect(state.features.registered.includes("pdf-editor")).toBe(false);
    expect(state.features.registered.includes("pdf-edit")).toBe(true);

    // 安装列表可能为空（默认 flags 依赖前端配置/回退），但必须不包含 pdf-editor
    expect(state.features.installed.includes("pdf-editor")).toBe(false);

    // 清理
    await app.destroy();
  });
});

