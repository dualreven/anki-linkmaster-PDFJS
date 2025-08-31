<!-- IMPLEMENTATION-GUIDE-001.md -->
- **规范名称**: 规范实施指南
- **规范描述**: 本指南提供了在实际开发中如何正确应用各项规范的具体示例和最佳实践，帮助开发人员快速理解和实施规范要求。
- **当前版本**: 1.0
- **所属范畴**: 文档规范
- **适用范围**: 所有开发人员和代码审查人员
- **详细内容**: 

## 完整开发示例：PDF查看器模块

### 1. 模块初始化（遵循COMMON-LIBRARY-REUSE-001）
```javascript
// pdf-viewer/main.js
import { eventBus } from '../../common/event/event-bus.js';
import { Logger, LogLevel } from '../../common/utils/logger.js';
import { ErrorHandler } from '../../common/error/error-handler.js';
import { WSClient } from '../../common/ws/ws-client.js';
import { 
  PDF_VIEWER_EVENTS,
  WEBSOCKET_EVENTS,
  SYSTEM_EVENTS 
} from '../../common/event/event-constants.js';

// 创建模块专用的工具实例
const logger = new Logger('PDFViewer', LogLevel.INFO);
const errorHandler = new ErrorHandler(eventBus);

// 创建WebSocket客户端
const wsClient = new WSClient({
  url: 'ws://localhost:8080/pdf-ws',
  reconnect: true,
  reconnectInterval: 3000
});
```

### 2. 事件处理（遵循EVENT-NAMING-CONVENTION-001）
```javascript
// 监听PDF相关事件
eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (data) => {
  logger.info('收到文件加载请求', data);
  handleFileLoad(data.file);
});

// 发布事件
eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PAGE_CHANGE, {
  page: currentPage,
  total: totalPages
});
```

### 3. 错误处理（遵循ERROR-HANDLING-UNIFIED-001）
```javascript
async function loadPdfFile(file) {
  try {
    logger.info('开始加载PDF文件', { file: file.name });
    
    // 业务逻辑
    if (!isValidPdfFormat(file)) {
      throw errorHandler.createBusinessError(
        '文件格式不支持',
        'INVALID_PDF_FORMAT'
      );
    }
    
    // 加载操作
    const pdfDoc = await loadPdfDocument(file);
    logger.info('PDF文件加载成功', { pages: pdfDoc.numPages });
    
  } catch (error) {
    errorHandler.handleError(error, 'PDFViewer:loadPdfFile');
  }
}
```

### 4. WebSocket通信（遵循WEBSOCKET-REUSE-001）
```javascript
// 监听WebSocket消息
eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
  switch (message.type) {
    case 'pdf.render.complete':
      handleRenderComplete(message.data);
      break;
    case 'pdf.annotation.update':
      handleAnnotationUpdate(message.data);
      break;
  }
});

// 发送WebSocket消息
function requestPdfRender(pageNumber) {
  wsClient.send({
    type: 'pdf.render.request',
    data: { page: pageNumber, quality: 'high' }
  });
}
```

### 5. 日志记录（遵循LOGGING-STANDARD-001）
```javascript
function processPdfOperations(file, operations) {
  logger.debug('开始处理PDF操作', {
    file: file.name,
    operationCount: operations.length,
    operations: operations.map(op => op.type)
  });
  
  operations.forEach((operation, index) => {
    logger.info(`处理操作 ${index + 1}/${operations.length}`, {
      operation: operation.type,
      parameters: operation.params
    });
    
    // 执行操作
    executeOperation(operation);
    
    logger.debug('操作执行完成', { 
      operation: operation.type,
      result: 'success'
    });
  });
  
  logger.info('所有PDF操作处理完成', {
    totalOperations: operations.length,
    duration: calculateDuration()
  });
}
```

## 规范实施检查清单

1. ✅ 是否使用了common库中的现有工具（EventBus, Logger, WSClient, ErrorHandler）
2. ✅ 事件命名是否遵循`模块:操作:状态`格式并使用常量定义
3. ✅ 错误处理是否使用统一的ErrorHandler和错误类型
4. ✅ WebSocket通信是否使用WSClient而非原生API
5. ✅ 日志记录是否使用Logger类而非console
6. ✅ 是否避免了重复造轮子和硬编码
7. ✅ 代码是否具有良好的可读性和可维护性

## 常见问题解答

**Q: 如果common库中没有我需要的功能怎么办？**
A: 首先考虑扩展现有工具类，如果确实需要新功能，应先与架构师讨论，确保新功能符合规范体系。

**Q: 如何确保团队所有成员都遵循这些规范？**
A: 使用"规范审查师"AI进行代码审查，在CI/CD流程中加入规范检查，定期进行规范培训。

**Q: 规范会不会限制开发灵活性？**
A: 规范旨在提高代码质量和维护性，合理的扩展和创新是鼓励的，但需要在规范框架内进行。