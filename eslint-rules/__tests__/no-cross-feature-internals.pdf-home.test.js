/**
 * 规则测试：no-cross-feature-internals —— 覆盖 pdf-home（使用 ESLint CLI 以加载完整 flat config）
 * 断言：兄弟域深层导入触发 error；从 public.js 导入允许通过。
 */
import { execFileSync } from "node:child_process";

function runEslintOn(file) {
  // 直接调用 eslint 的 bin 脚本，避免依赖 shell 与 PATH
  let out = "";
  try {
    out = execFileSync(
      process.execPath, // node
      ["node_modules/eslint/bin/eslint.js", file, "--format", "json"],
      { encoding: "utf8" }
    );
  } catch (e) {
    // 当存在 lint 错误时，eslint 以非零退出；stdout 中仍包含 JSON 结果
    out = e && e.stdout ? String(e.stdout) : "[]";
  }
  const json = JSON.parse(out || "[]");
  return json && json[0] ? json[0].messages : [];
}

describe("no-cross-feature-internals (pdf-home)", () => {
  test("兄弟域深层导入（components/*）应报错", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-home/features/search-results/components/bad-import.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-cross-feature-internals")).toBe(true);
  });

  test("从 public.js 导入应通过", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-home/features/search-results/components/good-import.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-cross-feature-internals")).toBe(false);
  });
});

