/**
 * 规则测试：no-eventbus-subscription-in-manager —— 覆盖 pdf-viewer Manager 文件
 * 断言：Manager 文件中出现 eventBus.on/onGlobal/once 应触发 error。
 */

import { execFileSync } from "node:child_process";

function runEslintOn(file) {
  let out = "";
  try {
    out = execFileSync(
      process.execPath,
      ["node_modules/eslint/bin/eslint.js", file, "--no-ignore", "--format", "json"],
      { encoding: "utf8" }
    );
  } catch (e) {
    out = e && e.stdout ? String(e.stdout) : "[]";
  }
  const json = JSON.parse(out || "[]");
  return json && json[0] ? json[0].messages : [];
}

describe("no-eventbus-subscription-in-manager (pdf-viewer)", () => {
  test("Manager 文件内订阅 EventBus 应报错", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-viewer/features/sample/services/bad.manager.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-eventbus-subscription-in-manager")).toBe(true);
  });

  test("Manager 文件无订阅应通过", () => {
    const msgs = runEslintOn("eslint-rules/fixtures/src/frontend/pdf-viewer/features/sample/services/good.manager.sample.js");
    expect(msgs.some(m => m.ruleId === "custom/no-eventbus-subscription-in-manager")).toBe(false);
  });
});

