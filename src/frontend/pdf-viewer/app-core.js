/**
 * @file PDF查看器应用核心模块
 * @module PDFViewerAppCore
 * @description PDF查看器应用的核心功能，包括初始化、状态管理和基础协调，使用容器化依赖注入架构
 */

import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { PDFManager } from "./pdf/pdf-manager-refactored.js";
import { UIManager } from "./ui/ui-manager-core-refactored.js";
import { createConsoleWebSocketBridge } from "../common/utils/console-websocket-bridge.js";
import { createPDFViewerContainer } from "./container/app-container.js";

/**
 * @class PDFViewerAppCore
 * @description PDF查看器应用的核心协调器，管理所有模块的生命周期，使用容器化架构
 */
export class PDFViewerAppCore {
  #logger;
  #eventBus;
  #errorHandler;
  #pdfManager;
  #uiManager;
  #initialized = false;
  #currentFile = null;
  #currentPage = 1;
  #totalPages = 0;
  #zoomLevel = 1.0;
  #wsClient = null;
  #consoleBridge = null;
  #appContainer; // 应用容器
  #bookmarkManager; // 书签管理器（按需动态加载）

  constructor(deps = {}) {
    // 如果传入了容器，使用它；否则创建新容器
    if (deps.container) {
      this.#appContainer = deps.container;
    } else {
      // 创建应用容器，解决循环依赖
      this.#appContainer = createPDFViewerContainer({
        wsUrl: deps.wsUrl || 'ws://localhost:8765',
        enableValidation: deps.enableValidation !== false
      });
    }

    // 从容器获取依赖
    const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#wsClient = wsClient;

    // 创建其他组件
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    this.#bookmarkManager = null;

    // 创建console桥接器，但暂时不启用
    this.#consoleBridge = createConsoleWebSocketBridge('pdf_viewer', (message) => {
      if (this.#wsClient && this.#wsClient.isConnected()) {
        this.#wsClient.send({ type: 'console_log', data: message });
      }
    });

    // 监听WebSocket连接建立事件，然后启用console桥接器
    this.#eventBus.on('websocket:connection:established', () => {
      this.#logger.info("WebSocket connected, enabling console bridge");
      this.#consoleBridge.enable();
    }, { subscriberId: 'PDFViewerAppCore' });

    this.#logger.info("PDFViewerApp instance created with container architecture");
  }

  /**
   * 初始化所有应用模块
   * @returns {Promise<void>}
   */
  async initialize() {
    try{
      this.#logger.info("Initializing PDF Viewer App...");
      this.#setupGlobalErrorHandling();

      // 1. 先初始化容器（创建WSClient但不连接）
      if (!this.#appContainer.isInitialized()) {
        this.#logger.info("Initializing container...");
        await this.#appContainer.initialize();

        // 重新获取依赖，特别是wsClient
        const { wsClient } = this.#appContainer.getDependencies();
        this.#wsClient = wsClient;
        this.#logger.info("Container initialized, WSClient ready");
      }

      // 2. 然后连接WebSocket
      this.#logger.info("Attempting to connect WebSocket via container...");
      this.#appContainer.connect();
      this.#logger.info("WebSocket connection initiated.");

      // 3. 初始化各管理器
      this.#logger.info("Initializing PDFManager...");
      await this.#pdfManager.initialize();
      this.#logger.info("PDFManager initialized.");

      this.#logger.info("Initializing UIManager...");
      await this.#uiManager.initialize();
      this.#logger.info("UIManager initialized.");

      // 初始化书签管理器（依赖UI容器已就绪）；默认启用，可通过 ?bookmark=0 显式关闭
      try {
        const params = new URLSearchParams(window.location.search);
        const bookmarkParam = (params.get('bookmark') || '').toLowerCase();
        const enableBookmarks = (bookmarkParam === '' || bookmarkParam === '1' || bookmarkParam === 'true' || bookmarkParam === 'on');
        if (enableBookmarks) {
          const { BookmarkManager } = await import("./bookmark/bookmark-manager.js");
          this.#bookmarkManager = new BookmarkManager(this.#eventBus);
          this.#bookmarkManager.initialize();
          this.#logger.info("BookmarkManager initialized (enabled by default; disable with ?bookmark=0).");
        } else {
          this.#logger.info("BookmarkManager disabled by URL param bookmark=0");
        }
      } catch (bmErr) {
        const reason = bmErr && typeof bmErr === 'object' ? (bmErr.stack || bmErr.message || JSON.stringify(bmErr)) : bmErr;
        this.#logger.warn("BookmarkManager init failed, continue without bookmarks", reason);
      }


      this.#initialized = true;
      this.#logger.info("PDF Viewer App initialized successfully with container architecture.");
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.INITIALIZED, undefined, {
        actorId: 'PDFViewerApp'
      });

      // 监听PDF加载成功事件
      // 由FileHandler统一发射，确保只调用一次
      this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, ({ pdfDocument }) => {
        this.#uiManager.loadPdfDocument(pdfDocument);
      });
    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      this.#errorHandler.handleError(error, "App.initialize");
      throw error;
    }
  }

  /**
   * 设置全局错误处理
   * @private
   */
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
   * 渲染PDF到#viewer容器(PDFViewer模式)
   * @param {Object} page - PDF页面对象
   * @param {Object} viewport - 视口对象
   * @description 在PDFViewer模式下，PDFViewer组件会通过setDocument()自动渲染所有页面，
   *              因此此方法不需要手动渲染。只需确保#viewer容器可见并让PDFViewer接管即可。
   */
  async renderToViewer(page, viewport) {
    // PDFViewer组件已经通过setDocument()自动渲染了所有页面
    // 我们不需要手动创建canvas或渲染
    // PDFViewer会在#viewer元素内自动创建并管理所有页面的canvas

    this.#logger.info(`PDFViewer mode: rendering handled automatically by PDFViewer component`);

    // 可选：如果需要跳转到特定页面，可以设置currentPageNumber
    if (this.#uiManager && this.#uiManager.pdfViewerManager) {
      const currentPage = this.#currentPage || 1;
      this.#uiManager.pdfViewerManager.currentPageNumber = currentPage;
      this.#logger.info(`Set PDFViewer to page ${currentPage}`);
    }
  }

  /**
   * 销毁应用，清理所有资源
   */
  destroy() {
    this.#logger.info("Destroying PDF Viewer App...");

    // 通过容器断开连接和清理资源
    if (this.#appContainer) {
      this.#appContainer.dispose();
    }

    this.#pdfManager.destroy();
    this.#uiManager.destroy();
    if (this.#bookmarkManager) {
      this.#bookmarkManager.destroy();
    }

    this.#logger.info("PDF Viewer App destroyed.");
    this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.DESTROYED, undefined, {
      actorId: 'PDFViewerApp'
    });

    this.#eventBus.destroy();
  }

  /**
   * 获取应用的公开状态快照
   * @returns {object} 应用的当前状态
   */
  getState() {
    return {
      initialized: this.#initialized,
      currentFile: this.#currentFile,
      currentPage: this.#currentPage,
      totalPages: this.#totalPages,
      zoomLevel: this.#zoomLevel
    };
  }

  /**
   * 获取事件总线实例（用于测试和外部集成）
   * @returns {EventBus} 事件总线实例
   */
  getEventBus() {
    return this.#eventBus;
  }

  /**
   * 加载PDF文档（用于测试）
   * @param {Object} pdfDocument - PDF文档对象
   */
  loadPDFDocument(pdfDocument) {
    this.#totalPages = pdfDocument.numPages;
    this.#currentPage = 1;
  }

  /**
   * 处理PDF加载错误（用于测试）
   * @param {Error} error - 错误对象
   */
  handlePDFLoadError(error) {
    this.#errorHandler.handleError(error, "PDFLoad");
  }

  // 受保护的getter方法，供子类访问私有字段
  get logger() { return this.#logger; }
  get eventBus() { return this.#eventBus; }
  get errorHandler() { return this.#errorHandler; }
  get pdfManager() { return this.#pdfManager; }
  get uiManager() { return this.#uiManager; }
  get initialized() { return this.#initialized; }
  get currentFile() { return this.#currentFile; }
  set currentFile(value) { this.#currentFile = value; }
  get currentPage() { return this.#currentPage; }
  set currentPage(value) { this.#currentPage = value; }
  get totalPages() { return this.#totalPages; }
  set totalPages(value) { this.#totalPages = value; }
  get zoomLevel() { return this.#zoomLevel; }
  set zoomLevel(value) { this.#zoomLevel = value; }
  get wsClient() { return this.#wsClient; }
  get messageQueue() { return this.#messageQueue; }
  get _appContainer() { return this.#appContainer; }
}
