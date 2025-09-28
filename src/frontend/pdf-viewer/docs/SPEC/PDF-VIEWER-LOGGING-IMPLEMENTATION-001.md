<!-- PDF-VIEWER-LOGGING-IMPLEMENTATION-001.md -->
- **规范名称**: PDF-Viewer 日志实施规范
- **规范描述**: 本规范定义了PDF-Viewer模块遵循FRONTEND-LOGGING-UNIFIED-001的具体实施细节，包括模块特定的日志配置、WebSocket集成、过滤机制和故障排查方法。
- **当前版本**: 1.0
- **所属范畴**: PDF-Viewer模块规范
- **适用范围**: PDF-Viewer前端模块
- **引用规范**: FRONTEND-LOGGING-UNIFIED-001, LOGGING-STANDARD-001, PDFHOME-LOGGING-IMPLEMENTATION-001
- **详细内容**:

## 1. PDF-Viewer日志配置

### 1.1 模块Logger配置
```javascript
// src/frontend/pdf-viewer/container/app-container.js
import { getLogger, setGlobalWebSocketClient, LogLevel } from "../../common/utils/logger.js";

// 使用统一的模块名称
const containerLogger = getLogger('PDFViewer');
```

### 1.2 WebSocket端口解析
```javascript
// 从URL参数获取端口配置
const urlParams = new URLSearchParams(window.location.search);
const msgCenterPort = urlParams.get('msgCenter') || '8765';
const wsUrl = `ws://localhost:${msgCenterPort}`;
const wsClient = new WSClient(wsUrl, eventBus);
```

## 2. 日志文件映射

### 2.1 后端日志文件
- **启动命令**: `python app.py --module pdf-viewer`
- **后端日志**: `logs/pdf-viewer.log`
- **前端日志**: `logs/pdf-viewer-js.log`

### 2.2 日志内容覆盖
- **PyQt应用日志**: 应用启动、窗口管理、PDF文件注入
- **JavaScript日志**: 前端Logger输出、console.log桥接
- **WebSocket通信**: 消息收发、连接状态、错误处理
- **PDF.js集成**: PDF文档加载、页面渲染、Worker状态
- **用户交互**: 缩放操作、页面导航、错误恢复
- **性能指标**: 渲染耗时、内存使用、Canvas性能

## 3. 关键组件日志实施

### 3.1 应用初始化日志
```javascript
// 核心依赖创建 - 使用getLogger单例模式
const containerLogger = getLogger('PDFViewer');
const eventBus = new EventBus({ enableValidation, logLevel: LogLevel.INFO });

// 设置全局WebSocket客户端用于Logger传输
setGlobalWebSocketClient(wsClient);
containerLogger.info('[pdf-viewer] Global WebSocket client set for Logger transmission');

// Console桥接器初始化
setupConsoleBridge();
containerLogger.info('[pdf-viewer] Console bridge setup completed with PDF-specific filters');
```

### 3.2 PDF文档加载日志
```javascript
// PDF文件加载日志
async loadPDF(fileData) {
  try {
    this.#logger.info("Loading PDF file:", fileData);

    const loadingTask = this.#pdfjsLib.getDocument(proxyUrl);
    loadingTask.onProgress = (progressData) => {
      this.#logger.debug(`PDF loading progress: ${progressData.loaded}/${progressData.total}`);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, progressData);
    };

    const pdfDocument = await loadingTask.promise;
    this.#currentDocument = pdfDocument;
    this.#logger.info(`PDF loaded successfully: ${pdfDocument.numPages} pages`);

  } catch (error) {
    this.#logger.error("Failed to load PDF file:", error);
    throw error;
  }
}
```

### 3.3 Canvas渲染日志
```javascript
// Canvas渲染性能日志
async renderPage(pageNumber, scale = 1.0) {
  const startTime = performance.now();

  try {
    this.#logger.debug(`Starting page ${pageNumber} render at scale ${scale}`);

    const page = await this.#currentDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // 渲染到Canvas
    const renderContext = {
      canvasContext: this.#ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    const renderTime = performance.now() - startTime;
    this.#logger.info(`Page ${pageNumber} rendered in ${renderTime.toFixed(2)}ms`);

  } catch (error) {
    this.#logger.error(`Failed to render page ${pageNumber}:`, error);
    throw error;
  }
}
```

### 3.4 用户交互日志
```javascript
// 缩放控制日志
handleZoomIn() {
  const oldScale = this.#currentScale;
  this.#currentScale = Math.min(this.#currentScale * 1.2, 3.0);
  this.#logger.info(`Zoom in: ${oldScale.toFixed(2)} → ${this.#currentScale.toFixed(2)}`);
  this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, this.#currentScale);
}

// 页面导航日志
handlePageNavigation(direction) {
  const oldPage = this.currentPage;
  const newPage = direction === 'next' ? oldPage + 1 : oldPage - 1;

  if (newPage >= 1 && newPage <= this.totalPages) {
    this.currentPage = newPage;
    this.#logger.info(`Page navigation: ${oldPage} → ${newPage} (${direction})`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.PAGE.CHANGED, newPage);
  }
}
```

## 4. PDF-Viewer特定过滤规则

### 4.1 噪音过滤配置
```javascript
// PDF-Viewer特定的过滤规则
const pdfViewerSkipPatterns = [
  'PDF\\.js.*worker.*ready',           // PDF.js Worker就绪
  'Canvas.*render.*progress',          // Canvas渲染进度
  'Page.*\\d+.*rendered',             // 页面渲染完成 (频繁)
  'Zoom.*level.*\\d+\\.\\d+',         // 缩放级别变化 (频繁)
  'Scroll.*position.*\\d+',           // 滚动位置更新
  'WebSocket.*ping.*pong',            // WebSocket心跳
  'Console log recorded successfully' // 后端响应确认
];

// 应用过滤规则到Console桥接器
if (consoleBridge.setSkipPatterns) {
  consoleBridge.setSkipPatterns(pdfViewerSkipPatterns);
}
```

### 4.2 关键事件保留
```javascript
// 保留的重要日志类型
const criticalEvents = [
  'PDF文件加载开始/完成',
  'PDF文档解析错误',
  'Canvas渲染错误',
  'WebSocket连接状态变化',
  '用户操作 (双击、按钮点击)',
  'PDF.js Worker错误',
  '内存不足警告',
  '性能瓶颈提醒'
];
```

## 5. Console桥接器增强

### 5.1 动态过滤规则
```javascript
// Console桥接器增强版本
export class ConsoleWebSocketBridge {
  constructor(source, websocketSender) {
    this.source = source;
    this.websocketSender = websocketSender;
    this.skipPatterns = []; // 自定义过滤规则
    // ...
  }

  setSkipPatterns(patterns) {
    this.skipPatterns = [...patterns];
  }

  shouldSkipMessage(messageText) {
    const skipPatterns = this.skipPatterns.length > 0 ? this.skipPatterns : [];
    return skipPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(messageText);
    });
  }
}
```

### 5.2 早期和主要桥接器切换
```javascript
// WebSocket连接建立后切换到主Console桥接器
setTimeout(() => {
  if (wsClient && wsClient.isConnected()) {
    try {
      if (earlyConsoleBridge) {
        earlyConsoleBridge.disable();
      }
      if (consoleBridge) {
        consoleBridge.enable();
      }
      containerLogger.info('[pdf-viewer] Console bridge switched to main bridge');
    } catch (bridgeError) {
      containerLogger.warn('[pdf-viewer] Console bridge switch failed', bridgeError);
    }
  }
}, 100);
```

## 6. 错误处理和监控

### 6.1 PDF.js错误处理
```javascript
// PDF.js特定错误处理
setupPDFErrorHandling() {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('PDF')) {
      this.#logger.error('PDF.js Unhandled Promise Rejection:', event.reason);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ERROR.PDF_LOAD_FAILED, event.reason);
    }
  });

  // PDF.js Worker错误监听
  if (this.#pdfjsLib && this.#pdfjsLib.GlobalWorkerOptions) {
    this.#pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CONFIG.workerSrc;
  }
}
```

### 6.2 性能监控
```javascript
// 性能指标收集
class PerformanceMonitor {
  constructor(logger) {
    this.#logger = logger;
    this.metrics = {
      pdfLoadTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0
    };
  }

  recordPDFLoadTime(startTime, endTime) {
    const loadTime = endTime - startTime;
    this.metrics.pdfLoadTime = loadTime;
    this.#logger.info(`PDF load performance: ${loadTime.toFixed(2)}ms`);

    if (loadTime > 5000) {
      this.#logger.warn(`Slow PDF loading detected: ${loadTime.toFixed(2)}ms`);
    }
  }

  recordRenderTime(pageNumber, renderTime) {
    this.#logger.debug(`Page ${pageNumber} render time: ${renderTime.toFixed(2)}ms`);

    if (renderTime > 1000) {
      this.#logger.warn(`Slow page rendering detected: Page ${pageNumber} took ${renderTime.toFixed(2)}ms`);
    }
  }
}
```

## 7. 调试和故障排查

### 7.1 Logger状态检查
```javascript
// 检查PDF-Viewer Logger状态
console.log('[DEBUG] PDF-Viewer Logger status:', {
  loggerInstance: getLogger('PDFViewer'),
  wsClientConnected: wsClient?.isConnected?.() || false,
  consoleBridgeEnabled: consoleBridge?.enabled || false,
  skipPatternsCount: consoleBridge?.skipPatterns?.length || 0
});
```

### 7.2 PDF.js状态诊断
```javascript
// PDF.js状态诊断
console.log('[DEBUG] PDF.js diagnostics:', {
  pdfjsVersion: this.#pdfjsLib?.version || 'Unknown',
  workerReady: this.#pdfjsLib?.GlobalWorkerOptions?.workerSrc || 'Not set',
  currentDocument: this.#currentDocument ? {
    numPages: this.#currentDocument.numPages,
    fingerprint: this.#currentDocument.fingerprints?.[0]?.substring(0, 8)
  } : null,
  cacheSize: this.#pagesCache.size
});
```

### 7.3 日志文件检查
```bash
# 检查PDF-Viewer日志文件是否生成
ls -la logs/pdf-viewer*

# 实时监控日志输出
tail -f logs/pdf-viewer.log
tail -f logs/pdf-viewer-js.log

# 检查PDF-Viewer特定日志内容
grep -i "pdf" logs/pdf-viewer-js.log | head -20
grep -i "render\|zoom\|page" logs/pdf-viewer-js.log | tail -10
```

## 8. 性能优化

### 8.1 日志级别控制
```javascript
// 生产环境优化
if (import.meta.env.PROD) {
  // 生产环境只记录WARNING和ERROR
  getLogger('PDFViewer').setLogLevel(LogLevel.WARN);

  // 更严格的过滤规则
  const prodSkipPatterns = [
    ...pdfViewerSkipPatterns,
    'debug.*',
    'Page.*navigation',
    'Scale.*change'
  ];
  consoleBridge.setSkipPatterns(prodSkipPatterns);
} else {
  // 开发环境详细日志
  getLogger('PDFViewer').setLogLevel(LogLevel.DEBUG);
}
```

### 8.2 内存优化
```javascript
// 日志缓存清理
class LogBuffer {
  constructor(maxSize = 100) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  addLog(logEntry) {
    this.buffer.push(logEntry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift(); // 移除最老的日志
    }
  }

  flush() {
    const logs = [...this.buffer];
    this.buffer.length = 0;
    return logs;
  }
}
```

## 9. 验收标准

- **日志文件生成**: `logs/pdf-viewer.log` 和 `logs/pdf-viewer-js.log` 正确生成
- **WebSocket传输**: 前端Logger日志通过WebSocket实时传输到后端
- **单例模式**: 整个PDF-Viewer模块使用同一个Logger实例 (`getLogger('PDFViewer')`)
- **过滤机制**: PDF-Viewer特定的噪音过滤正确工作
- **错误捕获**: PDF.js相关错误和Promise rejection都被正确记录
- **性能监控**: PDF加载和页面渲染性能指标有完整记录
- **用户交互**: 缩放、导航等用户操作都有日志追踪
- **时间同步**: 前后端日志时间戳基本一致，便于关联分析

## 10. 故障恢复

### 10.1 WebSocket断线恢复
```javascript
// 自动重连后重新设置Logger
wsClient.on('reconnected', () => {
  setGlobalWebSocketClient(wsClient);
  containerLogger.info('[pdf-viewer] WebSocket reconnected, Logger transmission restored');
});
```

### 10.2 PDF.js错误恢复
```javascript
// PDF.js错误后的恢复机制
async recoverFromPDFError(error) {
  this.#logger.warn('Attempting to recover from PDF error:', error);

  try {
    // 清理当前文档
    if (this.#currentDocument) {
      this.#currentDocument.destroy();
      this.#currentDocument = null;
    }

    // 清理页面缓存
    this.#pagesCache.clear();

    // 重新初始化PDF.js
    await this.initializePDFJS();

    this.#logger.info('PDF.js recovery completed successfully');
  } catch (recoveryError) {
    this.#logger.error('PDF.js recovery failed:', recoveryError);
    throw recoveryError;
  }
}
```

- **正向例子**:
  ```javascript
  // PDF-Viewer模块完整日志初始化
  document.addEventListener("DOMContentLoaded", async () => {
    // 1. 从URL参数获取端口配置
    const urlParams = new URLSearchParams(window.location.search);
    const msgCenterPort = urlParams.get('msgCenter') || '8765';
    const wsUrl = `ws://localhost:${msgCenterPort}`;

    // 2. 创建应用实例
    const app = new PDFViewerApp({ wsUrl });
    const indexLogger = getLogger("PDFViewer");

    // 3. 日志记录应用启动
    indexLogger.info("PDF.js will be loaded dynamically by PDFManager");
    indexLogger.info("Starting PDFViewer App initialization...");

    // 4. 应用初始化
    await app.initialize();

    // 5. 全局暴露供调试
    window.pdfViewerApp = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app
    };

    indexLogger.info("PDFViewer App initialized successfully");
  });
  ```

- **反向例子**:
  ```javascript
  // ❌ 错误：独立创建Logger实例
  class UIZoomControls {
    constructor(eventBus) {
      this.logger = new Logger('UIZoomControls');  // 独立实例
    }
  }

  class PDFManager {
    constructor(eventBus) {
      this.logger = new Logger('PDFManager');      // 独立实例
    }
  }

  // ❌ 错误：未设置WebSocket客户端
  const logger = getLogger('PDFViewer');
  // 缺少: setGlobalWebSocketClient(wsClient);

  // ❌ 错误：使用console.log代替Logger
  console.log('PDF page rendered');
  console.error('PDF load failed');

  // ❌ 错误：未配置过滤规则导致日志噪音
  consoleBridge.enable(); // 未设置skipPatterns
  ```