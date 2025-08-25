<![CDATA[<!-- PDFHOME-MODULE-INITIALIZATION-001.md -->
- **规范名称**: PDF-Home 模块初始化规范
- **规范描述**: 规定 PDF-Home 模块的初始化流程和协调机制，确保模块按正确顺序初始化并处理依赖关系。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: PDF-Home 模块的应用初始化和模块协调
- **详细内容**: 
  - 主应用类必须负责协调所有模块的初始化
  - 初始化必须支持异步操作，确保资源加载完成
  - 必须设置全局错误处理，捕获未处理的 Promise rejection 和全局错误
  - 初始化完成后必须发布相应的事件通知
  - 必须提供状态查询和诊断信息接口

- **正向例子**:
  ```javascript
  // 正确：异步初始化流程
  class PDFHomeApp {
    async initialize() {
      try {
        this.logger.info('正在初始化PDF主页应用');
        
        // 初始化各组件
        this.pdfManager.initialize();
        
        // 连接WebSocket
        this.websocketManager.connect();
        
        // 设置全局错误处理
        this.setupGlobalErrorHandling();
        
        this.initialized = true;
        this.logger.info('PDF主页应用初始化完成');
        
        // 触发初始化完成事件
        this.eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED);
      } catch (error) {
        this.logger.error('应用初始化失败', error);
        this.errorHandler.handleError(error, 'App.initialize');
      }
    }

    setupGlobalErrorHandling() {
      window.addEventListener('unhandledrejection', (event) => {
        this.logger.error('未处理的Promise rejection:', event.reason);
        this.errorHandler.handleError(event.reason, 'UnhandledPromiseRejection');
        event.preventDefault();
      });
      
      window.addEventListener('error', (event) => {
        this.logger.error('全局错误:', event.error);
        this.errorHandler.handleError(event.error, 'GlobalError');
        event.preventDefault();
      });
    }
  }
  ```

- **反向例子**:
  ```javascript
  // 错误：同步初始化，可能阻塞
  class PDFHomeApp {
    initialize() {
      this.pdfManager.initialize(); // 同步调用，可能阻塞
      this.websocketManager.connect(); // 同步连接，可能失败
      this.initialized = true; // 没有错误处理
    }
  }

  // 错误：缺少全局错误处理
  class PDFHomeApp {
    async initialize() {
      await this.pdfManager.initialize();
      // 没有设置全局错误处理，未捕获的异常会导致应用崩溃
    }
  }

  // 错误：初始化顺序混乱
  class PDFHomeApp {
    async initialize() {
      this.websocketManager.connect(); // 先连接WebSocket
      await this.pdfManager.initialize(); // 后初始化PDF管理器，可能导致依赖问题
    }
  }
  ```
]]>