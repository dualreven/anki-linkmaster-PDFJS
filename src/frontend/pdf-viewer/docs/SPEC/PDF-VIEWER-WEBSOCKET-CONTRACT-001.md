**规范名称**: WebSocket消息契约与可靠性规范
**规范描述**: 定义WebSocket消息契约与可靠性规范，包括消息格式、trace/request_id、心跳机制、重连策略、幂等性、错误码、负载策略、安全示例和测试用例。
**当前版本**: 1.0
**所属范畴**: 通信协议规范
**适用范围**: PDF查看器WebSocket通信

**详细内容**:
- 消息格式：使用JSON格式，包含必要的元数据字段
- 请求追踪：每个请求包含唯一的request_id用于追踪和幂等性
- 心跳机制：实现心跳包维持连接，检测连接状态
- 重连策略：断线后自动重连，最多3次重连尝试
- 错误处理：统一的错误码体系和错误消息格式
- 负载策略：支持消息分片和批量处理

**验证方法**:
- 测试WebSocket在断线后3次重连内可恢复，且请求不重复处理
- 验证消息格式符合JSON schema，包含必要元数据
- 检查心跳和超时机制工作正常
- 确认错误处理统一，有明确的错误码
- 运行压力测试验证负载策略有效性

**正向例子**:
```javascript
// 正确的消息格式
const message = {
  type: 'pdf:render:request',
  request_id: 'req_1234567890',
  timestamp: Date.now(),
  data: {
    page_number: 1,
    scale: 1.5
  }
};

// 心跳机制
setInterval(() => {
  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({
      type: 'heartbeat',
      timestamp: Date.now()
    }));
  }
}, 30000);

// 重连策略
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

function reconnect() {
  if (reconnectAttempts < maxReconnectAttempts) {
    reconnectAttempts++;
    setTimeout(connectWebSocket, 1000 * reconnectAttempts);
  }
}
```

**反向例子**:
```javascript
// 错误的消息格式 - 缺少必要字段
const badMessage = {
  page: 1,
  scale: 1.5
  // 缺少type和request_id
};

// 无重连机制
websocket.onclose = () => {
  // 无重连逻辑，连接断开后无法恢复
};

// 无错误处理
websocket.onerror = (error) => {
  console.log(error); // 缺少统一的错误处理
};