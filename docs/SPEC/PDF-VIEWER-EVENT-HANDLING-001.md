- **规范名称**: PDF查看器事件处理规范
- **规范描述**: 规定PDF查看器模块中事件处理的标准化方法，包括WebSocket通信、事件订阅发布和错误处理，确保异步操作的可靠性和一致性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: PDF查看器前端模块的所有事件处理代码
- **详细内容**: 
  - 必须使用统一的事件常量定义事件名称
  - WebSocket通信必须包含连接状态管理
  - 必须处理网络异常和重连机制
  - 事件处理函数必须包含错误捕获
  - 必须提供清晰的事件数据格式定义
  - 必须实现事件的生命周期管理

- **正向例子**:
  ```javascript
  // 事件常量定义
  const PDF_EVENTS = {
    LOAD_START: 'pdf:load:start',
    LOAD_SUCCESS: 'pdf:load:success',
    LOAD_ERROR: 'pdf:load:error',
    PAGE_CHANGE: 'pdf:page:change',
    ZOOM_CHANGE: 'pdf:zoom:change'
  };

  // WebSocket事件处理
  class PdfWebSocketHandler {
    constructor() {
      this.ws = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
    }

    connect(url) {
      this.ws = new WebSocket(url);
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    }

    handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        eventBus.emit(data.type, data.payload);
      } catch (error) {
        console.error('WebSocket消息处理错误:', error);
        eventBus.emit(PDF_EVENTS.LOAD_ERROR, { error: '消息解析失败' });
      }
    }

    // 其他处理方法...
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：硬编码事件名称
  eventBus.on('pdf-loaded', handler); // 应该使用常量
  
  // 错误：缺乏错误处理
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data); // 可能抛出异常
    // 没有错误捕获
  };
  
  // 错误：缺乏连接状态管理
  let ws = new WebSocket(url); // 没有重连机制
  ws.onclose = () => {
    // 没有重连逻辑
  };
  
  // 错误：事件数据格式不一致
  eventBus.emit('pdf:load', 'filename.pdf'); // 应该使用对象格式
  eventBus.emit('pdf:load', { filename: 'file.pdf' }); // 格式不一致
  ```