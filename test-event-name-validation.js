/**
 * 测试事件名称验证机制
 *
 * 运行方式：
 * 1. ESLint 检查：npx eslint test-event-name-validation.js
 * 2. 运行时检查：node test-event-name-validation.js
 */

import { getEventBus } from './src/frontend/common/event/event-bus.js';
import { createEventName, EventModule, EventAction, EventStatus } from './src/frontend/common/event/event-name-helpers.js';

console.log('\n=== 测试事件名称验证机制 ===\n');

const eventBus = getEventBus('TestModule', {
  enableValidation: true
});

// ==============================
// 测试1：错误的事件名称（应该被拦截）
// ==============================
console.log('📋 测试1：错误的事件名称（应该被运行时验证拦截）\n');

console.log('❌ 测试：缺少冒号');
eventBus.emit('loadData', { test: true });

console.log('\n❌ 测试：超过3段');
eventBus.emit('pdf:list:data:loaded', { test: true });

console.log('\n❌ 测试：使用下划线');
eventBus.emit('pdf_list_updated', { test: true });

console.log('\n❌ 测试：只有2段');
eventBus.emit('pdf:loaded', { test: true });

console.log('\n❌ 测试：使用驼峰命名');
eventBus.emit('pdfListUpdated', { test: true });

// ==============================
// 测试2：正确的事件名称（应该成功）
// ==============================
console.log('\n\n📋 测试2：正确的事件名称（应该成功发布）\n');

console.log('✅ 测试：正确格式 - 直接使用字符串');
eventBus.emit('pdf:load:completed', { test: true });

console.log('\n✅ 测试：正确格式 - 使用 createEventName()');
const eventName = createEventName('pdf', 'save', 'success');
eventBus.emit(eventName, { test: true });

console.log('\n✅ 测试：正确格式 - 使用常量');
const eventName2 = createEventName(
  EventModule.BOOKMARK,
  EventAction.TOGGLE,
  EventStatus.REQUESTED
);
eventBus.emit(eventName2, { test: true });

// ==============================
// 测试3：辅助函数错误检测
// ==============================
console.log('\n\n📋 测试3：createEventName() 参数验证\n');

try {
  console.log('❌ 测试：包含冒号的参数');
  createEventName('pdf:viewer', 'load', 'completed');
} catch (error) {
  console.log('✅ 成功捕获错误:', error.message);
}

try {
  console.log('\n❌ 测试：包含大写字母的参数');
  createEventName('PDF', 'load', 'completed');
} catch (error) {
  console.log('✅ 成功捕获错误:', error.message);
}

try {
  console.log('\n❌ 测试：空字符串参数');
  createEventName('', 'load', 'completed');
} catch (error) {
  console.log('✅ 成功捕获错误:', error.message);
}

console.log('\n\n=== 测试完成 ===\n');
console.log('提示：');
console.log('1. 运行时验证已完成，查看上方输出');
console.log('2. 运行 "npx eslint test-event-name-validation.js" 测试 ESLint 规则');
console.log('3. 错误的事件名称应该被阻止发布（无输出）');
console.log('4. 正确的事件名称应该成功发布\n');
