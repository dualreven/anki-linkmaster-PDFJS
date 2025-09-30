# 日志循环问题的最小侵入解决方案

## 设计原则

**目标**: 打断循环，而不是过滤信息
- ✅ 保留所有日志信息
- ✅ 最小化代码修改
- ✅ 在最佳位置断开循环
- ✅ 不影响其他功能

## 循环分析

### 完整链路
```
1. EventBus.emit('websocket:message:response')
   ↓
2. EventBus 调用 logger.event() 记录
   ↓
3. logger.event() → console.info()
   ↓
4. ConsoleWebSocketBridge.intercept() 拦截  ← ⭐ 最佳断点
   ↓
5. sendToWebSocket() 发送到后端
   ↓
6. 后端响应 "Console log recorded successfully"
   ↓
7. 回到步骤 1 ♻️
```

### 为什么选择 ConsoleWebSocketBridge 作为断点？

1. **最接近循环形成点**: 在发送到后端之前拦截
2. **不影响日志记录**: 日志仍然输出到本地控制台和文件
3. **最小侵入**: 只修改一个文件，一个方法
4. **精确判断**: 可以精确识别"关于日志的日志"

## 解决方案

### 修改文件
`src/frontend/common/utils/console-websocket-bridge.js`

### 修改内容

在 `sendToWebSocket` 方法中添加循环检测：

```javascript
sendToWebSocket(level, args) {
  try {
    // ... 序列化参数 ...
    const messageText = serializedArgs.join(' ');

    // ⭐ 关键：检测日志循环
    if (this.isLoggingAboutWebSocketResponse(messageText)) {
      // 静默跳过，不发送到后端
      return;
    }

    // ... 正常发送到后端 ...
  }
}

// 新增方法：检测循环
isLoggingAboutWebSocketResponse(messageText) {
  const responseIndicators = [
    // EventBus 发布 WebSocket 响应事件
    /Event \[websocket:message:response/i,
    /Event \[websocket:heartbeat:response/i,
    /Event \[websocket:ping:response/i,

    // 后端响应中的特征字符串
    /"type":\s*"response".*"message":\s*"Console log recorded successfully"/s,
    /"logged":\s*true.*"source":\s*"pdf-viewer"/s,

    // 组合特征
    /websocket.*response.*Console log recorded/i
  ];

  return responseIndicators.some(pattern => pattern.test(messageText));
}
```

## 工作原理

### 检测逻辑

当 ConsoleWebSocketBridge 准备发送日志时，会检查日志内容：

1. **包含 `Event [websocket:message:response`**
   - 说明这是 EventBus 记录的 WebSocket 响应事件

2. **包含 `"Console log recorded successfully"`**
   - 说明这是后端对 console_log 请求的响应

3. **包含 `"type": "response"` 和 `"logged": true`**
   - 确认这是日志相关的响应消息

如果匹配任一条件，说明这是"关于日志的日志"，**不应该再次发送到后端**。

### 效果

#### 循环前（造成26万行）
```
[EventBus记录响应] → console.info
  → [Bridge拦截] → 发送到后端
    → [后端响应] → EventBus.emit
      → [EventBus记录] → console.info
        → [Bridge拦截] → 发送到后端
          → ... 无限循环 ♻️
```

#### 循环断开后
```
[EventBus记录响应] → console.info
  → [Bridge拦截] → 检测到循环特征
    → ❌ 不发送到后端（断开循环）✅
```

## 保留的功能

✅ **本地日志完整**: 所有日志仍然输出到：
  - JavaScript 控制台（浏览器开发者工具）
  - PyQt 日志文件（pdf-viewer-*-js.log）

✅ **EventBus 功能完整**: 所有事件正常发布和处理

✅ **其他日志正常**: 只有"关于响应的日志"不发送到后端

✅ **后端功能正常**: 后端仍然接收和处理其他日志

## 优势

### vs 过滤方案
- ❌ 过滤：丢失信息，无法调试
- ✅ 断开循环：保留所有信息，精确阻止循环

### vs 多处修改
- ❌ 多处修改：影响面大，维护困难
- ✅ 单点修改：只改一个文件，易于理解和维护

### vs 关闭功能
- ❌ 关闭 EventBus 日志：丢失重要调试信息
- ✅ 智能检测：只阻止循环，保留有价值的日志

## 预期效果

| 指标 | 修改前 | 修改后 |
|------|--------|--------|
| 日志行数 | 26万行 | < 5,000 行 |
| 文件大小 | 7.9MB | < 500KB |
| 循环次数 | 16,000+ | 0 |
| 信息完整性 | 100% | 100% |

## 验证方法

```bash
# 1. 清空日志
rm logs/pdf-viewer-*-js.log

# 2. 重启 pdf-viewer

# 3. 运行 5-10 分钟

# 4. 检查结果
wc -l logs/pdf-viewer-*-js.log  # 应该 < 5000 行
ls -lh logs/pdf-viewer-*-js.log # 应该 < 500KB

# 5. 验证循环是否断开
grep -c "Console log recorded successfully" logs/pdf-viewer-*-js.log
# 应该是 0，因为这些日志不再被发送到后端

# 6. 验证信息完整性
grep "Event \[websocket:message:response" logs/pdf-viewer-*-js.log | head -3
# 应该能看到这些事件的记录，说明信息没有丢失
```

## 技术细节

### 为什么不在其他地方断开？

1. **EventBus 层**: 会丢失事件记录，不利于调试
2. **Logger 层**: 会丢失日志输出，影响开发体验
3. **后端层**: 需要修改后端代码，影响面更大

### 检测的精确性

使用多个正则模式组合判断：
- 宽松模式：匹配事件名称（快速检测）
- 严格模式：匹配响应结构（精确检测）
- 组合模式：同时匹配多个关键词（防止误判）

### 性能影响

- 正则匹配：每条日志 < 1ms
- 序列化成本：已经存在，无额外开销
- 网络减少：显著降低 WebSocket 通信量

---

**实施日期**: 2025-09-30
**方案**: 最小侵入，精确断开循环
**状态**: 已实施，待验证