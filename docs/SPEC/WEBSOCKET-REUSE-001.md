<!-- WEBSOCKET-REUSE-001.md -->
- **规范名称**: WebSocket通信复用规范
- **规范描述**: 本规范定义了项目中WebSocket通信的统一使用标准，确保所有WebSocket连接都使用common库中的WSClient类，实现连接管理、重连机制和消息处理的标准化。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有需要WebSocket通信的模块和组件
- **详细内容**: 
  1. **客户端复用**: 必须使用common/ws/ws-client.js中的WSClient类
  2. **连接管理**: 禁止直接使用原生WebSocket API创建连接
  3. **消息格式**: 必须遵循WSClient定义的消息格式标准
  4. **重连机制**: 必须使用WSClient内置的自动重连功能
  5. **事件集成**: WebSocket事件必须通过事件总线分发
  6. **错误处理**: WebSocket错误必须使用统一的错误处理机制

- **正向例子**:
  ```javascript
  // 正确使用WebSocket客户端
  import { WSClient } from '../../common/ws/ws-client.js';
  import { eventBus } from '../../common/event/event-bus.js';
  import { WEBSOCKET_EVENTS } from '../../common/event/event-constants.js';
  import { Logger } from '../../common/utils/logger.js';
  
  const logger = new Logger('WebSocketModule');
  
  // 创建WebSocket客户端实例
  const wsClient = new WSClient({
    url: 'ws://localhost:8080/ws',
    reconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5
  });
  
  // 监听连接状态变化
  eventBus.on(WEBSOCKET_EVENTS.CONNECTION.STATE_CHANGED, (state) => {
    logger.info(`WebSocket连接状态: ${state}`);
  });
  
  // 发送消息
  wsClient.send({
    type: 'pdf.load.request',
    data: { file: 'document.pdf', page: 1 }
  });
  
  // 监听特定类型的消息
  eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
    if (message.type === 'pdf.load.response') {
      handlePdfLoadResponse(message.data);
    }
  });
  
  // 主动关闭连接
  function disconnect() {
    wsClient.disconnect();
  }
  ```

- **反向例子**:
  ```javascript
  // 错误做法：直接使用原生WebSocket
  const ws = new WebSocket('ws://localhost:8080'); // 缺乏重连机制
  ws.onmessage = (event) => { /* 自定义处理 */ };
  
  // 错误做法：重复实现WebSocket客户端
  class MyWebSocketClient { /* 重复实现连接管理 */ }
  
  // 错误做法：硬编码消息处理
  eventBus.on('websocket-message', (msg) => {
    if (msg.type === 'some-type') { /* 缺乏常量定义 */ }
  });
  
  // 错误做法：忽略连接状态管理
  const ws = new WebSocket('ws://localhost:8080');
  // 没有处理断开重连的逻辑
  
  // 错误做法：自定义错误处理
  ws.onerror = (error) => {
    console.error('WebSocket错误:', error); // 缺乏统一错误处理
  };
  ```