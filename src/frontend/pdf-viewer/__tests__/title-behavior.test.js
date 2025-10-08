/* eslint-env node */
/* global describe, test, expect */
/**
 * 确认 header 标题的省略与 tooltip 设置。
 * 通过静态断言：
 * - CSS 中存在 #pdf-title 的省略规则
 * - UIManagerCore 在更新标题时设置了 title 属性
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");

function readUtf8(p) { return readFileSync(p, { encoding: "utf8" }); }

describe("pdf-viewer header title behavior", () => {
  test("style.css contains ellipsis rules for #pdf-title", () => {
    const css = readUtf8(resolve(process.cwd(), "src/frontend/pdf-viewer/assets/style.css"));
    expect(css.includes("#pdf-title")).toBe(true);
    expect(css.includes("text-overflow: ellipsis")).toBe(true);
    expect(css.includes("white-space: nowrap")).toBe(true);
    expect(css.includes("overflow: hidden")).toBe(true);
  });

  test("UIManagerCore sets title attribute for tooltip", () => {
    const js = readUtf8(resolve(process.cwd(), "src/frontend/pdf-viewer/features/ui-manager/components/ui-manager-core.js"));
    expect(js.includes("titleElement.title = displayName")).toBe(true);
  });
});

