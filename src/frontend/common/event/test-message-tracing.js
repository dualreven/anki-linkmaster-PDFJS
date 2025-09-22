/**
 * @file EventBus消息追踪功能测试
 * @description 测试消息调用链追踪功能的完整性和准确性
 * @version 1.0
 * @date 2025-09-23
 */

import { EventBus } from './event-bus-with-tracing.js';
import { MessageTracer } from './message-tracer.js';

/**
 * 简单的测试框架
 */
class TestFramework {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFunc) {
    this.tests.push({ name, testFunc });
  }

  async run() {
    console.log('\n=== EventBus 消息追踪功能测试 ===\n');

    for (const { name, testFunc } of this.tests) {
      try {
        console.log(`🧪 测试: ${name}`);
        await testFunc();
        console.log(`✅ 通过: ${name}\n`);
        this.passed++;
      } catch (error) {
        console.error(`❌ 失败: ${name}`);
        console.error(`   错误: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log(`\n=== 测试结果 ===`);
    console.log(`✅ 通过: ${this.passed}`);
    console.log(`❌ 失败: ${this.failed}`);
    console.log(`📊 总计: ${this.tests.length}`);

    return this.failed === 0;
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
    }
  }

  assertNotNull(value, message) {
    if (value == null) {
      throw new Error(`${message}: 值不应为null或undefined`);
    }
  }
}

// 创建测试实例
const test = new TestFramework();

// 测试1: MessageTracer基础功能
test.test('MessageTracer基础功能', () => {
  const tracer = new MessageTracer({ maxTraceSize: 10 });

  // 测试ID生成
  const id1 = tracer.generateMessageId();
  const id2 = tracer.generateMessageId();
  test.assert(id1 !== id2, 'ID应该是唯一的');
  test.assert(id1.startsWith('msg_'), 'ID应该有正确的前缀');

  // 测试记录消息
  const messageTrace = {
    messageId: id1,
    traceId: id1,
    event: 'test:event:triggered',
    publisher: 'TestPublisher',
    subscribers: ['TestSubscriber1', 'TestSubscriber2'],
    timestamp: Date.now(),
    executionResults: [
      { subscriberId: 'TestSubscriber1', success: true, executionTime: 5 },
      { subscriberId: 'TestSubscriber2', success: false, error: 'Test Error', executionTime: 10 }
    ],
    totalExecutionTime: 15
  };

  tracer.recordMessage(messageTrace);

  // 测试获取追踪记录
  const retrieved = tracer.getTrace(id1);
  test.assertNotNull(retrieved, '应该能获取到追踪记录');
  test.assertEqual(retrieved.event, 'test:event:triggered', '事件名应该匹配');
  test.assertEqual(retrieved.executionResults.length, 2, '应该有2个执行结果');
});

// 测试2: EventBus追踪集成
test.test('EventBus追踪集成', () => {
  const eventBus = new EventBus({ enableTracing: true, moduleName: 'TestModule' });

  let receivedData = null;
  let receivedTraceInfo = null;

  // 订阅事件（支持追踪信息）
  eventBus.on('test:message:sent', (data, traceInfo) => {
    receivedData = data;
    receivedTraceInfo = traceInfo;
  });

  // 发布事件
  const result = eventBus.emit('test:message:sent', { content: 'Hello Tracing!' });

  // 验证结果
  test.assertNotNull(result, '应该返回追踪信息');
  test.assertNotNull(result.messageId, '应该有messageId');
  test.assertNotNull(result.traceId, '应该有traceId');
  test.assertEqual(receivedData.content, 'Hello Tracing!', '数据应该正确传递');
  test.assertNotNull(receivedTraceInfo, '应该接收到追踪信息');
  test.assertEqual(receivedTraceInfo.messageId, result.messageId, 'messageId应该匹配');
});

// 测试3: 级联事件追踪
test.test('级联事件追踪', () => {
  const eventBus = new EventBus({ enableTracing: true, moduleName: 'CascadeTest' });

  let secondEventTrace = null;

  // 第一个事件的订阅者
  eventBus.on('first:event:triggered', (data, traceInfo) => {
    // 在回调中发布级联事件
    const cascadeResult = eventBus.emit('second:event:triggered',
      { cascade: true },
      {
        parentTraceId: traceInfo.traceId,
        parentMessageId: traceInfo.messageId
      }
    );
    secondEventTrace = cascadeResult;
  });

  // 第二个事件的订阅者
  eventBus.on('second:event:triggered', (data, traceInfo) => {
    // 验证级联事件接收到正确的追踪信息
    test.assertNotNull(traceInfo, '级联事件应该有追踪信息');
  });

  // 发布第一个事件
  const firstResult = eventBus.emit('first:event:triggered', { start: true });

  // 验证级联追踪
  test.assertNotNull(secondEventTrace, '应该有级联事件的追踪信息');
  test.assertEqual(firstResult.traceId, secondEventTrace.traceId, '级联事件应该继承相同的traceId');
  test.assert(firstResult.messageId !== secondEventTrace.messageId, '级联事件应该有不同的messageId');
});

// 测试4: 调用链树构建
test.test('调用链树构建', () => {
  const eventBus = new EventBus({ enableTracing: true, moduleName: 'TreeTest' });

  let traceId = null;

  // 设置事件链
  eventBus.on('parent:event:start', (data, traceInfo) => {
    traceId = traceInfo.traceId;

    // 发布子事件1
    eventBus.emit('child:event:one', { step: 1 }, {
      parentTraceId: traceInfo.traceId,
      parentMessageId: traceInfo.messageId
    });

    // 发布子事件2
    eventBus.emit('child:event:two', { step: 2 }, {
      parentTraceId: traceInfo.traceId,
      parentMessageId: traceInfo.messageId
    });
  });

  eventBus.on('child:event:one', (data, traceInfo) => {
    // 发布孙子事件
    eventBus.emit('grandchild:event:final', { step: 3 }, {
      parentTraceId: traceInfo.traceId,
      parentMessageId: traceInfo.messageId
    });
  });

  eventBus.on('child:event:two', () => {
    // 简单订阅者
  });

  eventBus.on('grandchild:event:final', () => {
    // 简单订阅者
  });

  // 启动事件链
  eventBus.emit('parent:event:start', { root: true });

  // 等待一小段时间让所有事件处理完成
  setTimeout(() => {
    // 构建调用链树
    const tree = eventBus.getTraceTree(traceId);
    test.assertNotNull(tree, '应该能构建调用链树');
    test.assertEqual(tree.traceId, traceId, 'traceId应该匹配');
    test.assert(tree.messages.length >= 1, '应该有根消息');

    // 验证树结构
    const rootMessage = tree.messages[0];
    test.assertEqual(rootMessage.event, 'parent:event:start', '根事件应该正确');
    test.assert(rootMessage.children.length >= 2, '根事件应该有子事件');
  }, 100);
});

// 测试5: 错误处理和追踪
test.test('错误处理和追踪', () => {
  const eventBus = new EventBus({ enableTracing: true, moduleName: 'ErrorTest' });

  // 订阅者会抛出错误
  eventBus.on('error:test:event', () => {
    throw new Error('故意抛出的测试错误');
  });

  // 正常订阅者
  eventBus.on('error:test:event', (data) => {
    // 正常处理
  });

  // 发布事件
  const result = eventBus.emit('error:test:event', { test: 'error' });

  // 获取追踪记录
  const trace = eventBus.getMessageTrace(result.messageId);
  test.assertNotNull(trace, '应该有追踪记录');
  test.assertEqual(trace.executionResults.length, 2, '应该有2个执行结果');

  // 验证错误记录
  const errorResult = trace.executionResults.find(r => !r.success);
  test.assertNotNull(errorResult, '应该有错误记录');
  test.assert(errorResult.error.includes('故意抛出的测试错误'), '错误信息应该正确');
});

// 测试6: 性能统计
test.test('性能统计', () => {
  const eventBus = new EventBus({ enableTracing: true, moduleName: 'PerfTest' });

  eventBus.on('perf:test:event', () => {
    // 模拟一些处理时间
    const start = Date.now();
    while (Date.now() - start < 10) {
      // 忙等待10ms
    }
  });

  // 发布多个事件
  for (let i = 0; i < 5; i++) {
    eventBus.emit('perf:test:event', { index: i });
  }

  // 获取性能统计
  const stats = eventBus.getStats('perf:test:event');
  test.assertNotNull(stats, '应该有性能统计');
  test.assertEqual(stats.totalMessages, 5, '应该有5条消息');
  test.assert(stats.averageExecutionTime > 0, '平均执行时间应该大于0');
});

// 测试7: 向后兼容性
test.test('向后兼容性', () => {
  const eventBus = new EventBus({ enableTracing: false, moduleName: 'CompatTest' });

  let received = false;

  // 旧式订阅者（只接受一个参数）
  eventBus.on('compat:test:event', (data) => {
    received = true;
    test.assertEqual(data.message, 'compatibility test', '数据应该正确传递');
  });

  // 发布事件
  const result = eventBus.emit('compat:test:event', { message: 'compatibility test' });

  test.assert(received, '事件应该被接收');
  test.assert(result === undefined, '禁用追踪时不应返回追踪信息');
});

// 运行所有测试
export async function runMessageTracingTests() {
  console.log('🚀 开始运行EventBus消息追踪功能测试...');

  const success = await test.run();

  if (success) {
    console.log('\n🎉 所有测试通过！消息追踪功能实现正确。');
  } else {
    console.log('\n💥 部分测试失败，请检查实现。');
  }

  return success;
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  window.runMessageTracingTests = runMessageTracingTests;
  console.log('测试函数已注册到 window.runMessageTracingTests()');
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js环境
  module.exports = { runMessageTracingTests };
}

// 导出测试函数
export default runMessageTracingTests;