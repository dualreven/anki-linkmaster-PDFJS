<!-- PDFHOME-LOGGING-IMPLEMENTATION-001.md -->
- **规范名称**: PDF-Home 日志实施规范
- **规范描述**: 本规范定义了PDF-Home模块遵循FRONTEND-LOGGING-UNIFIED-001的具体实施细节，包括模块特定的日志配置、WebSocket集成和故障排查方法。
- **当前版本**: 1.0
- **所属范畴**: PDF-Home模块规范
- **适用范围**: PDF-Home前端模块
- **引用规范**: FRONTEND-LOGGING-UNIFIED-001, LOGGING-STANDARD-001
- **详细内容**:

## 1. PDF-Home日志配置

### 1.1 模块Logger配置
```javascript
// src/frontend/pdf-home/index.js
import { getLogger, setGlobalWebSocketClient, LogLevel } from "../common/utils/logger.js";

// 使用统一的模块名称
const sharedLogger = getLogger('PDFHomeApp');
```

### 1.2 WebSocket端口解析
```javascript
// 动态解析WebSocket端口
import { resolveWebSocketPortSync, DEFAULT_WS_PORT } from "./utils/ws-port-resolver.js";

const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
const wsUrl = `ws://localhost:${wsPort}`;
const wsClient = new WSClient(wsUrl);
```

## 2. 日志文件映射

### 2.1 后端日志文件
- **启动命令**: `python app.py --module pdf-home`
- **后端日志**: `logs/pdf-home.log`
- **前端日志**: `logs/pdf-home-js.log`

### 2.2 日志内容覆盖
- **PyQt应用日志**: 应用启动、窗口管理、DevTools连接
- **JavaScript日志**: 前端Logger输出、console.log桥接
- **WebSocket通信**: 消息收发、连接状态、错误处理
- **表格操作**: Tabulator事件、数据更新、用户交互
- **PDF管理**: 列表加载、文件操作、双击事件

## 3. 关键组件日志实施

### 3.1 应用初始化日志
```javascript
// 核心组件创建和依赖注入
const core = (() => {
  let ws = null, logger = null, bus = null;
  let resolveReady;
  const readyPromise = new Promise(r => { resolveReady = r; });
  const check = () => { if (ws && logger && bus) resolveReady(); };
  return {
    setWS: (w) => { ws = w; check(); },
    setLogger: (l) => { logger = l; check(); },
    setEventBus: (b) => { bus = b; check(); },
    guard: () => { if (!(ws && logger && bus)) throw new Error('Core not ready (WS/Logger/EventBus)'); },
    get: () => ({ ws, logger, bus }),
    readyPromise
  };
})();

// 日志记录核心组件创建
sharedLogger.info('bootstrap: logger ready (pre-app)');
```

### 3.2 TableWrapper日志集成
```javascript
// 表格事件日志
this.tableWrapper.tabulator.on("rowSelectionChanged", (selectedRows) => {
  this.#logger.debug("行选择发生变化", selectedRows);
  try {
    const selectedIds = selectedRows.map(row => row.getData ? row.getData().id || row.getData().filename : row.id || row.filename);
    this.#eventBus.emit(UI_EVENTS.SELECTION.CHANGED, selectedIds, { actorId: 'PDFHomeApp' });
  } catch (err) {
    this.#logger.warn('Error handling rowSelectionChanged', err);
  }
});

// 双击事件日志
rowDblClick: (e, row) => {
  try {
    const rowData = row.getData();
    if (rowData && (rowData.id || rowData.filename)) {
      this.#logger.info(`Row double-clicked, opening PDF: ${rowData.filename}`, rowData);
      this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.id || rowData.filename, {
        actorId: 'PDFHomeApp'
      });
    } else {
      this.#logger.warn("Row data is missing id or filename", rowData);
    }
  } catch (error) {
    this.#logger.error("Error in rowDblClick handler", error);
  }
}
```

### 3.3 WebSocket消息日志
```javascript
// PDF列表更新日志
this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
  try {
    const mapped = Array.isArray(pdfs) ? pdfs.map(p => ({ ...p })) : [];
    this.#logger.info(`pdf:list:updated received, count=${mapped.length}`);
    if (mapped.length > 0) this.#logger.debug('sample item:', mapped[0]);
    if (this.tableWrapper) {
      this.tableWrapper.setData(mapped);
    } else {
      this.#logger.warn('TableWrapper not initialized when pdf:list:updated received');
    }
  } catch (e) {
    this.#logger.error('Failed to update table wrapper data', e);
  }
}, { subscriberId: 'PDFHomeApp' });
```

## 4. 错误处理和监控

### 4.1 全局错误处理
```javascript
#setupGlobalErrorHandling() {
  window.addEventListener("unhandledrejection", (event) => {
    this.#logger.error("Unhandled Promise Rejection:", event.reason);
    this.#errorHandler.handleError(event.reason, "UnhandledPromiseRejection");
  });

  window.addEventListener("error", (event) => {
    this.#logger.error("Global Error:", event.error);
    this.#errorHandler.handleError(event.error, "GlobalError");
  });
}
```

### 4.2 Console桥接器
```javascript
// 早期console日志捕获
const earlyBridge = createConsoleWebSocketBridge('pdf-home', (message) => {
  if (wsClient.isConnected()) {
    wsClient.send({ type: 'console_log', data: message });
  }
});
earlyBridge.enable();

// WebSocket连接后切换
this.#eventBus.on('websocket:connection:established', () => {
  this.#logger.info("WebSocket connected, enabling console bridge");
  try { window.__earlyConsoleBridge?.disable?.(); } catch(_) {}
  this.#consoleBridge.enable();
  this.#logger.info("Logger WebSocket transmission enabled for pdf-home module");
}, { subscriberId: 'PDFHomeApp' });
```

## 5. 调试和故障排查

### 5.1 Logger状态检查
```javascript
// 检查Logger单例状态
console.log('[DEBUG] Logger manager status:', {
  allLoggers: window.__debugGetAllLoggers?.() || 'Not available',
  wsClientSet: !!this.#logger.hasWebSocketClient?.(),
  connected: this.#websocketManager?.isConnected?.() || false
});
```

### 5.2 WebSocket连接诊断
```javascript
// WebSocket连接状态诊断
console.log('[DEBUG] WebSocket diagnostics:', {
  url: this.#websocketManager?.getUrl?.() || 'Unknown',
  readyState: this.#websocketManager?.getReadyState?.() || 'Unknown',
  lastError: this.#websocketManager?.getLastError?.() || 'None'
});
```

### 5.3 日志文件检查
```bash
# 检查日志文件是否生成
ls -la logs/pdf-home*

# 实时监控日志输出
tail -f logs/pdf-home.log
tail -f logs/pdf-home-js.log

# 检查日志内容格式
head -20 logs/pdf-home-js.log
```

## 6. 性能优化

### 6.1 日志级别控制
```javascript
// 生产环境限制日志级别
if (import.meta.env.PROD) {
  setGlobalLogLevel(LogLevel.WARN);
} else {
  setGlobalLogLevel(LogLevel.DEBUG);
}
```

### 6.2 大量日志处理
```javascript
// 批量日志处理（避免频繁WebSocket发送）
const logBuffer = [];
const flushLogs = () => {
  if (logBuffer.length > 0) {
    wsClient.send({ type: 'console_log_batch', data: logBuffer });
    logBuffer.length = 0;
  }
};

// 定期清空缓冲区
setInterval(flushLogs, 1000);
```

## 7. 验收标准

- **日志文件生成**: `logs/pdf-home.log` 和 `logs/pdf-home-js.log` 正确生成
- **WebSocket传输**: 前端Logger日志通过WebSocket实时传输到后端
- **单例模式**: 整个PDF-Home模块使用同一个Logger实例
- **错误捕获**: 全局错误和Promise rejection都被正确记录
- **表格事件**: Tabulator的所有重要事件都有日志记录
- **PDF操作**: PDF文件的增删改查操作都有完整日志追踪
- **时间同步**: 前后端日志时间戳基本一致，便于关联分析

## 8. 故障恢复

### 8.1 WebSocket断线恢复
```javascript
// 自动重连后重新设置Logger
wsClient.on('reconnected', () => {
  setGlobalWebSocketClient(wsClient);
  sharedLogger.info('WebSocket reconnected, Logger transmission restored');
});
```

### 8.2 日志文件轮转
```python
# 后端日志文件大小控制（application.py）
logging.basicConfig(
    handlers=[
        RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler(sys.stdout)
    ]
)
```

- **正向例子**:
  ```javascript
  // PDF-Home模块完整日志初始化
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("[DEBUG] DOMContentLoaded: bootstrap core (WS → Logger → EventBus)...");

    // 1. 动态端口解析
    const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    const wsUrl = `ws://localhost:${wsPort}`;
    const wsClient = new WSClient(wsUrl);

    // 2. 统一Logger创建
    setGlobalWebSocketClient(wsClient);
    const sharedLogger = getLogger('PDFHomeApp');
    sharedLogger.info('bootstrap: logger ready (pre-app)');

    // 3. EventBus集成
    const eventBus = new EventBusClass({ enableValidation: true, logLevel: LogLevel.DEBUG });
    wsClient.setEventBus(eventBus);

    // 4. 应用依赖注入
    const app = new PDFHomeApp();
    app.injectCore({ wsClient, logger: sharedLogger, eventBus, core });

    // 5. 日志记录应用启动
    await app.initialize();
    sharedLogger.info("PDF Home App started. Use window.app.getState() for status.");
  });
  ```

- **反向例子**:
  ```javascript
  // ❌ 错误：每个组件独立创建Logger
  class TableWrapper {
    constructor() {
      this.logger = new Logger('TableWrapper');  // 独立实例
    }
  }

  class PDFManager {
    constructor() {
      this.logger = new Logger('PDFManager');    // 独立实例
    }
  }

  // ❌ 错误：手动设置WebSocket客户端
  tableWrapper.logger.setWebSocketClient(wsClient);
  pdfManager.logger.setWebSocketClient(wsClient);

  // ❌ 错误：硬编码WebSocket端口
  const wsClient = new WSClient('ws://localhost:8765');  // 无法动态适应

  // ❌ 错误：使用console.log代替Logger
  console.log('Table row clicked');
  console.error('PDF load failed');
  ```