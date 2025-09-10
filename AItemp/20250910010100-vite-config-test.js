/**
 * 测试vite.config.js中的include/exclude选项配置
 * 使用TDD方法验证配置是否正确
 */

const fs = require('fs');
const path = require('path');

// 读取vite.config.js文件内容
const viteConfigPath = path.resolve(__dirname, '../vite.config.js');
let viteConfigContent;

try {
  viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');
} catch (error) {
  console.error('无法读取vite.config.js:', error);
  process.exit(1);
}

// 测试工具函数
function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`期望 ${expected}, 但得到 ${actual}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error('值应该是真值');
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error('值应该是假值');
      }
    },
    toContain: (substring) => {
      if (!actual.includes(substring)) {
        throw new Error(`期望字符串包含 ${substring}`);
      }
    },
    toMatch: (pattern) => {
      if (!pattern.test(actual)) {
        throw new Error(`期望 ${actual} 匹配模式 ${pattern}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (!(actual > expected)) {
        throw new Error(`期望 ${actual} 大于 ${expected}`);
      }
    }
  };
}

// 测试函数
function test(name, testFn) {
  try {
    testFn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  错误: ${error.message}`);
    return false;
  }
}

// 测试套件
function runTests() {
  console.log('开始运行Vite配置测试...\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 测试optimizeDeps配置
  console.log('测试套件: optimizeDeps配置');
  
  totalTests++;
  if (test('应该包含optimizeDeps配置', () => {
    expect(viteConfigContent).toContain('optimizeDeps');
  })) passedTests++;
  
  totalTests++;
  if (test('optimizeDeps应该包含include选项', () => {
    expect(viteConfigContent).toContain('include:');
  })) passedTests++;
  
  totalTests++;
  if (test('include选项应该包含tabulator-tables的正则表达式', () => {
    expect(viteConfigContent).toContain('/node_modules\\/tabulator-tables/');
  })) passedTests++;
  
  totalTests++;
  if (test('include选项应该正确格式化为数组', () => {
    expect(viteConfigContent).toContain('include: [/node_modules\\/tabulator-tables/]');
  })) passedTests++;
  
  // 测试其他配置保持不变
  console.log('\n测试套件: 其他配置保持不变');
  
  totalTests++;
  if (test('应该保持原有的root配置', () => {
    expect(viteConfigContent).toContain("root: 'src/frontend/pdf-home'");
  })) passedTests++;
  
  totalTests++;
  if (test('应该保持原有的plugins配置', () => {
    expect(viteConfigContent).toContain('plugins:');
    expect(viteConfigContent).toContain('babel()');
    expect(viteConfigContent).toContain('commonjs()');
  })) passedTests++;
  
  totalTests++;
  if (test('应该保持原有的build配置', () => {
    expect(viteConfigContent).toContain('build:');
    expect(viteConfigContent).toContain('rollupOptions:');
    expect(viteConfigContent).toContain('output:');
    expect(viteConfigContent).toContain("format: 'es'");
  })) passedTests++;
  
  // 测试配置的整体结构
  console.log('\n测试套件: 配置结构');
  
  totalTests++;
  if (test('应该是一个有效的JavaScript配置文件', () => {
    expect(viteConfigContent).toContain('import { defineConfig } from \'vite\'');
    expect(viteConfigContent).toContain('export default defineConfig');
    expect(viteConfigContent).toMatch(/\{\s*$/m); // 包含开始的大括号
    expect(viteConfigContent).toContain('}'); // 包含结束的大括号
  })) passedTests++;
  
  totalTests++;
  if (test('配置应该有正确的缩进和格式', () => {
    // 检查optimizeDeps的缩进
    const optimizeDepsMatch = viteConfigContent.match(/(\s*)optimizeDeps:/);
    expect(optimizeDepsMatch).toBeTruthy();
    
    // 检查include的缩进应该比optimizeDeps多
    const includeMatch = viteConfigContent.match(/(\s*)include:/);
    expect(includeMatch).toBeTruthy();
    expect(includeMatch[1].length).toBeGreaterThan(optimizeDepsMatch[1].length);
  })) passedTests++;
  
  console.log(`\n测试结果:`);
  console.log(`通过: ${passedTests}/${totalTests}`);
  console.log(`失败: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n✅ 所有测试通过！Vite配置正确。');
    return true;
  } else {
    console.log('\n❌ 部分测试失败。请检查配置。');
    return false;
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

module.exports = {
  runTests,
  viteConfigContent
};