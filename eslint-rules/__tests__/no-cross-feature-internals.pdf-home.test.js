/**
 * 规则测试：no-cross-feature-internals —— 覆盖 pdf-home（ESLint v9 Flat Config + Linter API）
 * 断言：兄弟域深层导入触发 error；从 public.js 导入允许通过。
 */
import { Linter } from "eslint";
import rule from "../no-cross-feature-internals.js";

function runLintOn(code, filePath) {
  const linter = new Linter();
  const config = {
    languageOptions: { ecmaVersion: 2022, sourceType: "module" },
    plugins: { custom: { rules: { "no-cross-feature-internals": rule } } },
    rules: { "custom/no-cross-feature-internals": "error" }
  };
  return linter.verify(code, config, { filename: filePath });
}

describe("no-cross-feature-internals (pdf-home)", () => {
  test("兄弟域深层导入（components/*）应报错", () => {
    const code = `
      import { ResultItemRenderer } from "../../search-result-item/components/result-item-renderer.js";
      export const x = new ResultItemRenderer(null);
    `;
    const messages = runLintOn(code, "/repo/src/frontend/pdf-home/features/search-results/components/results-renderer.js");
    expect(messages.some(m => m.ruleId === "custom/no-cross-feature-internals")).toBe(true);
  });

  test("从 public.js 导入应通过", () => {
    const code = `
      import { ResultItemRenderer } from "../../search-result-item/public.js";
      export const x = new ResultItemRenderer(null);
    `;
    const messages = runLintOn(code, "/repo/src/frontend/pdf-home/features/search-results/components/results-renderer.js");
    expect(messages.length).toBe(0);
  });
});
