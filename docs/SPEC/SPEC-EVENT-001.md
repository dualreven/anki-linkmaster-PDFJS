<!-- SPEC-EVENT-001.md -->
- 规范名称: 前端事件设计规范
- 规范描述: 规定前端事件的命名、定义和使用规范，确保事件系统的一致性和可维护性
- 当前版本: 1.0
- 所属范畴: 编码规范
- 适用范围: 全项目所有前端代码中的事件处理
- 正向例子:
  ```javascript
  // 事件常量定义 - event-constants.js
  export const APP = {
    INIT: { 
      START: 'app:init:start', 
      COMPLETE: 'app:init:complete' 
    }
  };
  
  export const PDF = {
    LOAD: { 
      START: 'pdf:load:start', 
      SUCCESS: 'pdf:load:success',
      FAIL: 'pdf:load:fail'
    },
    PROCESS: {
      START: 'pdf:process:start',
      SUCCESS: 'pdf:process:success',
      FAIL: 'pdf:process:fail'
    }
  };
  
  export const WEBSOCKET = {
    CONNECT: {
      START: 'websocket:connect:start',
      SUCCESS: 'websocket:connect:success',
      FAIL: 'websocket:connect:fail'
    },
    DISCONNECT: {
      START: 'websocket:disconnect:start',
      SUCCESS: 'websocket:disconnect:success'
    }
  };
  
  export const UI = {
    MODAL: {
      OPEN: 'ui:modal:open',
      CLOSE: 'ui:modal:close'
    },
    TOAST: {
      SHOW: 'ui:toast:show',
      HIDE: 'ui:toast:hide'
    }
  };
  
  export const ERROR = {
    HANDLE: 'error:handle',
    SHOW: 'error:show',
    CLEAR: 'error:clear'
  };
  
  // 事件总线使用示例
  import { eventBus } from './event-bus';
  import { PDF, ERROR } from './event-constants';
  
  class PdfViewer {
    constructor() {
      this.subscriptions = [];
      this.#initialize();
    }
    
    #initialize() {
      // 订阅PDF加载成功事件
      const offPdfLoadSuccess = eventBus.on(
        PDF.LOAD.SUCCESS, 
        this.#handlePdfLoadSuccess.bind(this)
      );
      
      // 订阅PDF加载失败事件
      const offPdfLoadFail = eventBus.on(
        PDF.LOAD.FAIL,
        this.#handlePdfLoadFail.bind(this)
      );
      
      // 保存订阅引用以便清理
      this.subscriptions.push(offPdfLoadSuccess, offPdfLoadFail);
    }
    
    // 加载PDF文件
    async loadPdf(url) {
      try {
        eventBus.emit(PDF.LOAD.START, { url });
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const pdfData = await response.arrayBuffer();
        
        // 发布加载成功事件
        eventBus.emit(PDF.LOAD.SUCCESS, { 
          url, 
          data: pdfData 
        });
        
      } catch (error) {
        // 发布加载失败事件
        eventBus.emit(PDF.LOAD.FAIL, { url, error });
        
        // 发布错误处理事件
        eventBus.emit(ERROR.HANDLE, error);
      }
    }
    
    #handlePdfLoadSuccess(data) {
      try {
        console.log('PDF加载成功:', data.url);
        // 处理PDF数据...
        
      } catch (error) {
        console.error('处理PDF加载成功事件失败:', error);
        eventBus.emit(ERROR.HANDLE, error);
      }
    }
    
    #handlePdfLoadFail(data) {
      try {
        console.error('PDF加载失败:', data.url, data.error);
        // 显示错误信息...
        
      } catch (error) {
        console.error('处理PDF加载失败事件失败:', error);
        eventBus.emit(ERROR.HANDLE, error);
      }
    }
    
    // 组件卸载时清理订阅
    destroy() {
      this.subscriptions.forEach(off => off());
      this.subscriptions = [];
    }
  }
  
  // 事件总线实现示例
  class EventBus {
    constructor() {
      this.events = {};
    }
    
    // 订阅事件
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      
      this.events[eventName].push(callback);
      
      // 返回取消订阅函数
      return () => {
        this.events[eventName] = this.events[eventName].filter(
          cb => cb !== callback
        );
      };
    }
    
    // 订阅一次性事件
    once(eventName, callback) {
      const off = this.on(eventName, (...args) => {
        callback(...args);
        off(); // 自动取消订阅
      });
      return off;
    }
    
    // 发布事件
    emit(eventName, data) {
      if (!this.events[eventName]) {
        return;
      }
      
      this.events[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件处理错误 [${eventName}]:`, error);
        }
      });
    }
    
    // 取消所有订阅
    off(eventName) {
      if (eventName) {
        delete this.events[eventName];
      } else {
        this.events = {};
      }
    }
  }
  
  // 导出单例实例
  export const eventBus = new EventBus();
  ```
- 反向例子:
  ```javascript
  // 错误的事件命名
  const events = {
    // 不符合格式规范
    'pdfLoad': 'pdfLoad',                    // 缺少冒号分隔
    'pdf_load': 'pdf_load',                  // 下划线而非冒号
    'PDF_LOAD': 'PDF_LOAD',                  // 全大写
    'pdfLoadStart': 'pdfLoadStart',          // 驼峰命名
    'PdfLoadStart': 'PdfLoadStart',          // 大驼峰
    'pdf-load-start': 'pdf-load-start',      // 连字符而非冒号
    
    // 不清晰的模块名
    'doc:load:start': 'doc:load:start',      // doc不明确
    'file:load:start': 'file:load:start',    // file不明确
    'data:load:start': 'data:load:start',    // data不明确
    
    // 不清晰的动作名
    'pdf:do:start': 'pdf:do:start',          // do不明确
    'pdf:execute:start': 'pdf:execute:start', // execute不明确
    'pdf:perform:start': 'pdf:perform:start' // perform不明确
  };
  
  // 错误的事件使用方式
  class BadPdfViewer {
    constructor() {
      // 硬编码事件名
      eventBus.on('pdf:load:success', this.handleLoadSuccess);
      eventBus.on('pdf:load:fail', this.handleLoadFail);
      
      // 没有保存订阅引用，无法清理
    }
    
    async loadPdf(url) {
      // 没有发布开始事件
      try {
        const response = await fetch(url);
        const pdfData = await response.arrayBuffer();
        
        // 硬编码事件名
        eventBus.emit('pdf:load:success', { url, data: pdfData });
        
      } catch (error) {
        // 硬编码事件名
        eventBus.emit('pdf:load:fail', { url, error });
      }
    }
    
    handleLoadSuccess(data) {
      // 没有try-catch包装
      console.log('PDF加载成功:', data.url);
    }
    
    handleLoadFail(data) {
      // 没有try-catch包装
      console.error('PDF加载失败:', data.url, data.error);
    }
    
    // 没有清理方法
  }
  
  // 错误的事件总线实现
  class BadEventBus {
    constructor() {
      this.events = {};
    }
    
    // 没有返回取消订阅函数
    on(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(callback);
    }
    
    // 没有错误处理
    emit(eventName, data) {
      if (this.events[eventName]) {
        this.events[eventName].forEach(callback => {
          callback(data); // 如果callback抛出异常，会导致整个事件系统崩溃
        });
      }
    }
  }
  
  // 错误的事件常量组织
  // 所有事件混在一个对象中
  const EVENTS = {
    'app:init:start': 'app:init:start',
    'app:init:complete': 'app:init:complete',
    'pdf:load:start': 'pdf:load:start',
    'pdf:load:success': 'pdf:load:success',
    'pdf:load:fail': 'pdf:load:fail',
    'websocket:connect:start': 'websocket:connect:start',
    'websocket:connect:success': 'websocket:connect:success',
    'websocket:connect:fail': 'websocket:connect:fail',
    'ui:modal:open': 'ui:modal:open',
    'ui:modal:close': 'ui:modal:close',
    'error:handle': 'error:handle'
  };
  
  // 使用时难以查找相关事件
  eventBus.emit(EVENTS['pdf:load:success'], data);