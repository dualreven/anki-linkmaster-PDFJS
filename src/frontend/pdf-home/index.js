// Import polyfills first
import '../common/polyfills.js';
﻿/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 */


import { createPDFHomeContainer } from "./container/app-container.js";
import { TableWrapper } from './table-wrapper.js';
import { APP_EVENTS, PDF_MANAGEMENT_EVENTS, UI_EVENTS, SYSTEM_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../common/event/event-constants.js";
import { setGlobalWebSocketClient, LogLevel, getLogger } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { UIManager } from "./ui-manager.js";
import PDFManager from "../common/pdf/pdf-manager.js";
import { createConsoleWebSocketBridge } from "../common/utils/console-websocket-bridge.js";
import { resolveWebSocketPort, DEFAULT_WS_PORT, resolveWebSocketPortSync } from "./utils/ws-port-resolver.js";
import { EventBus as EventBusClass } from "../common/event/event-bus.js";
import { QWebChannelManager } from "./qwebchannel-manager.js";

/**
 * @class PDFHomeApp
 * @description 应用的核心协调器，管理所有模块的生命周期。
 */
class PDFHomeApp {
  #logger;
  #eventBus;
  #errorHandler;
  #websocketManager;
  #pdfManager;
  #uiManager;
  #consoleBridge;
  #qwebchannelManager;
  #wsPort = DEFAULT_WS_PORT;
  #initialized = false;
  #coreGuard = null;
  #appContainer; // 应用容器
  tableWrapper = null; // 表格包装器，延迟初始化
  #tableConfig = null; // 表格配置，延迟初始化时使用

  constructor(deps = {}) {
    // 如果传入了容器，使用它；否则创建新容器
    if (deps.container) {
      this.#appContainer = deps.container;
    } else {
      // 创建应用容器，解决循环依赖
      this.#appContainer = createPDFHomeContainer({
        wsUrl: deps.wsUrl || `ws://localhost:${DEFAULT_WS_PORT}`,
        enableValidation: deps.enableValidation !== false
      });
    }

    // 从容器获取依赖
    const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#websocketManager = wsClient;
    this.#coreGuard = deps.core?.guard || null;

    // 创建其他组件
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    this.#qwebchannelManager = new QWebChannelManager(this.#eventBus);
    this.#wsPort = DEFAULT_WS_PORT;

    // 创建console bridge但暂不启用，等待WebSocket连接
    // 注意：此时早期Bridge可能已经修改了console，所以我们暂不创建
    this.#consoleBridge = null; // 延迟创建
  }
/**
  async #setupWebSocketClient() {
    if (this.#websocketManager) {
      return;
    }

    try {
      const resolvedPort = await resolveWebSocketPort({ logger: this.#logger, fallbackPort: this.#wsPort });
      if (Number.isInteger(resolvedPort) && resolvedPort > 0 && resolvedPort < 65536) {
        this.#wsPort = resolvedPort;
      } else {
        this.#logger.warn("Resolved WebSocket port invalid, using fallback", { resolvedPort });
      }
    } catch (error) {
      this.#logger.warn("Failed to resolve WebSocket port from log, using fallback", { error: error?.message || error });
    }

    const targetUrl = `ws://localhost:${this.#wsPort}`;
    this.#logger.info(`WebSocket client prepared for pdf-home: ${targetUrl}`);
  }

  /**
   * 初始化所有应用模块。
   */
  async initialize() {
    console.log("[DEBUG] PDFHomeApp.initialize() called");
    setTimeout(() => {
       console.log("[TEST] JS Console Logger Test Message");
    }, 3000);
    try {
      if (this.#coreGuard) this.#coreGuard();
      console.log("[DEBUG] About to log 'Initializing PDF Home App...'");
      this.#logger.info("Initializing PDF Home App...");
      console.log("[DEBUG] Setting up global error handling...");
      this.#setupGlobalErrorHandling();

      // Delay table wrapper initialization until PDF data is available
      // This avoids renderer timing issues and improves performance
      this.tableWrapper = null;

      // Store table configuration for later initialization
      this.#tableConfig = {
          columns: [
            // 注意：当前未启用 Tabulator 的 SelectRow 模块，上述 formatter 会在部分打包形态下无效并报错。
            // 暂时移除 rowSelection 列，避免初始化告警；如需多选，请改用 table-wrapper.js 中的回退checkbox方案。
            // {
            //   formatter: "rowSelection",
            //   titleFormatter: "rowSelection",
            //   titleFormatterParams: {
            //     rowRange: "active"
            //   },
            //   hozAlign: "center",
            //   headerSort: false,
            //   width: 50,
            //   cellClick: function(e, cell) {
            //     e.stopPropagation();
            //   }
            // },
            { title: "File", field: "filename", widthGrow: 2 },
            { title: "Title", field: "title", widthGrow: 3 },
            { title: "Pages", field: "page_count", hozAlign: "center", width: 80 },
            { title: "Cards", field: "cards_count", hozAlign: "center", width: 80 },
          ],
          selectable: true,
          layout: "fitColumns",
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
          },
        };

        // ==================== 诊断代码开始 ====================
        // Note: Table initialization is now delayed until PDF data arrives
        // Diagnostic code will be executed after table creation

        // Listen for PDF list updates to trigger table initialization
        this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
          this.#logger.info(`pdf:list:updated received, count=${pdfs.length}`);
          this.#initializeTableIfNeeded();
        }, { subscriberId: "PDFHomeApp" });

        // ==================== 诊断代码结束 ====================

      // 初始化应用容器，建立依赖关系
      if (!this.#appContainer.isInitialized()) {
        await this.#appContainer.initialize();

        // 从容器获取更新后的依赖（如果容器内部创建了新的WebSocket客户端）
        const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#websocketManager = wsClient;
      }

      // 设置全局WebSocket客户端供Logger使用
      setGlobalWebSocketClient(this.#websocketManager);
      // 在连接前注册"连接建立"监听，避免竞态丢失事件
      this.#eventBus.on('websocket:connection:established', () => {
        this.#logger.info("WebSocket connected");
        // 完全禁用ConsoleWebSocketBridge，避免日志重复
        // Qt的javaScriptConsoleMessage已经能捕获所有console输出
        try {
          if (window.__earlyConsoleBridge?.disable) {
            window.__earlyConsoleBridge.disable();
            delete window.__earlyConsoleBridge;
          }
          this.#logger.info("Early console bridge disabled");
        } catch(e) {
          this.#logger.warn("Error disabling early bridge:", e);
        }
        // 不再创建新的ConsoleBridge，依赖Qt层面的日志捕获
      }, { subscriberId: 'PDFHomeApp' });
      if (!this.#websocketManager.isConnected()) {
        await this.#websocketManager.connect();
      }
      // 初始化QWebChannel管理器
      await this.#qwebchannelManager.initialize();

      // 外部注入路径：直接使用已注入的 WS/Logger/EventBus
      await this.#pdfManager.initialize();
      await this.#uiManager.initialize(); // UIManager now has its own initialization logic

      this.#initialized = true;
      this.#logger.info("PDF Home App initialized successfully.");
      this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, { actorId: 'PDFHomeApp' });

      // ====== 自检模式入口（方案A）======
      try {
        // 暴露自动化测试钩子
        const autoTest = {
          lastResult: null,
          // 触发一次自动化双击测试
          run: async () => {
            const result = {
              startedAt: new Date().toISOString(),
              errors: [],
              openRequestedFired: false,
              usedMockData: false,
              notes: []
            };

            // 1) 捕获 window 错误与 console.error
            const errorHandler = (e) => {
              try {
                const msg = e?.message || e?.toString?.() || String(e);
                result.errors.push({ source: 'window.onerror', message: msg });
              } catch (_) {}
            };
            const origConsoleError = console.error;
            console.error = function(...args) {
              try { result.errors.push({ source: 'console.error', message: args.map(a => (a && a.message) ? a.message : String(a)).join(' ') }); } catch(_) {}
              return origConsoleError.apply(console, args);
            };

            window.addEventListener('error', errorHandler);

            // 2) 监听 OPEN.REQUESTED 事件是否触发
            const unsubscribeOpen = this.#eventBus.on(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, (payload) => {
              try {
                result.openRequestedFired = true;
                result.notes.push('OPEN.REQUESTED captured with payload: ' + JSON.stringify(payload));
              } catch (_) {}
            }, { subscriberId: 'AutoTest' });

            // 3) 等待 Tabulator DOM 渲染
            const waitForTableDom = async (timeoutMs = 5000) => {
              const start = Date.now();
              while (Date.now() - start < timeoutMs) {
                try {
                  const wrapper = this.tableWrapper?.tableWrapper || document.querySelector('#pdf-table-container .pdf-table-wrapper');
                  if (wrapper) {
                    const isTab = wrapper.classList?.contains?.('tabulator') || wrapper.querySelector('.tabulator, .tabulator-table');
                    if (isTab) return wrapper;
                  }
                } catch (_) {}
                await new Promise(r => setTimeout(r, 50));
              }
              throw new Error('Tabulator DOM not ready within timeout');
            };

            // 4) 若没有数据则注入一条 mock 数据
            const ensureData = async () => {
              try {
                const dataLen = (() => {
                  try {
                    const d = this.tableWrapper?.tabulator?.getData?.();
                    return Array.isArray(d) ? d.length : 0;
                  } catch (_) { return 0; }
                })();
                if (dataLen === 0) {
                  result.usedMockData = true;
                  const mock = [{ id: 'auto-test.pdf', filename: 'auto-test.pdf', title: 'Auto Test PDF', page_count: 1, cards_count: 0 }];
                  await this.tableWrapper.setData(mock);
                  result.notes.push('Injected mock data for auto test');
                }
              } catch (e) {
                result.errors.push({ source: 'ensureData', message: e?.message || String(e) });
              }
            };

            // 5) 触发第一行的双击事件
            const dispatchDblClick = async () => {
              try {
                const wrapper = this.tableWrapper?.tableWrapper || document.querySelector('#pdf-table-container .pdf-table-wrapper');
                if (!wrapper) throw new Error('table wrapper not found');
                // 兼容 Tabulator 不同结构，尝试多种选择器
                const rowEl = wrapper.querySelector('.tabulator-row') || wrapper.querySelector('.tabulator-tableHolder .tabulator-table .tabulator-row');
                if (!rowEl) throw new Error('no tabulator row found to double click');
                const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window });
                rowEl.dispatchEvent(evt);
                result.notes.push('Dispatched dblclick on first row');
              } catch (e) {
                result.errors.push({ source: 'dispatchDblClick', message: e?.message || String(e) });
              }
            };

            // 执行流程
            try {
              await waitForTableDom(6000);
              await ensureData();
              await new Promise(r => setTimeout(r, 100)); // 给渲染留一点时间
              await dispatchDblClick();
              await new Promise(r => setTimeout(r, 200)); // 等待事件总线处理
            } catch (e) {
              result.errors.push({ source: 'autoTestFlow', message: e?.message || String(e) });
            }

            // 清理监听
            try { window.removeEventListener('error', errorHandler); } catch(_) {}
            try { console.error = origConsoleError; } catch(_) {}
            try { if (typeof unsubscribeOpen === 'function') unsubscribeOpen(); } catch(_) {}

            // 6) 判定成功条件：无 isSelected 错误，且 OPEN.REQUESTED 触发
            const hasIsSelectedError = result.errors.some(er => /isSelected/.test(er.message || ''));
            result.success = !hasIsSelectedError && result.openRequestedFired;
            result.finishedAt = new Date().toISOString();

            // 对外暴露结果并打印
            autoTest.lastResult = result;
            window.__lastAutoTestResult = result;
            if (result.success) {
              this.#logger.info('[AutoTest] Success', result);
            } else {
              this.#logger.warn('[AutoTest] Failed', result);
            }
            return result;
          }
        };

        // 暴露到 window
        window.__pdfHomeAutoTest = autoTest;

        // 若检测到环境变量（通过 window 注入的布尔值）则自动执行
        if (window.PDF_HOME_AUTO_TEST === true || window.PDF_HOME_AUTO_TEST === '1') {
          setTimeout(() => {
            try { autoTest.run(); } catch (e) { this.#logger.warn('AutoTest run failed to start', e); }
          }, 300);
        }
      } catch (e) {
        this.#logger.warn('AutoTest hook init failed', e);
      }
      // ====== 自检模式入口结束 ======
    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      this.#errorHandler.handleError(error, "App.initialize");
    }
  }

  /**
   * 销毁应用，清理所有资源。
   */
  destroy() {
    this.#logger.info("Destroying PDF Home App...");
    this.#pdfManager.destroy();
    this.#uiManager.destroy();
    this.#websocketManager?.disconnect();
    this.#eventBus.destroy();
    this.#logger.info("PDF Home App destroyed.");
  }


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

  /**
   * 获取应用的公开状态快照。
   * @returns {object} 应用的当前状态。
   */
  getState() {
    return {
      initialized: this.#initialized,
      websocketConnected: this.#websocketManager?.isConnected?.() ?? false,
      pdfCount: this.#pdfManager.getPDFs().length,
    };
  }

  // Expose EventBus for testing and external integrations
  getEventBus() {
    return this.#eventBus;
  }

  // Expose logger for external access
  get logger() {
    return this.#logger;
  }

  // 依赖注入：在实例化后注入核心组件（WS → Logger → EventBus）
  injectCore(deps = {}) {
    const { wsClient, logger, eventBus, core } = deps;
    if (!wsClient || !logger || !eventBus) {
      throw new Error('injectCore: wsClient/logger/eventBus all required');
    }
    this.#websocketManager = wsClient;
    this.#logger = logger;
    // 若已存在旧实例，先清理以避免重复订阅/泄露
    try { this.#uiManager?.destroy?.(); } catch(_) {}
    try { this.#pdfManager?.destroy?.(); } catch(_) {}
    try { this.#errorHandler = null; } catch(_) {}
    // 使用新事件总线重建依赖模块
    this.#eventBus = eventBus;
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    this.#coreGuard = core && typeof core.guard === 'function' ? core.guard : null;
    // 绑定 console 桥接依赖的 WS
    // （bridge 已在构造中创建，此处无需重建）
  }

  /**
   * Initialize table if needed when PDF data arrives
   * @private
   */
  #initializeTableIfNeeded() {
    if (this.tableWrapper) {
      this.#logger.debug("Table already initialized, skipping");
      return;
    }

    const tableContainer = document.querySelector('#pdf-table-container');
    if (!tableContainer) {
      this.#logger.warn('Table container #pdf-table-container not found; cannot initialize table');
      return;
    }

    this.#logger.info("Initializing table with PDF data available");

    try {
      // Create TableWrapper with stored configuration
      this.tableWrapper = new TableWrapper(tableContainer, this.#tableConfig);

      // Set up event bindings after table creation
      this.#setupTableEventBindings();

      // Provide the table instance to UIManager
      if (this.#uiManager) {
        this.#uiManager.pdfTable = this.tableWrapper;
        this.#logger.info("Table instance provided to UIManager");
      }

      this.#logger.info("Table initialization completed successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize table:", error);
    }
  }

  /**
   * Set up table event bindings
   * @private
   */
  #setupTableEventBindings() {
    if (!this.tableWrapper || !this.tableWrapper.tabulator) {
      this.#logger.warn("TableWrapper or Tabulator instance not available for event binding");
      return;
    }

    const tabulator = this.tableWrapper.tabulator;

    // Diagnostic event bindings
    tabulator.on("rowSelectionChanged", (data, rows) => {
      this.#logger.debug("底层 Tabulator rowSelectionChanged 事件触发", data);
    });

    tabulator.on("cellClick", (e, cell) => {
      this.#logger.debug("底层 Tabulator cellClick 事件触发", { value: cell.getValue() });
    });

    // Selection change events
    tabulator.on("rowSelectionChanged", (selectedRows) => {
      this.#logger.debug("行选择发生变化", selectedRows);
      try {
        const selectedIds = selectedRows.map(row =>
          row.getData ? row.getData().id || row.getData().filename : row.id || row.filename
        );
        this.#logger.debug("当前选中的ID", selectedIds);
      } catch (e) {
        this.#logger.warn("获取选中行数据时出错", e);
      }
    });

    // Row click events
    tabulator.on("rowClick", (e, row) => {
      try {
        const data = row && typeof row.getData === 'function' ? row.getData() : null;
        this.#logger.debug("行被点击", data);
      } catch (e) {
        this.#logger.warn("获取行点击数据时出错", e);
      }
    });

    // Cell click events for action buttons
    tabulator.on("cellClick", (e, cell) => {
      const cellElement = cell.getElement();
      const button = e.target.closest('button[data-action]');

      if (button) {
        const action = button.getAttribute('data-action');
        const rowData = cell.getRow().getData();
        this.#logger.debug(`操作按钮被点击: ${action}`, rowData);

        if (action === 'delete') {
          this.#logger.info(`删除操作触发，文件: ${rowData.filename || rowData.id}`);
          this.#eventBus.emit(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, rowData.id || rowData.filename, {
            actorId: 'PDFHomeApp'
          });
        }
      }
    });

    this.#logger.info("Tabulator 事件绑定完成（包含双击修复）");
  }
}

// ===== 应用启动 =====
console.log("[DEBUG] Script loaded, waiting for DOMContentLoaded...");

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[DEBUG] DOMContentLoaded: bootstrap PDF Home App...");

  try {
    // 1) 解析WebSocket端口
    const wsPort = resolveWebSocketPortSync({ fallbackPort: DEFAULT_WS_PORT });
    const wsUrl = `ws://localhost:${wsPort}`;

    // 2) 禁用早期console桥接器，避免日志重复
    // Qt层的javaScriptConsoleMessage已经足够捕获所有日志
    // try {
    //   const earlyBridge = createConsoleWebSocketBridge('pdf-home', (message) => {
    //     // 在应用初始化前，暂不发送console log
    //   });
    //   earlyBridge.enable();
    //   try { window.__earlyConsoleBridge = earlyBridge; } catch(_) {}
    // } catch (_) {}

    // 3) 创建应用实例（会自动创建容器）
    const app = new PDFHomeApp({ wsUrl });

    console.log("[DEBUG] Starting app initialization...");
    await app.initialize();

    console.log("[DEBUG] App initialization completed, setting up window.app...");
    window.app = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app
    };

    // 使用getLogger创建临时logger来记录启动成功
    const logger = getLogger('pdf-home/app');
    logger.info("PDF Home App started. Use window.app.getState() for status.");
    console.log("[DEBUG] PDF Home App fully started");
  } catch (error) {
    console.error("[DEBUG] App bootstrap/initialization failed:", error);
    try {
      // 尝试创建一个临时logger来记录错误
      const tempLogger = getLogger('pdf-home/bootstrap');
      tempLogger.error('Bootstrap failed', error);
    } catch (_) {}
  }
});

console.log("[DEBUG] Event listener registered for DOMContentLoaded");
