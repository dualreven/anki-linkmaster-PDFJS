<![CDATA[<!-- PDFHOME-WEBSOCKET-INTEGRATION-001.md -->
- **规范名称**: PDF-Home WebSocket 集成规范
- **规范描述**: 规定 PDF-Home 模块中 WebSocket 客户端的使用和集成方式，确保实时通信的可靠性和错误处理。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: PDF-Home 模块中的 WebSocket 通信相关代码
- **详细内容**: 
  - WebSocket 客户端必须实现连接建立、维护和重连机制
  - 所有 WebSocket 消息必须通过事件总线进行分发
  - 必须处理连接状态变化并发布相应事件
  - 错误处理必须包括连接失败、消息发送失败等场景
  - 支持调试模式，便于监控通信状态

- **正向例子**:
  ```javascript
  // 正确：通过事件总线集成 WebSocket
  class WSClient {
    constructor(url, eventBus) {
      this.eventBus = eventBus;
      this.connect(url);
    }

    connect(url) {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.eventBus.emit(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED);
      };
      this.ws.onmessage = (event) => {
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, JSON.parse(event.data));
      };
    }

    sendMessage(data) {
      try {
        this.ws.send(JSON.stringify(data));
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, data);
      } catch (error) {
        this.eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED, { error, data });
      }
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：直接处理消息，未通过事件总线
  class WSClient {
    constructor(url) {
      this.ws = new WebSocket(url);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'pdf_list') {
          this.updatePDFList(data.pdfs); // 直接处理，违反事件驱动原则
        }
      };
    }
  }

  // 错误：缺少错误处理
  class WSClient {
    sendMessage(data) {
      this.ws.send(JSON.stringify(data)); // 没有错误处理
    }
  }

  // 错误：硬编码事件名称
  this.eventBus.emit('websocket_connected'); // 应该使用常量
  ```
]]>