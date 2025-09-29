# 🔍 EventBus事件追踪功能启用指南

## 当前状态
- **追踪功能状态**: ✅ 已完整实现，❌ 未被启用
- **默认行为**: 不输出追踪日志，普通EventBus没有追踪能力

## 方法一：临时启用（推荐用于调试）

### 1. 修改特定模块的导入
```javascript
// 原来的导入（无追踪）
import { EventBus } from '../common/event/event-bus.js';

// 改为（有追踪）
import { EventBus } from '../common/event/event-bus-with-tracing.js';
```

### 2. 在初始化时启用追踪
```javascript
// pdf-home/app.js 或 pdf-viewer/app.js
const eventBus = new EventBus({
    enableTracing: true,        // 启用追踪
    moduleName: 'PDFHome',      // 模块名称
    maxTraceSize: 500,          // 最大追踪记录数
    enablePerformanceTracking: true  // 启用性能统计
});
```

### 3. 查看追踪日志
追踪日志会通过Logger输出到：
- 浏览器控制台
- 日志文件：`logs/pdf-home-js.log` 或 `logs/pdf-viewer-<id>-js.log`

## 方法二：全局启用（永久修改）

### 步骤1: 替换event-bus.js的内容
```bash
# 备份原文件
cp src/frontend/common/event/event-bus.js src/frontend/common/event/event-bus-original.js

# 用追踪版本替换
cp src/frontend/common/event/event-bus-with-tracing.js src/frontend/common/event/event-bus.js
```

### 步骤2: 配置默认启用追踪
在 `event-bus.js` 中修改默认配置：
```javascript
constructor(options = {}) {
    this.#enableTracing = options.enableTracing !== false;  // 默认启用
    // ...
}
```

## 方法三：条件启用（推荐用于生产）

### 创建环境检测启用
```javascript
// 在 app.js 中
const isDevelopment = window.location.hostname === 'localhost';
const isDebugMode = localStorage.getItem('debug-event-tracing') === 'true';

const eventBus = new EventBus({
    enableTracing: isDevelopment || isDebugMode,
    moduleName: 'PDFHome',
    maxTraceSize: isDevelopment ? 1000 : 100
});
```

### 通过控制台动态启用
```javascript
// 在浏览器控制台执行
localStorage.setItem('debug-event-tracing', 'true');
location.reload(); // 刷新页面生效
```

## 📊 查看追踪数据的方法

### 1. 实时查看控制台日志
```javascript
// 追踪日志格式
[2025-09-30 14:23:45] [EventBus] [DEBUG] 记录消息追踪: pdf:open:requested (msg_1695123456789_1)
[2025-09-30 14:23:45] [EventBus] [INFO] pdf:open:requested (发布 by PDFManager:156)
```

### 2. 通过API查询追踪数据
```javascript
// 在浏览器控制台
const eventBus = window.app?.container?.get('eventBus');

// 获取最近的消息追踪
const messageId = 'msg_1695123456789_1';
const trace = eventBus.getMessageTrace(messageId);
console.log(trace);

// 获取调用链树
const traceId = 'msg_1695123456789_1';
const tree = eventBus.getTraceTree(traceId);
console.log(tree);

// 查看性能统计
const stats = eventBus.getStats();
console.log(stats);
```

### 3. 导出追踪数据
```javascript
// 获取所有追踪ID
const allTraceIds = eventBus.getAllTraceIds();

// 导出为JSON
const traces = allTraceIds.map(id => eventBus.getTraceTree(id));
const dataStr = JSON.stringify(traces, null, 2);
const dataBlob = new Blob([dataStr], {type: 'application/json'});
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = `event-traces-${Date.now()}.json`;
link.click();
```

## 🎯 追踪输出示例

### 控制台输出
```
[14:23:45.678] [EventBus] [EVENT] pdf:list:dblclick (发布 by TableRow:42)
  → messageId: msg_001, traceId: msg_001
  → 订阅者: [PDFManager, Logger]
  → 执行时间: 3ms

[14:23:45.680] [EventBus] [EVENT] pdf:open:requested (发布 by PDFManager:156)
  → messageId: msg_002, traceId: msg_001, parentId: msg_001
  → 订阅者: [WebSocketHandler]
  → 执行时间: 12ms
```

### 日志文件输出
位置：`logs/pdf-home-js.log`
```
2025-09-30 14:23:45.678 [INFO] [EventBus] pdf:list:dblclick (发布 by TableRow:42)
2025-09-30 14:23:45.679 [DEBUG] [MessageTracer] 记录消息追踪: pdf:list:dblclick (msg_001)
2025-09-30 14:23:45.680 [INFO] [EventBus] pdf:open:requested (发布 by PDFManager:156)
2025-09-30 14:23:45.681 [DEBUG] [MessageTracer] 记录消息追踪: pdf:open:requested (msg_002)
```

## ⚠️ 注意事项

1. **性能影响**：启用追踪会增加约5-10ms的开销
2. **内存使用**：默认保留最近1000条追踪记录
3. **日志文件大小**：追踪日志会快速增长，建议定期清理
4. **生产环境**：建议只在需要调试时启用

## 🚀 快速测试

1. 打开测试页面：http://localhost:3000/test-event-tracing-demo.html
2. 点击演示按钮查看追踪效果
3. 打开浏览器开发者工具查看控制台日志

## 📋 检查清单

- [ ] 选择启用方式（临时/全局/条件）
- [ ] 修改相应的导入语句
- [ ] 配置追踪参数
- [ ] 验证日志输出
- [ ] 测试性能影响