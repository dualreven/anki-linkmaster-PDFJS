/**
 * @file PDF Home应用核心类，负责应用的生命周期管理
 * @module PDFHomeApp
 */

import { createPDFHomeContainer } from "../container/app-container.js";
import { TableWrapper } from '../table-wrapper.js';
import { APP_EVENTS, PDF_MANAGEMENT_EVENTS } from "../../common/event/event-constants.js";
import { setGlobalWebSocketClient, getLogger } from "../../common/utils/logger.js";
import { ErrorHandler } from "../../common/error/error-handler.js";
import { UIManager } from "../ui-manager.js";
import PDFManager from "../../common/pdf/pdf-manager.js";
import { resolveWebSocketPort, DEFAULT_WS_PORT } from "../utils/ws-port-resolver.js";
import { QWebChannelManager } from "../qwebchannel-manager.js";

/**
 * @class PDFHomeApp
 * @description 应用的核心协调器，管理所有模块的生命周期。
 */
export class PDFHomeApp {
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
    this.#consoleBridge = null; // 延迟创建
  }

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

      // 设置表格配置
      this.#setupTableConfiguration();

      // 初始化应用容器，建立依赖关系
      if (!this.#appContainer.isInitialized()) {
        await this.#appContainer.initialize();

        // 从容器获取更新后的依赖
        const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#websocketManager = wsClient;
      }

      // 设置全局WebSocket客户端供Logger使用
      setGlobalWebSocketClient(this.#websocketManager);

      // 设置WebSocket连接事件监听
      this.#setupWebSocketEventListeners();

      if (!this.#websocketManager.isConnected()) {
        await this.#websocketManager.connect();
      }

      // 初始化各个管理器
      await this.#qwebchannelManager.initialize();
      await this.#pdfManager.initialize();
      await this.#uiManager.initialize();

      this.#initialized = true;
      this.#logger.info("PDF Home App initialized successfully.");
      this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, { actorId: 'PDFHomeApp' });

    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      this.#errorHandler.handleError(error, "App.initialize");
    }
  }

  #setupTableConfiguration() {
    // Delay table wrapper initialization until PDF data is available
    this.tableWrapper = null;

    // Store table configuration for later initialization
    this.#tableConfig = {
      columns: [
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

    // Listen for PDF list updates to trigger table initialization
    this.#eventBus.on(PDF_MANAGEMENT_EVENTS.LIST.UPDATED, (pdfs) => {
      this.#logger.info(`pdf:list:updated received, count=${pdfs.length}`);
      this.#initializeTableIfNeeded();
    }, { subscriberId: "PDFHomeApp" });
  }

  #setupWebSocketEventListeners() {
    // 在连接前注册"连接建立"监听，避免竞态丢失事件
    this.#eventBus.on('websocket:connection:established', () => {
      this.#logger.info("WebSocket connected");
      // 完全禁用ConsoleWebSocketBridge，避免日志重复
      try {
        if (window.__earlyConsoleBridge?.disable) {
          window.__earlyConsoleBridge.disable();
          delete window.__earlyConsoleBridge;
        }
        this.#logger.info("Early console bridge disabled");
      } catch(e) {
        this.#logger.warn("Error disabling early bridge:", e);
      }
    }, { subscriberId: 'PDFHomeApp' });
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

  // 依赖注入：在实例化后注入核心组件
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
  }
}