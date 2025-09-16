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

const path = require('path');
const babelConfig = require(path.resolve(__dirname, '../../../../babel.config.js'));

describe('Babel配置优化验证', () => {
  
  test('配置文件应该包含正确的预设', () => {
    expect(babelConfig.presets).toBeDefined();
    expect(babelConfig.presets.length).toBe(1);
    expect(babelConfig.presets[0][0]).toBe('@babel/preset-env');
  });

  test('预设配置应该包含优化选项', () => {
    const presetConfig = babelConfig.presets[0][1];
    expect(presetConfig).toBeDefined();
    expect(presetConfig.useBuiltIns).toBe('usage');
    expect(presetConfig.corejs).toBe(3);
    expect(presetConfig.modules).toBe(false);
  });

  test('配置文件应该包含正确的插件', () => {
    expect(babelConfig.plugins).toBeDefined();
    expect(babelConfig.plugins.length).toBe(5);
  });

  test('不应该包含重复的插件', () => {
    const plugins = babelConfig.plugins;
    
    // 检查是否移除了proposal版本的插件
    expect(plugins).not.toContain('@babel/plugin-proposal-private-methods');
    expect(plugins).not.toContain('@babel/plugin-proposal-class-properties');
    
    // 检查是否保留了transform版本的插件
    expect(plugins).toContain('@babel/plugin-transform-private-methods');
    expect(plugins).toContain('@babel/plugin-transform-class-properties');
  });

  test('应该包含新增的有用插件', () => {
    const plugins = babelConfig.plugins;
    expect(plugins).toContain('@babel/plugin-transform-optional-chaining');
    expect(plugins).toContain('@babel/plugin-transform-nullish-coalescing-operator');
  });

  test('应该保留必要的插件', () => {
    const plugins = babelConfig.plugins;
    expect(plugins).toContain('@babel/plugin-syntax-dynamic-import');
  });

  test('不应该包含不必要的插件', () => {
    const plugins = babelConfig.plugins;
    
    // 检查是否移除了transform-modules-commonjs插件，因为预设中已经设置了modules: false
    expect(plugins).not.toContain('@babel/plugin-transform-modules-commonjs');
  });

  test('浏览器目标配置应该正确', () => {
    const targets = babelConfig.presets[0][1].targets;
    expect(targets).toBeDefined();
    expect(targets.browsers).toBe('> 0.25%, not dead');
  });
});

// 额外的集成测试，验证配置是否能够正确处理现代JavaScript特性
describe('Babel配置功能验证', () => {
  
  test('配置应该支持类属性', () => {
    // 这个测试验证类属性插件是否正确配置
    const hasClassPropertiesPlugin = babelConfig.plugins.includes('@babel/plugin-transform-class-properties');
    expect(hasClassPropertiesPlugin).toBe(true);
  });

  test('配置应该支持私有方法', () => {
    // 这个测试验证私有方法插件是否正确配置
    const hasPrivateMethodsPlugin = babelConfig.plugins.includes('@babel/plugin-transform-private-methods');
    expect(hasPrivateMethodsPlugin).toBe(true);
  });

  test('配置应该支持可选链操作符', () => {
    // 这个测试验证可选链操作符插件是否正确配置
    const hasOptionalChainingPlugin = babelConfig.plugins.includes('@babel/plugin-transform-optional-chaining');
    expect(hasOptionalChainingPlugin).toBe(true);
  });

  test('配置应该支持空值合并操作符', () => {
    // 这个测试验证空值合并操作符插件是否正确配置
    const hasNullishCoalescingPlugin = babelConfig.plugins.includes('@babel/plugin-transform-nullish-coalescing-operator');
    expect(hasNullishCoalescingPlugin).toBe(true);
  });

  test('配置应该支持动态导入', () => {
    // 这个测试验证动态导入插件是否正确配置
    const hasDynamicImportPlugin = babelConfig.plugins.includes('@babel/plugin-syntax-dynamic-import');
    expect(hasDynamicImportPlugin).toBe(true);
  });
});