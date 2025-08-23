# 前端事件设计规范

## 概述
本规范定义了前端事件系统的设计原则、命名规则、使用方法和最佳实践。适用于所有前端JavaScript模块的事件驱动开发，确保事件系统的一致性、可维护性和可扩展性。

## 具体规范

### 事件命名规范

**要求**：事件名称必须遵循 `{module}:{action}:{status}` 格式，确保命名的一致性和可读性。

**示例**：
```javascript
// 符合规范的事件名称
'app:initialization:started'
'websocket:connection:established'
'pdf:management:add_completed'
'ui:error:show'
```

**反例**：
```javascript
// 不符合规范的事件名称
'app_init_started'  // 缺少冒号分隔
'initialization:started'  // 缺少模块部分
'app:initialization'  // 缺少状态部分
'APP:INITIALIZATION:STARTED'  // 使用大写（应使用小写）
```

### 事件常量定义

**要求**：所有事件名称必须定义为常量，按模块分组管理，避免硬编码事件名称。

**示例**：
```javascript
// 符合规范的常量定义
export const APP_EVENTS = {
  INITIALIZATION: {
    STARTED: 'app:initialization:started',
    COMPLETED: 'app:initialization:completed',
    FAILED: 'app:initialization:failed'
  }
};

export const WEBSOCKET_EVENTS = {
  CONNECTION: {
    ESTABLISHED: 'websocket:connection:established',
    CLOSED: 'websocket:connection:closed',
    ERROR: 'websocket:connection:error'
  }
};
```

**反例**：
```javascript
// 不符合规范的硬编码事件名称
eventBus.emit('app:initialization:started');

// 不符合规范的扁平化常量结构
export const EVENTS = {
  APP_INIT_STARTED: 'app:initialization:started',
  WS_CONNECTED: 'websocket:connection:established'
};
```

### 事件总线实现

**要求**：事件总线必须支持事件名称验证、调试日志、错误处理和性能监控功能。

**示例**：
```javascript
// 符合规范的事件总线实现
class EventBus {
  constructor(options = {}) {
    this.events = {};
    this.enableValidation = options.enableValidation !== false;
    this.enableDebug = options.enableDebug !== false;
    this.logger = new Logger('EventBus');
  }
  
  on(event, callback) {
    if (this.enableValidation) {
      const validationError = EventNameValidator.getValidationError(event);
      if (validationError) {
        throw new Error(`事件名称无效: ${validationError}`);
      }
    }
    // 订阅逻辑
  }
  
  emit(event, data) {
    // 验证和发布逻辑
    const startTime = performance.now();
    // 执行事件处理
    const endTime = performance.now();
    this.logger.debug(`事件处理时间: ${(endTime - startTime).toFixed(2)}ms`);
  }
}
```

**反例**：
```javascript
// 不符合规范的简单事件总线
class SimpleEventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    // 缺少验证和日志
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  emit(event, data) {
    // 缺少错误处理和性能监控
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  }
}
```

### 事件处理函数规范

**要求**：事件处理函数必须包含错误处理，避免单个处理函数的错误影响其他订阅者。

**示例**：
```javascript
// 符合规范的事件处理
eventBus.on('pdf:management:add_completed', (data) => {
  try {
    // 处理逻辑
    updatePDFList(data.pdfs);
    showSuccessMessage('PDF添加成功');
  } catch (error) {
    logger.error('PDF添加完成处理失败', error);
    eventBus.emit('ui:error:show', {
      message: '处理PDF添加结果时发生错误',
      type: 'system'
    });
  }
});
```

**反例**：
```javascript
// 不符合规范的事件处理（缺少错误处理）
eventBus.on('pdf:management:add_completed', (data) => {
  // 可能抛出异常但未捕获
  updatePDFList(data.pdfs);
  showSuccessMessage('PDF添加成功');
});
```

### 事件生命周期管理

**要求**：组件必须正确管理事件订阅的生命周期，在组件销毁时取消所有订阅。

**示例**：
```javascript
// 符合规范的订阅管理
class PDFManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.subscriptions = [];
  }
  
  initialize() {
    // 订阅事件并保存取消函数
    const unsubscribe1 = this.eventBus.on(
      'websocket:message:pdf_list_updated', 
      this.handlePDFListUpdated.bind(this)
    );
    
    const unsubscribe2 = this.eventBus.on(
      'pdf:management:add_requested', 
      this.handleAddRequest.bind(this)
    );
    
    this.subscriptions.push(unsubscribe1, unsubscribe2);
  }
  
  destroy() {
    // 取消所有订阅
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
}
```

**反例**：
```javascript
// 不符合规范的订阅管理（内存泄漏风险）
class PDFManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }
  
  initialize() {
    // 订阅但未保存取消函数
    this.eventBus.on('websocket:message:pdf_list_updated', (data) => {
      this.handlePDFListUpdated(data);
    });
  }
  
  // 缺少destroy方法，无法取消订阅
}
```

### 事件数据传递规范

**要求**：事件数据必须包含完整的上下文信息，包括时间戳、来源模块和相关元数据。

**示例**：
```javascript
// 符合规范的事件数据
const eventData = {
  pdf: {
    id: 'pdf_001',
    filename: 'document.pdf',
    size: 1024000
  },
  metadata: {
    timestamp: new Date().toISOString(),
    source: 'PDFManager',
    action: 'add',
    correlationId: generateCorrelationId()
  }
};

eventBus.emit('pdf:management:add_completed', eventData);
```

**反例**：
```javascript
// 不符合规范的事件数据（缺少上下文）
eventBus.emit('pdf:management:add_completed', {
  pdf: {
    id: 'pdf_001',
    filename: 'document.pdf'
  }
});
```

### 事件调试和监控

**要求**：事件系统必须提供完整的调试信息，包括事件发布、订阅、处理时间和错误统计。

**示例**：
```javascript
// 符合规范的调试实现
class EventBus {
  emit(event, data) {
    const startTime = performance.now();
    const subscriberCount = this.events[event]?.length || 0;
    
    this.logger.event(event, '发布开始', {
      dataSummary: this.formatDataSummary(data),
      subscriberCount
    });
    
    let successCount = 0;
    let errorCount = 0;
    
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
          successCount++;
        } catch (error) {
          errorCount++;
          this.logger.error('事件处理错误', { event, error: error.message });
        }
      });
    }
    
    const processingTime = (performance.now() - startTime).toFixed(2);
    this.logger.event(event, '发布完成', {
      successCount,
      errorCount,
      processingTime: `${processingTime}ms`
    });
  }
}
```

**反例**：
```javascript
// 不符合规范的简单实现（缺少调试信息）
class EventBus {
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(data); // 无错误处理，无性能监控
      });
    }
  }
}
```

### 事件优先级和顺序

**要求**：对于需要特定执行顺序的事件，必须实现优先级机制或使用链式调用模式。

**示例**：
```javascript
// 符合规范的优先级实现
class PriorityEventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback, priority = 0) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push({ callback, priority });
    // 按优先级排序（数字越大优先级越高）
    this.events[event].sort((a, b) => b.priority - a.priority);
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(({ callback }) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`优先级事件处理错误: ${event}`, error);
        }
      });
    }
  }
}
```

**反例**：
```javascript
// 不符合规范的无序执行
eventBus.on('data:processed', (data) => {
  // 验证数据
  validateData(data);
});

eventBus.on('data:processed', (data) => {
  // 保存数据（可能在验证之前执行）
  saveData(data);
});
```

### 事件性能优化

**要求**：高频事件必须实现节流、防抖或批量处理机制，避免性能问题。

**示例**：
```javascript
// 符合规范的性能优化
class OptimizedEventBus {
  constructor() {
    this.events = {};
    this.batchQueues = {};
    this.batchTimers = {};
  }
  
  // 批量处理事件
  batchEmit(event, data, batchSize = 10, delay = 100) {
    if (!this.batchQueues[event]) {
      this.batchQueues[event] = [];
    }
    
    this.batchQueues[event].push(data);
    
    if (this.batchQueues[event].length >= batchSize) {
      this.flushBatch(event);
    } else if (!this.batchTimers[event]) {
      this.batchTimers[event] = setTimeout(() => {
        this.flushBatch(event);
      }, delay);
    }
  }
  
  flushBatch(event) {
    const batch = this.batchQueues[event] || [];
    if (batch.length > 0) {
      this.emit(event, batch);
      this.batchQueues[event] = [];
    }
    
    if (this.batchTimers[event]) {
      clearTimeout(this.batchTimers[event]);
      delete this.batchTimers[event];
    }
  }
}
```

**反例**：
```javascript
// 不符合规范的高频事件处理
// 每次输入都触发事件，可能导致性能问题
inputElement.addEventListener('input', (e) => {
  eventBus.emit('search:input:changed', e.target.value);
});
```

### 事件测试规范

**要求**：所有事件相关的代码必须包含单元测试，覆盖订阅、发布、错误处理等场景。

**示例**：
```javascript
// 符合规范的测试用例
describe('EventBus', () => {
  let eventBus;
  
  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: true });
  });
  
  describe('事件订阅和发布', () => {
    it('应该正确订阅和发布事件', () => {
      const mockCallback = jest.fn();
      eventBus.on('test:module:action', mockCallback);
      
      const testData = { message: 'test' };
      eventBus.emit('test:module:action', testData);
      
      expect(mockCallback).toHaveBeenCalledWith(testData);
    });
    
    it('应该验证事件名称格式', () => {
      const invalidCallback = jest.fn();
      
      expect(() => {
        eventBus.on('invalid_event_name', invalidCallback);
      }).toThrow('事件名称无效');
    });
  });
  
  describe('错误处理', () => {
    it('应该捕获处理函数中的错误', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('处理错误');
      });
      
      const successCallback = jest.fn();
      
      eventBus.on('test:error:handling', errorCallback);
      eventBus.on('test:error:handling', successCallback);
      
      expect(() => {
        eventBus.emit('test:error:handling', {});
      }).not.toThrow();
      
      expect(successCallback).toHaveBeenCalled();
    });
  });
});
```

**反例**：
```javascript
// 不符合规范的缺失测试
// 没有测试事件系统的正确性和错误处理能力
const eventBus = new EventBus();
eventBus.on('some:event', callback);
// 缺少测试用例
```