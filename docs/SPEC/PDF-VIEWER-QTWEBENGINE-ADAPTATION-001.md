- **规范名称**: QtWebEngine适配规范
- **规范描述**: 规定在QtWebEngine环境下PDF查看器的特殊适配要求，包括API兼容性、性能优化和限制处理，确保在嵌入式浏览器中的稳定运行。
- **当前版本**: 1.0
- **所属范畴**: 编码规范
- **适用范围**: 运行在QtWebEngine上的PDF查看器前端代码
- **详细内容**: 
  - 必须检测和适配QtWebEngine的特殊行为
  - 必须处理QtWebEngine的API限制和差异
  - 必须优化内存使用以避免QtWebEngine崩溃
  - 必须提供QtWebEngine特定的错误处理
  - 必须考虑QtWebEngine的性能特性进行优化
  - 必须处理QtWebEngine的异步特性

- **正向例子**:
  ```javascript
  // QtWebEngine环境检测和适配
  const isQtWebEngine = () => {
    return navigator.userAgent.includes('QtWebEngine') || 
           typeof qt !== 'undefined';
  };

  // QtWebEngine特定的配置
  const QTWE_CONFIG = {
    maxMemoryUsage: 256 * 1024 * 1024, // 256MB内存限制
    maxPdfFileSize: 100 * 1024 * 1024, // 100MB文件大小限制
    supportedFeatures: {
      webAssembly: true,
      webWorkers: true,
      streaming: true
    }
  };

  // QtWebEngine内存管理
  class QtWebEngineMemoryManager {
    constructor() {
      this.memoryUsage = 0;
      this.memoryLimit = QTWE_CONFIG.maxMemoryUsage;
    }

    trackMemoryUsage(size) {
      this.memoryUsage += size;
      
      if (this.memoryUsage > this.memoryLimit * 0.8) {
        console.warn('内存使用接近限制，建议清理缓存');
        eventBus.emit('memory:warning', {
          usage: this.memoryUsage,
          limit: this.memoryLimit
        });
      }
    }

    releaseMemory() {
      if (window.gc && isQtWebEngine()) {
        // QtWebEngine可能支持手动垃圾回收
        window.gc();
      }
      
      this.memoryUsage = 0;
      eventBus.emit('memory:released');
    }
  }

  // QtWebEngine异步操作适配
  const qtWebEngineSafeAsync = (asyncFunc) => {
    return async (...args) => {
      if (!isQtWebEngine()) {
        return asyncFunc(...args);
      }

      // QtWebEngine中可能需要特殊的异步处理
      try {
        return await asyncFunc(...args);
      } catch (error) {
        if (error.message.includes('asynchronous')) {
          // 处理QtWebEngine特定的异步错误
          console.warn('QtWebEngine异步操作异常，尝试重试');
          await new Promise(resolve => setTimeout(resolve, 100));
          return asyncFunc(...args);
        }
        throw error;
      }
    };
  };
  ```

- **反向例子**:
  ```javascript
  // 错误：忽略QtWebEngine环境检测
  function loadPdf() {
    // 没有检查是否是QtWebEngine环境
    // 可能使用不兼容的API
  }
  
  // 错误：内存使用无限制
  let hugeBuffer = new ArrayBuffer(500 * 1024 * 1024); // 500MB，可能使QtWebEngine崩溃
  
  // 错误：缺乏QtWebEngine特定的错误处理
  try {
    await someAsyncOperation();
  } catch (error) {
    // 没有针对QtWebEngine异步错误的特殊处理
  }
  
  // 错误：使用QtWebEngine不支持的API
  if (isQtWebEngine()) {
    // 仍然使用可能不支持的API
    useExperimentalAPI(); // QtWebEngine可能不支持某些实验性API
  }
  
  // 错误：缺乏性能优化
  function renderPdf() {
    // 没有考虑QtWebEngine的性能特性
    // 可能造成界面卡顿
  }
  ```