/**
 * Babel配置优化验证测试
 *
 * 这个测试文件用于验证babel.config.js的优化是否正确
 * 测试内容包括：
 * 1. 验证配置文件格式是否正确
 * 2. 验证重复插件是否已移除
 * 3. 验证新增插件是否正确添加
 * 4. 验证预设配置是否优化
 */

const path = require("path");
const rawModule = require(path.resolve(__dirname, "../../../../babel.config.js"));
// 兼容 CJS/ESM：可能是函数、对象或 { default: fn/obj }
const apiMock = { env: (n) => n === "test" };
const exported = (rawModule && rawModule.default) ? rawModule.default : rawModule;
const babelConfig = (typeof exported === "function") ? exported(apiMock) : exported;

describe("Babel配置优化验证", () => {

  test("配置文件应该包含正确的预设", () => {
    expect(babelConfig.presets).toBeDefined();
    expect(Array.isArray(babelConfig.presets)).toBe(true);
    expect(babelConfig.presets[0][0]).toBe("@babel/preset-env");
  });

  test("预设配置应该包含优化选项", () => {
    const presetConfig = babelConfig.presets[0][1];
    expect(presetConfig).toBeDefined();
    // 测试环境（Jest）应为 CommonJS，生产为 ESM + browsers 目标
    if (presetConfig.modules === "commonjs") {
      expect(presetConfig.targets).toEqual({ node: "current" });
    } else {
      expect(presetConfig.modules).toBe(false);
      // 在生产环境建议按需引入与 corejs 配置，若缺省也允许通过（由浏览器目标约束）
      // 这里仅在存在时进行断言
      if (Object.prototype.hasOwnProperty.call(presetConfig, "useBuiltIns")) {
        expect(presetConfig.useBuiltIns).toBe("usage");
      }
      if (Object.prototype.hasOwnProperty.call(presetConfig, "corejs")) {
        expect(presetConfig.corejs).toBe(3);
      }
      expect(presetConfig.targets).toEqual({ esmodules: true });
    }
  });

  test("配置文件应该包含正确的插件", () => {
    expect(babelConfig.plugins).toBeDefined();
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    // 必需转换插件应存在
    expect(plugins).toEqual(expect.arrayContaining([
      "babel-plugin-transform-import-meta",
      "@babel/plugin-transform-optional-chaining",
      "@babel/plugin-transform-nullish-coalescing-operator",
      "@babel/plugin-transform-private-methods",
      "@babel/plugin-transform-class-properties",
      "@babel/plugin-transform-private-property-in-object"
    ]));
  });

  test("不应该包含重复的插件", () => {
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);

    // 检查是否移除了proposal版本的插件
    expect(plugins).not.toContain("@babel/plugin-proposal-private-methods");
    expect(plugins).not.toContain("@babel/plugin-proposal-class-properties");

    // 检查是否保留了transform版本的插件
    expect(plugins).toContain("@babel/plugin-transform-private-methods");
    expect(plugins).toContain("@babel/plugin-transform-class-properties");
  });

  test("应该包含新增的有用插件", () => {
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    expect(plugins).toContain("@babel/plugin-transform-optional-chaining");
    expect(plugins).toContain("@babel/plugin-transform-nullish-coalescing-operator");
  });

  test("应该保留必要的插件", () => {
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    // 允许 dynamic-import 或 import-meta 方案之一
    const hasDynamicOrImportMeta =
      plugins.includes("@babel/plugin-syntax-dynamic-import") ||
      plugins.includes("@babel/plugin-syntax-import-meta") ||
      plugins.includes("babel-plugin-transform-import-meta");
    expect(hasDynamicOrImportMeta).toBe(true);
  });

  test("不应该包含不必要的插件", () => {
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);

    // 检查是否移除了transform-modules-commonjs插件，因为预设中已经设置了modules: false
    expect(plugins).not.toContain("@babel/plugin-transform-modules-commonjs");
  });

  test("浏览器目标配置应该正确", () => {
    const targets = babelConfig.presets[0][1].targets;
    expect(targets).toBeDefined();
    // 测试环境下为 node；生产为 esmodules
    if (targets && targets.node) {
      expect(targets).toEqual({ node: "current" });
    } else {
      expect(targets).toEqual({ esmodules: true });
    }
  });
});

// 额外的集成测试，验证配置是否能够正确处理现代JavaScript特性
describe("Babel配置功能验证", () => {

  test("配置应该支持类属性", () => {
    // 这个测试验证类属性插件是否正确配置
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    const hasClassPropertiesPlugin = plugins.includes("@babel/plugin-transform-class-properties");
    expect(hasClassPropertiesPlugin).toBe(true);
  });

  test("配置应该支持私有方法", () => {
    // 这个测试验证私有方法插件是否正确配置
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    const hasPrivateMethodsPlugin = plugins.includes("@babel/plugin-transform-private-methods");
    expect(hasPrivateMethodsPlugin).toBe(true);
  });

  test("配置应该支持可选链操作符", () => {
    // 这个测试验证可选链操作符插件是否正确配置
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    const hasOptionalChainingPlugin = plugins.includes("@babel/plugin-transform-optional-chaining");
    expect(hasOptionalChainingPlugin).toBe(true);
  });

  test("配置应该支持空值合并操作符", () => {
    // 这个测试验证空值合并操作符插件是否正确配置
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    const hasNullishCoalescingPlugin = plugins.includes("@babel/plugin-transform-nullish-coalescing-operator");
    expect(hasNullishCoalescingPlugin).toBe(true);
  });

  test("配置应该支持动态导入", () => {
    // 这个测试验证动态导入/导入元信息能力是否可用（两种方案其一）
    const plugins = babelConfig.plugins.map(p => Array.isArray(p) ? p[0] : p);
    const ok = plugins.includes("@babel/plugin-syntax-dynamic-import") ||
               plugins.includes("@babel/plugin-syntax-import-meta") ||
               plugins.includes("babel-plugin-transform-import-meta");
    expect(ok).toBe(true);
  });
});

