/**
 * 测试事件名称格式
 */

// 模拟事件名称验证器
function validateEventName(eventName) {
  // 三段式格式: {module}:{action}:{status}
  const parts = eventName.split(':');

  if (parts.length !== 3) {
    return {
      valid: false,
      error: `事件名称必须是三段式格式 (module:action:status)，但得到了 ${parts.length} 段: "${eventName}"`
    };
  }

  const [module, action, status] = parts;

  // 验证每一段都不为空
  if (!module || !action || !status) {
    return {
      valid: false,
      error: `事件名称的每一段都不能为空: "${eventName}"`
    };
  }

  // 验证格式（小写字母、数字、连字符）
  const segmentPattern = /^[a-z][a-z0-9-]*$/;

  if (!segmentPattern.test(module)) {
    return {
      valid: false,
      error: `模块名称格式错误: "${module}" (应该是 kebab-case)`
    };
  }

  if (!segmentPattern.test(action)) {
    return {
      valid: false,
      error: `动作名称格式错误: "${action}" (应该是 kebab-case)`
    };
  }

  if (!segmentPattern.test(status)) {
    return {
      valid: false,
      error: `状态名称格式错误: "${status}" (应该是 kebab-case)`
    };
  }

  return { valid: true };
}

// 测试用例
const testCases = [
  // 旧的错误格式
  'pdf-viewer:bookmark-sort:mode-changed',

  // 新的正确格式
  'pdf-viewer:bookmark-sortmode:changed',
  'pdf-viewer:bookmark:sortmode:changed',

  // 其他测试
  'pdf:load:completed',
  'bookmark:toggle:requested',
  'loadData',  // 错误：缺少冒号
  'pdf:list:data:loaded',  // 错误：超过3段
];

console.log('=== 事件名称格式测试 ===\n');

testCases.forEach(eventName => {
  const result = validateEventName(eventName);

  if (result.valid) {
    console.log(`✅ "${eventName}"`);
  } else {
    console.log(`❌ "${eventName}"`);
    console.log(`   错误: ${result.error}\n`);
  }
});
