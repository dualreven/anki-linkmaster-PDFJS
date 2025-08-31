<!-- ERROR-HANDLING-UNIFIED-001.md -->
- **规范名称**: 统一错误处理规范
- **规范描述**: 本规范定义了项目中错误处理的统一标准和模式，确保错误信息的 consistency、可读性和可维护性，便于错误追踪和用户提示。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有需要错误处理的模块和组件
- **详细内容**: 
  1. **错误类型分类**: 必须使用ErrorHandler中定义的错误类型（BUSINESS, NETWORK, SYSTEM）
  2. **错误创建**: 必须使用ErrorHandler的createXxxError方法创建错误实例
  3. **错误处理**: 必须使用ErrorHandler的handleError方法处理错误
  4. **错误信息**: 错误消息必须清晰、具体，包含足够的上下文信息
  5. **用户提示**: 必须通过事件总线显示用户友好的错误提示
  6. **错误日志**: 所有错误必须通过Logger记录结构化日志

- **正向例子**:
  ```javascript
  // 正确使用错误处理机制
  import { ErrorHandler, ErrorType } from '../../common/error/error-handler.js';
  import { eventBus } from '../../common/event/event-bus.js';
  import { Logger } from '../../common/utils/logger.js';
  
  const logger = new Logger('MyModule');
  const errorHandler = new ErrorHandler(eventBus);
  
  // 创建业务错误
  const businessError = errorHandler.createBusinessError(
    '文件格式不支持', 
    'FILE_FORMAT_UNSUPPORTED'
  );
  
  // 创建网络错误
  const networkError = errorHandler.createNetworkError(
    'WebSocket连接超时',
    'WS_CONNECTION_TIMEOUT'
  );
  
  // 处理错误
  try {
    // 可能抛出错误的操作
    someRiskyOperation();
  } catch (error) {
    // 统一错误处理
    errorHandler.handleError(error, 'MyModule:someOperation');
  }
  
  // 主动抛出错误
  if (!isValidFile(format)) {
    throw errorHandler.createBusinessError(
      `不支持的文件格式: ${format}`,
      'INVALID_FILE_FORMAT'
    );
  }
  ```

- **反向例子**:
  ```javascript
  // 错误做法：直接抛出普通Error
  throw new Error('文件加载失败'); // 缺乏错误类型和代码
  
  // 错误做法：使用alert直接提示用户
  try { /* 操作 */ } catch (e) {
    alert('出错啦！'); // 缺乏统一的用户提示机制
  }
  
  // 错误做法：使用console.error记录日志
  catch (error) {
    console.error('错误发生:', error); // 缺乏结构化日志
  }
  
  // 错误做法：忽略错误
  try { /* 操作 */ } catch (e) {
    // 空catch块，错误被静默忽略
  }
  
  // 错误做法：自定义错误类型
  class MyCustomError extends Error { /* 重复造轮子 */ }
  throw new MyCustomError('自定义错误');
  ```