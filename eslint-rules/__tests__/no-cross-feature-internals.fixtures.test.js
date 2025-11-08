/**
 * 端到端（CLI）校验：fixtures 中的 bad-import 应被命中，good-import 不应报错
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

describe("no-cross-feature-internals fixtures (pdf-home)", () => {
  test("bad-import.sample.js 应命中规则", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-home/features/search-results/components/bad-import.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-cross-feature-internals")).toBe(true);
  });

  test("good-import.sample.js 不应报错", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-home/features/search-results/components/good-import.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-cross-feature-internals")).toBe(false);
  });
});

