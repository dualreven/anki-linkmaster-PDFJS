/**
 * 静态验证：启动脚本中必须包含“强制装配 Outline”的标记字符串
 * 避免引入真实 bootstrap 依赖，使用源码检查方式保障策略未被移除。
 */
import fs from "fs";
import path from "path";

describe("Bootstrap 应始终装配 Outline（废止 Bookmark）", () => {
  test("app-bootstrap-feature.js 含强制装配标记", () => {
    const root = path.resolve(__dirname, "../../../");
    const p = path.join(root, "bootstrap", "app-bootstrap-feature.js");
    const content = fs.readFileSync(p, { encoding: "utf-8" });
    expect(content).toContain("Outline feature enforced");
    // 同时确保未出现对旧特性的正向注册调用（仅作为弱约束）
    expect(content).not.toMatch(/register\\(new\\s+PDFBookmarkFeature\\(\\)\\)/);
  });
});

