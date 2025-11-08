/**
 * 测试@babel/plugin-transform-modules-commonjs插件是否正确添加
 * 使用TDD方法验证Babel配置
 */

const babel = require("@babel/core");
const path = require("path");

describe("Babel配置测试", () => {
  let babelConfig;
  let loaded;

  beforeAll(() => {
    // 读取babel.config.js文件
    const configPath = path.resolve(__dirname, "..", "..", "..", "..", "babel.config.js");
    // 兼容 ESM 默认导出函数/对象与 CJS 两种形式
    // 我们需要在“test”环境下获取最终配置对象
    loaded = require(configPath);
    const asFn =
      typeof loaded === "function"
        ? loaded
        : loaded && typeof loaded.default === "function"
          ? loaded.default
          : null;
    const api = { env: (name) => name === "test" }; // 仅需返回布尔，指示 test 环境
    babelConfig = asFn ? asFn(api) : (loaded.default || loaded);
  });

  // 由下两个测试覆盖“转换为 CommonJS”的能力（import/exports 双向验证）

  test("应该能够使用ES模块语法并转换为CommonJS", () => {
    // 测试ES模块导入语法
    const esCode = `
      import { testFunction } from './test-module';
      export const myFunction = () => {
        return testFunction();
      };
    `;

    // 使用Babel转换代码
    const result = babel.transformSync(esCode, {
      presets: babelConfig.presets,
      plugins: babelConfig.plugins
    });

    // 验证转换结果包含CommonJS语法
    expect(result.code).toContain("require(");
    expect(result.code).toContain("exports.");
  });

  test("应该能够使用ES模块导出语法并转换为CommonJS", () => {
    // 测试ES模块导出语法
    const esCode = `
      export const myConstant = 'test';
      export function myFunction() {
        return 'hello';
      }
      export default class MyClass {
        constructor() {
          this.value = 'test';
        }
      }
    `;

    // 使用Babel转换代码
    const result = babel.transformSync(esCode, {
      presets: babelConfig.presets,
      plugins: babelConfig.plugins
    });

    // 验证转换结果包含CommonJS导出语法
    expect(result.code).toContain("exports.");
    expect(result.code).toContain("exports.default");
  });

  test("Babel配置应该包含必要的 transform 插件", () => {
    // 与当前配置保持一致（不再使用 proposal*；使用 transform*）
    const required = new Set([
      "@babel/plugin-syntax-import-meta",
      "babel-plugin-transform-import-meta",
      "@babel/plugin-transform-optional-chaining",
      "@babel/plugin-transform-nullish-coalescing-operator",
      "@babel/plugin-transform-private-methods",
      "@babel/plugin-transform-class-properties",
      "@babel/plugin-transform-private-property-in-object",
    ]);
    const names = (babelConfig.plugins || []).map((p) => (Array.isArray(p) ? p[0] : p));
    required.forEach((name) => {
      expect(names).toContain(name);
    });
  });
});

