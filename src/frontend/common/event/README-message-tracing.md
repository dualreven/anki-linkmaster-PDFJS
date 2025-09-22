# EventBus 消息调用链追踪功能

## 📋 功能概述

EventBus消息调用链追踪功能为复杂的事件系统提供了强大的调试和性能分析能力。通过追踪每个消息的完整生命周期，开发者可以轻松理解事件流、定位性能瓶颈和调试错误。

## 🚀 快速开始

### 基本使用

```javascript
// 导入带追踪功能的EventBus
import { EventBus } from './event-bus-with-tracing.js';

// 创建启用追踪的EventBus实例
const eventBus = new EventBus({
  enableTracing: true,        // 启用追踪功能
  moduleName: 'MyModule',     // 模块名称
  maxTraceSize: 1000,         // 最大追踪记录数
  enablePerformanceTracking: true  // 启用性能追踪
});

// 订阅事件（支持追踪信息）
eventBus.on('user:action:clicked', (data, traceInfo) => {
  console.log('事件数据:', data);
  console.log('追踪信息:', traceInfo);

  // 可以使用追踪信息发布级联事件
  if (data.needFollow) {
    eventBus.emit('user:follow:requested', { userId: data.userId }, {
      parentTraceId: traceInfo.traceId,
      parentMessageId: traceInfo.messageId
    });
  }
});

// 发布事件
const result = eventBus.emit('user:action:clicked', {
  userId: 123,
  action: 'click',
  needFollow: true
});

console.log('发布结果:', result);
// 输出: { messageId: "msg_...", traceId: "msg_...", timestamp: 1695123456789 }
```

### 向后兼容性

```javascript
// 旧式订阅者（只接受数据参数）仍然可以正常工作
eventBus.on('legacy:event:triggered', (data) => {
  console.log('传统方式处理:', data);
});

// 新式订阅者（接受数据和追踪信息）
eventBus.on('modern:event:triggered', (data, traceInfo) => {
  console.log('现代方式处理:', data, traceInfo);
});
```

## 📊 核心功能

### 1. 消息追踪

每个发布的事件都会生成唯一的追踪记录：

```javascript
// 获取特定消息的追踪信息
const trace = eventBus.getMessageTrace(messageId);
console.log(trace);

// 输出示例:
// {
//   messageId: "msg_1695123456789_1_k2j9d8x7q",
//   traceId: "msg_1695123456789_1_k2j9d8x7q",
//   event: "user:action:clicked",
//   publisher: "UIManager:handleClick:45",
//   subscribers: ["ActionHandler", "Logger"],
//   timestamp: 1695123456789,
//   executionResults: [
//     { subscriberId: "ActionHandler", success: true, executionTime: 5 },
//     { subscriberId: "Logger", success: true, executionTime: 2 }
//   ],
//   totalExecutionTime: 7
// }
```

### 2. 调用链树构建

```javascript
// 获取完整的调用链树
const tree = eventBus.getTraceTree(traceId);
console.log(tree);

// 输出示例:
// {
//   traceId: "msg_1695123456789_1_k2j9d8x7q",
//   startTime: 1695123456789,
//   totalDuration: 150,
//   messages: [
//     {
//       messageId: "msg_001",
//       event: "user:action:clicked",
//       publisher: "UIManager",
//       children: [
//         {
//           messageId: "msg_002",
//           event: "user:follow:requested",
//           publisher: "ActionHandler",
//           children: [...]
//         }
//       ]
//     }
//   ]
// }
```

### 3. 性能统计

```javascript
// 获取特定事件的性能统计
const stats = eventBus.getStats('user:action:clicked');
console.log(stats);

// 输出示例:
// {
//   totalMessages: 25,
//   averageExecutionTime: 12.5,
//   maxExecutionTime: 45,
//   minExecutionTime: 2,
//   errorRate: 0.04,
//   totalErrors: 1,
//   totalExecutions: 50
// }

// 获取所有事件的统计
const allStats = eventBus.getStats();
```

### 4. 级联事件追踪

```javascript
// 父事件处理器
eventBus.on('parent:event:start', (data, traceInfo) => {
  console.log('处理父事件');

  // 发布子事件，继承调用链
  eventBus.emit('child:event:process', { step: 1 }, {
    parentTraceId: traceInfo.traceId,     // 继承调用链ID
    parentMessageId: traceInfo.messageId  // 记录父消息ID
  });
});

// 子事件处理器
eventBus.on('child:event:process', (data, traceInfo) => {
  console.log('处理子事件');

  // 继续发布孙子事件
  eventBus.emit('grandchild:event:finish', { step: 2 }, {
    parentTraceId: traceInfo.traceId,
    parentMessageId: traceInfo.messageId
  });
});
```

## 🔧 配置选项

### EventBus 构造选项

```javascript
const eventBus = new EventBus({
  // 基础选项
  enableValidation: true,           // 是否启用事件名称验证
  moduleName: 'MyModule',           // 模块名称
  logger: customLogger,             // 自定义Logger实例

  // 追踪相关选项
  enableTracing: true,              // 是否启用消息追踪
  maxTraceSize: 1000,               // 最大追踪记录数（防止内存泄漏）
  enablePerformanceTracking: true   // 是否启用性能追踪
});
```

### 运行时配置

```javascript
// 动态启用/禁用追踪
eventBus.setTracing(true, {
  maxTraceSize: 2000,
  enablePerformanceTracking: true
});

// 获取追踪状态
const status = eventBus.getTracingStatus();
console.log(status);
// 输出: { enabled: true, hasTracer: true, totalMessages: 25, ... }
```

## 🎯 实际应用场景

### 1. 调试复杂事件流

```javascript
// 问题：用户点击按钮后PDF没有打开
// 解决：追踪完整的事件流

eventBus.on('ui:button:clicked', (data, traceInfo) => {
  console.log(`[${traceInfo.messageId}] 按钮点击事件`);
  eventBus.emit('pdf:open:requested', { filename: data.filename }, {
    parentTraceId: traceInfo.traceId,
    parentMessageId: traceInfo.messageId
  });
});

// 发布事件后检查调用链
const result = eventBus.emit('ui:button:clicked', { filename: 'test.pdf' });
setTimeout(() => {
  const tree = eventBus.getTraceTree(result.traceId);
  console.log('完整调用链:', tree);

  // 查找失败的步骤
  function findErrors(messages) {
    messages.forEach(msg => {
      if (msg.hasErrors) {
        console.log(`❌ 错误发生在: ${msg.event}`, msg.errors);
      }
      if (msg.children) findErrors(msg.children);
    });
  }
  findErrors(tree.messages);
}, 100);
```

### 2. 性能瓶颈分析

```javascript
// 分析哪个事件处理器最慢
const performanceReport = () => {
  const stats = eventBus.getStats();
  console.log('性能报告:');
  console.log(`平均执行时间: ${stats.averageExecutionTime}ms`);
  console.log(`最慢的处理: ${stats.maxExecutionTime}ms`);

  if (stats.maxExecutionTime > 100) {
    console.warn('⚠️ 发现性能瓶颈，建议优化超过100ms的处理器');
  }
};

// 定期生成性能报告
setInterval(performanceReport, 60000); // 每分钟一次
```

### 3. 错误监控和恢复

```javascript
// 监控错误率
const monitorErrors = () => {
  const stats = eventBus.getStats();
  if (stats.errorRate > 0.1) { // 错误率超过10%
    console.error(`🚨 高错误率警告: ${(stats.errorRate * 100).toFixed(2)}%`);

    // 获取最近的错误
    const recentTraces = eventBus.getAllTraceIds()
      .slice(-10) // 最近10个调用链
      .map(traceId => eventBus.getTraceTree(traceId))
      .filter(tree => tree.messages.some(msg => msg.hasErrors));

    console.log('最近的错误调用链:', recentTraces);
  }
};
```

## 📈 最佳实践

### 1. 内存管理

```javascript
// 定期清理旧的追踪数据
const oneHourAgo = Date.now() - (60 * 60 * 1000);
const cleanedCount = eventBus.clearTraceData(oneHourAgo);
console.log(`清理了 ${cleanedCount} 条旧追踪记录`);

// 在生产环境中设置合理的追踪记录上限
const productionEventBus = new EventBus({
  enableTracing: true,
  maxTraceSize: 500  // 生产环境使用较小的值
});
```

### 2. 条件追踪

```javascript
// 只在需要时启用追踪
const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugging = localStorage.getItem('debug-tracing') === 'true';

const eventBus = new EventBus({
  enableTracing: isDevelopment || isDebugging,
  moduleName: 'ProductionModule'
});
```

### 3. 追踪信息的传播

```javascript
// 确保级联事件正确传递追踪信息
eventBus.on('network:request:start', (data, traceInfo) => {
  fetch('/api/data')
    .then(response => response.json())
    .then(result => {
      // 成功时传递追踪信息
      eventBus.emit('network:request:success', result, {
        parentTraceId: traceInfo.traceId,
        parentMessageId: traceInfo.messageId
      });
    })
    .catch(error => {
      // 错误时也要传递追踪信息
      eventBus.emit('network:request:error', { error: error.message }, {
        parentTraceId: traceInfo.traceId,
        parentMessageId: traceInfo.messageId
      });
    });
});
```

## 🧪 测试和验证

### 运行测试

访问测试页面：`http://localhost:3000/common/event/test-tracing.html`

或使用代码测试：

```javascript
import { runMessageTracingTests } from './test-message-tracing.js';

// 运行完整测试套件
runMessageTracingTests().then(success => {
  if (success) {
    console.log('✅ 所有测试通过');
  } else {
    console.log('❌ 部分测试失败');
  }
});
```

### 自定义测试

```javascript
// 创建测试EventBus
const testBus = new EventBus({ enableTracing: true, moduleName: 'Test' });

// 测试基础功能
testBus.on('test:event', (data, traceInfo) => {
  console.log('测试事件处理成功');
});

const result = testBus.emit('test:event', { test: true });
const trace = testBus.getMessageTrace(result.messageId);

console.assert(trace !== null, '应该能获取追踪记录');
console.assert(trace.event === 'test:event', '事件名应该匹配');
```

## 🔧 故障排除

### 常见问题

1. **追踪信息为空**
   - 确保EventBus启用了追踪：`enableTracing: true`
   - 检查订阅者函数是否接受两个参数

2. **调用链断裂**
   - 确保级联事件正确传递了`parentTraceId`和`parentMessageId`
   - 检查异步操作中是否正确保存了追踪信息

3. **性能影响**
   - 在生产环境中适当减少`maxTraceSize`
   - 考虑只在特定条件下启用追踪

4. **内存泄漏**
   - 定期调用`clearTraceData()`清理旧数据
   - 监控追踪器状态：`getTracingStatus()`

### 调试命令

```javascript
// 查看追踪器状态
console.log(eventBus.getTracingStatus());

// 获取所有调用链ID
console.log(eventBus.getAllTraceIds());

// 获取性能统计
console.log(eventBus.getStats());

// 清理测试数据
eventBus.clearTraceData(Date.now());
```

## 📚 API 参考

### EventBus 方法

- `setTracing(enable, options)` - 启用/禁用追踪
- `getMessageTrace(messageId)` - 获取消息追踪记录
- `getTraceTree(traceId)` - 获取调用链树
- `clearTraceData(olderThan)` - 清理旧追踪数据
- `getStats(event?)` - 获取性能统计
- `getAllTraceIds()` - 获取所有调用链ID
- `getTracingStatus()` - 获取追踪器状态

### MessageTracer 类

- `generateMessageId()` - 生成唯一消息ID
- `recordMessage(trace)` - 记录消息追踪
- `getTrace(messageId)` - 获取追踪记录
- `buildTraceTree(traceId)` - 构建调用链树
- `getStats(event?)` - 获取性能统计
- `clearTraceData(olderThan)` - 清理数据

---

**版本**: 1.0
**更新时间**: 2025-09-23
**兼容性**: 完全向后兼容现有EventBus代码