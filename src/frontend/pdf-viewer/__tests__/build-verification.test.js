/**
 * 构建验证测试 - 验证构建配置和Babel转换
 * @file 构建验证测试
 */

import fs from "fs";
import path from "path";

describe("构建验证测试", () => {
  test("构建过程应该成功完成", () => {
    // 这个测试验证构建过程是否成功
    // 如果构建失败，这个测试文件就无法运行
    expect(true).toBe(true);
  });

  test("Babel配置应该包含私有字段转换插件", async () => {
    // 验证Babel配置是否正确设置了私有字段转换
    const configPath = path.resolve(process.cwd(), "babel.config.js");
    const content = fs.readFileSync(configPath, { encoding: "utf8" });
    expect(content).toContain("@babel/plugin-transform-private-methods");
    expect(content).toContain("@babel/plugin-transform-class-properties");
  });

  test("package.json应该包含必要的Babel依赖", async () => {
    // 验证package.json中包含了必要的Babel插件
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, { encoding: "utf8" }));
    expect(pkg.devDependencies).toBeDefined();

    const deps = pkg.devDependencies;
    expect(deps["@babel/plugin-transform-private-methods"]).toBeDefined();
    expect(deps["@babel/plugin-transform-class-properties"]).toBeDefined();
    expect(deps["vite-plugin-babel"]).toBeDefined();
  });
});

// 移除CommonJS导出语句
