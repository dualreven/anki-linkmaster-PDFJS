/**
 * 目的：保障 Outline 模块的模块级日志过滤为 ERROR（仅允许错误级别）。
 * 方法：静态检查 bootstrap 脚本中的 setModuleLogLevel 配置。
 */
import fs from "fs";
import path from "path";

describe("Outline 模块日志级别守卫", () => {
  test("app-bootstrap-feature.js 设置为 LogLevel.ERROR", () => {
    const p = path.resolve(__dirname, "../bootstrap/app-bootstrap-feature.js");
    const content = fs.readFileSync(p, { encoding: "utf-8" });
    expect(content).toContain('setModuleLogLevel("Feature.pdf-outline", LogLevel.ERROR)');
    expect(content).toContain('setModuleLogLevel("OutlineSidebarUI", LogLevel.ERROR)');
    expect(content).toContain('setModuleLogLevel("OutlineManager", LogLevel.ERROR)');
  });
});

