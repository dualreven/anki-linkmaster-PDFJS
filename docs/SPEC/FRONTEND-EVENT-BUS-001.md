- **规范名称**: 前端事件总线使用规范
- **规范描述**: 规定事件总线的标准使用方法，包括订阅、发布和清理操作，确保事件通信的一致性和可维护性。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 所有前端JavaScript/TypeScript代码中的事件总线使用
- **详细内容**: 
  - 事件总线必须提供标准的on、emit、off方法
  - 订阅事件时必须使用常量作为事件名称
  - 发布事件时必须提供清晰的数据结构
  - 必须处理订阅的清理，避免内存泄漏
  - 事件处理函数应该简洁且专注于单一职责

- **正向例子**:
  ```javascript
  // 订阅事件
  const unsubscribe = eventBus.on(PDF.LOAD.SUCCESS, (data) => {
    console.log('PDF加载成功:', data.filename);
    // 处理业务逻辑
  });

  // 发布事件
  eventBus.emit(PDF.LOAD.SUCCESS, {
    filename: 'document.pdf',
    fileSize: 1024000,
    pageCount: 10
  });

  // 清理订阅
  unsubscribe(); // 单个取消订阅
  // 或者使用清理函数
  const cleanup = () => unsubscribe();
  ```

- **反向例子**:
  ```javascript
  // 错误：硬编码事件名称
  eventBus.on('pdf:load:success', handler); // 应该使用常量
  
  // 错误：缺少清理机制
  eventBus.on(PDF.LOAD.SUCCESS, handler); // 没有保存取消函数，可能导致内存泄漏
  
  // 错误：事件数据格式不清晰
  eventBus.emit(PDF.LOAD.SUCCESS, 'document.pdf'); // 应该使用对象格式
  
  // 错误：事件处理函数过于复杂
  eventBus.on(PDF.LOAD.SUCCESS, (data) => {
    // 处理多个不相关的逻辑，应该拆分为多个处理函数
    updateUI(data);
    sendAnalytics(data);
    cacheData(data);
  });