<!-- COMMON-LIBRARY-REUSE-001.md -->
- **规范名称**: Common库工具复用规范
- **规范描述**: 本规范定义了在项目开发中如何正确复用common库中的现有工具和组件，避免重复造轮子，确保代码一致性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有前端模块开发，特别是新模块和功能扩展
- **详细内容**: 
  1. **事件总线复用要求**: 必须使用common/event/event-bus.js中的EventBus实例，禁止创建新的事件总线
  2. **日志记录器使用**: 必须使用common/utils/logger.js中的Logger类进行日志记录
  3. **WebSocket客户端复用**: 必须使用common/ws/ws-client.js中的WSClient类进行WebSocket通信
  4. **错误处理标准化**: 必须使用common/error/error-handler.js中的错误处理机制
  5. **事件常量引用**: 必须使用common/event/event-constants.js中定义的事件常量
  6. **工具类扩展原则**: 优先扩展现有工具类，而不是创建新的工具类

- **正向例子**:
  ```javascript
  // 正确使用common库工具
  import { eventBus } from '../../common/event/event-bus.js';
  import { Logger } from '../../common/utils/logger.js';
  import { PDF_MANAGEMENT_EVENTS } from '../../common/event/event-constants.js';
  import { ErrorHandler } from '../../common/error/error-handler.js';
  
  // 创建模块专用的日志记录器
  const logger = new Logger('MyModule');
  
  // 使用事件总线发布事件
  eventBus.emit(PDF_MANAGEMENT_EVENTS.ADD.REQUESTED, { file: 'document.pdf' });
  
  // 使用错误处理器
  const errorHandler = new ErrorHandler(eventBus);
  errorHandler.handleError(new Error('操作失败'), 'MyModule');
  ```

- **反向例子**:
  ```javascript
  // 错误做法：重复创建事件总线
  class MyEventBus { /* 重复实现 */ }
  
  // 错误做法：使用console.log直接记录日志
  console.log('操作开始'); // 缺乏结构化日志
  
  // 错误做法：硬编码事件名称
  eventBus.emit('my-custom-event', data); // 缺乏常量定义
  
  // 错误做法：自定义错误处理
  try { /* 操作 */ } catch (e) {
    alert('出错啦！'); // 缺乏统一的错误处理
  }
  ```