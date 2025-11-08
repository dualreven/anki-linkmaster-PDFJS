# PDF-Viewer 日志循环根本原因分析

## 问题现象

日志文件 `pdf-viewer-test-js.log` 达到：
- **26万行**
- **7.9MB**
- **16,000+ 重复**的 "Console log recorded successfully" 响应

## 根本原因分析

### 完整的日志循环链路

```
┌────────────────────────────────────────────────────────────┐
│ 1. EventBus.emit('websocket:message:response', data)      │
│    触发原因: WSClient 接收到后端的响应消息                  │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 2. EventBus 内部调用 logger.event() 记录事件               │
│    代码位置: event-bus.js:348 和 404 行                    │
│    输出格式: "Event [websocket:message:response]: 发布 ..." │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 3. logger.event() 调用 console.info()                     │
│    代码位置: logger.js:168 行                              │
│    输出到: JavaScript 控制台                               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 4. ConsoleWebSocketBridge 拦截 console.info()             │
│    代码位置: console-websocket-bridge.js:32-36 行          │
│    原因: Bridge 劫持了所有 console 方法                     │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 5. Bridge 检查过滤规则 shouldSkipMessage()                │
│    代码位置: console-websocket-bridge.js:91-100 行         │
│    结果: ❌ 不匹配                                         │
│    原因: 过滤规则 = "Console log recorded successfully"   │
│          实际消息 = "Event [websocket:message:response]..." │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 6. Bridge.sendToWebSocket() 发送日志到后端                │
│    代码位置: console-websocket-bridge.js:108-139 行        │
│    发送内容: { type: 'console_log', message: "Event ..." } │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 7. WSClient.send() 通过 WebSocket 发送                    │
│    代码位置: app-container.js:78 行                        │
│    发送到: 后端 msgCenter 服务器                           │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 8. 后端处理 console_log 请求                              │
│    代码位置: standard_server.py (后端)                     │
│    处理: 记录日志到文件                                     │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 9. 后端返回响应                                            │
│    响应内容: {                                             │
│      "message": "Console log recorded successfully",      │
│      "status": "success"                                  │
│    }                                                      │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│ 10. WSClient 接收响应                                      │
│     代码位置: ws-client.js (message 事件处理)              │
│     触发: EventBus.emit('websocket:message:response')     │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
                   回到步骤 1 ♻️ 无限循环
```

## 为什么之前的过滤规则没有生效？

### app-container.js 中的过滤规则（第 65 行）
```javascript
'Console log recorded successfully' // 后端响应确认
```

### 实际的日志消息格式
```
Event [websocket:message:response (发布 by WSClient) - 无订阅者]: 发布 {
  "actorId": "WSClient",
  "subscriberCount": 0,
  "data": {
    "type": "response",
    "message": "Console log recorded successfully",  // ← 这里才是真正的内容
    ...
  }
}
```

**问题**: 过滤规则只匹配纯文本 "Console log recorded successfully"，但实际日志被包装在 EventBus 的事件输出中，格式是 "Event [...]..."，所以无法匹配！

## 解决方案设计

### 方案对比

| 方案 | 优点 | 缺点 | 采用 |
|------|------|------|------|
| 1. EventBus 不记录 WebSocket 响应事件 | 从源头解决，彻底断开循环 | 需要修改核心EventBus | ✅ **主方案** |
| 2. 优化 ConsoleWebSocketBridge 过滤规则 | 简单直接，增加防护层 | 治标不治本 | ✅ **辅助方案** |
| 3. Logger.event() 过滤响应事件 | 实现简单 | 治标不治本，不够优雅 | ❌ 已撤销 |
| 4. WSClient 不为 console_log 响应发布事件 | 最彻底 | 可能影响其他功能 | ❌ 风险太大 |

### 最终采用方案：方案 1 + 方案 2 组合

**方案 1**: 在 EventBus 中过滤低价值的 WebSocket 响应事件
**方案 2**: 优化 ConsoleWebSocketBridge 的过滤规则（双重防护）

## 实施细节

### 修改 1: event-bus.js（第 347-361 行和 409-424 行）

```javascript
// 有订阅者的情况
if (subscribers && subscribers.size > 0) {
  // 过滤低价值的WebSocket响应事件，避免日志循环
  const shouldLogEvent = !event.includes('websocket:message:response') &&
                        !event.includes('websocket:heartbeat:response') &&
                        !event.includes('websocket:ping:response');

  if (shouldLogEvent) {
    this.#log("event", `${event} (发布 by ${actorId || "unknown"})`, "发布", {
      actorId,
      subscriberCount: subscribers.size,
      data,
      messageId,
      traceId
    });
  }
  // 订阅者回调继续正常执行...
}

// 无订阅者的情况（同样的过滤逻辑）
else {
  const shouldLogEvent = !event.includes('websocket:message:response') &&
                        !event.includes('websocket:heartbeat:response') &&
                        !event.includes('websocket:ping:response');

  if (shouldLogEvent) {
    this.#log("event", `${event} (发布 by ${actorId || "unknown"}) - 无订阅者`, "发布", {
      actorId,
      subscriberCount: 0,
      data,
      messageId,
      traceId
    });
  }
}
```

**效果**:
- EventBus 仍然会**正常发布和处理**这些事件
- 只是**不记录日志**，避免触发 console.info()
- 不影响事件的订阅者接收和处理

### 修改 2: app-container.js（第 58-69 行）

```javascript
const pdfViewerSkipPatterns = [
  'PDF\\.js.*worker.*ready',
  'Canvas.*render.*progress',
  'Page.*\\d+.*rendered',
  'Zoom.*level.*\\d+\\.\\d+',
  'Scroll.*position.*\\d+',
  'WebSocket.*ping.*pong',
  'Console log recorded successfully',
  'Event \\[websocket:message:response',  // ← 新增：匹配事件格式
  'Event \\[websocket:heartbeat:response', // ← 新增
  'Event \\[websocket:ping:response'      // ← 新增
];
```

**效果**:
- 如果 EventBus 过滤失效，ConsoleWebSocketBridge 作为第二层防护
- 直接匹配 "Event [websocket:message:response" 格式
- 双重保障，确保不会循环

## 预期效果

### 优化前
- 日志行数: 26万行
- 文件大小: 7.9MB
- WebSocket响应: 16,000+ 条重复

### 优化后
- 日志行数: 预计 < 5,000 行（减少 98%+）
- 文件大小: 预计 < 500KB（减少 95%+）
- WebSocket响应: 0 条（完全消除循环）

## 设计原则

1. **分层防护**:
   - 第一层：EventBus 源头过滤
   - 第二层：ConsoleWebSocketBridge 拦截过滤

2. **不影响功能**:
   - 事件仍然正常发布和处理
   - 订阅者仍然能收到事件
   - 只是不记录日志

3. **保留必要日志**:
   - 只过滤低价值的响应事件
   - 保留重要的业务事件日志
   - 保留错误和警告日志

4. **性能优化**:
   - 减少不必要的日志操作
   - 减少 WebSocket 通信次数
   - 减少后端处理压力

## 验证方法

1. **清空旧日志**:
   ```bash
   rm logs/pdf-viewer-*-js.log
   ```

2. **重启 pdf-viewer**

3. **运行 5-10 分钟**

4. **检查结果**:
   ```bash
   # 查看行数
   wc -l logs/pdf-viewer-*-js.log

   # 查看文件大小
   ls -lh logs/pdf-viewer-*-js.log

   # 检查是否还有响应事件
   grep -c "websocket:message:response" logs/pdf-viewer-*-js.log

   # 应该返回 0
   ```

## 经验教训

1. **不要头痛医头**: 简单的过滤只是治标，必须找到根本原因
2. **理解完整链路**: 必须追踪从源头到终点的完整流程
3. **分层防护**: 关键问题需要多层保护机制
4. **测试验证**: 修改后必须充分测试验证效果

---

**分析日期**: 2025-09-30
**版本**: v1.0
**状态**: 已实施，待验证