/**
 * 目的：保障 URL 导航相关模块（URLNavigationFeature/URLJumpDispatcher/URLParamsParser）
 * 在安装阶段将模块级日志设置为 ERROR，避免产生无关 toast。
 * 方法：静态检查源码中 setModuleLogLevel 的配置。
 */
import fs from "fs";
import path from "path";

describe("URL 导航模块日志级别守卫", () => {
  test("index.js 设置模块级日志为 ERROR", () => {
    const p = path.resolve(__dirname, "../index.js");
    const content = fs.readFileSync(p, { encoding: "utf-8" });
    expect(content).toContain('setModuleLogLevel("URLNavigationFeature", LogLevel.ERROR)');
    expect(content).toContain('setModuleLogLevel("URLJumpDispatcher", LogLevel.ERROR)');
    expect(content).toContain('setModuleLogLevel("URLParamsParser", LogLevel.ERROR)');
  });
});

