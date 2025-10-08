/* eslint-env node */
/* global describe, test, expect */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Toast usage conformance tests for pdf-viewer
 * 确认 pdf-viewer 下相关文件已改为引用 frontend/common 下的 toast 工具
 * 并且不再直接使用自定义 DOM toast 实现。
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

function readUtf8(p) {
  return readFileSync(p, { encoding: "utf8" });
}

describe("pdf-viewer toast usage", () => {
  const base = resolve(process.cwd(), "src/frontend/pdf-viewer");
  const targets = [
    "features/annotation/components/annotation-sidebar-ui.js",
    "features/pdf-translator/components/TranslatorSidebarUI.js",
    "features/pdf-bookmark/index.js",
    "features/pdf-bookmark/components/bookmark-toolbar.js",
    "features/ui-manager/components/ui-manager-core.js",
    "features/ui-manager/components/ui-layout-controls.js",
  ];

  test.each(targets)("file %s should import common toast and avoid custom DOM toast", (rel) => {
    const p = resolve(base, rel);
    const text = readUtf8(p);

    // 至少引用一个公共 toast 工具
    expect(/common\/utils\/(thirdparty-toast|notification)\.js/.test(text)).toBe(true);

    // 不应再直接调用自定义 this.#showToast()
    expect(text.includes("this.#showToast(")).toBe(false);

    // 不应再通过 toast.textContent 等直接创建 Toast DOM
    expect(text.includes("toast.textContent")).toBe(false);
  });
});
