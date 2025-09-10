/**
 * 测试@babel/plugin-transform-modules-commonjs插件是否正确添加
 * 使用TDD方法验证Babel配置
 */

const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

describe('Babel配置测试', () => {
  let babelConfig;

  beforeAll(() => {
    // 读取babel.config.js文件
    const configPath = path.resolve(__dirname, '..', 'babel.config.js');
    babelConfig = require(configPath);
  });

  test('应该包含@babel/plugin-transform-modules-commonjs插件', () => {
    // 验证plugins数组存在
    expect(babelConfig.plugins).toBeDefined();
    expect(Array.isArray(babelConfig.plugins)).toBe(true);

    // 验证@babel/plugin-transform-modules-commonjs插件在plugins数组中
    expect(babelConfig.plugins).toContain('@babel/plugin-transform-modules-commonjs');
  });

  test('应该能够使用ES模块语法并转换为CommonJS', () => {
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
    expect(result.code).toContain('require(');
    expect(result.code).toContain('exports.');
  });

  test('应该能够使用ES模块导出语法并转换为CommonJS', () => {
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
    expect(result.code).toContain('exports.');
    expect(result.code).toContain('module.exports');
  });

  test('Babel配置应该包含所有必需的插件', () => {
    // 验证所有必需的插件都存在
    const requiredPlugins = [
      '@babel/plugin-proposal-private-methods',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-private-methods',
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-syntax-dynamic-import',
      '@babel/plugin-transform-modules-commonjs'
    ];

    requiredPlugins.forEach(plugin => {
      expect(babelConfig.plugins).toContain(plugin);
    });
  });
});