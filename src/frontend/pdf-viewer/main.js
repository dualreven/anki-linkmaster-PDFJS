/**
 * @file PDF查看器应用主入口，负责模块的初始化、协调和生命周期管理
 * @module PDFViewerApp
 * @description 基于事件总线的组合式架构，管理PDF查看器的所有核心功能
 */

import { EventBus } from "../common/event/event-bus.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf-viewer-constants.js";
import Logger, { LogLevel } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { PDFManager } from "./pdf-manager.js";
import { UIManager } from "./ui-manager.js";
import { WSClient } from "../common/ws/ws-client.js";
import { WEBSOCKET_EVENTS } from "../common/event/event-constants.js";

/**
 * @class PDFViewerApp
 * @description PDF查看器应用的核心协调器，管理所有模块的生命周期
 */
export class PDFViewerApp {
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
  #messageQueue = [];

  constructor() {
    this.#logger = new Logger("PDFViewerApp");
    this.#eventBus = new EventBus({
      enableValidation: true,
      logLevel: LogLevel.INFO,
    });
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
    
    // 初始化WebSocket客户端
    this.#wsClient = new WSClient("ws://localhost:8765", this.#eventBus);
    
    this.#logger.info("PDFViewerApp instance created");
  }

  /**
   * 初始化所有应用模块
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing PDF Viewer App...");
      this.#setupGlobalErrorHandling();
      this.#setupEventListeners();
      
      // 初始化WebSocket客户端
      this.#initializeWebSocket();
      
      await this.#pdfManager.initialize();
      await this.#uiManager.initialize();
      
      this.#initialized = true;
      this.#logger.info("PDF Viewer App initialized successfully.");
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.INITIALIZED, undefined, { 
        actorId: 'PDFViewerApp' 
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
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // WebSocket消息接收事件
    this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
      this.#handleWebSocketMessage(message);
    });

    // 文件加载事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (fileData) => {
      this.#handleFileLoadRequested(fileData);
    });

    // 页面导航事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => {
      this.#handleNavigationGoto(data);
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => {
      this.#handleNavigationPrevious();
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => {
      this.#handleNavigationNext();
    });

    // 缩放控制事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, () => {
      this.#handleZoomIn();
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, () => {
      this.#handleZoomOut();
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
      this.#handleZoomFitWidth();
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
      this.#handleZoomFitHeight();
    });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
      this.#handleZoomActualSize();
    });

    // 缩放改变事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
      this.#handleZoomChanged(data);
    });

    // 文件关闭事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.CLOSE, () => {
      this.#handleFileClose();
    });

    // 文件加载进度事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, (progressData) => {
      this.#handleFileLoadProgress(progressData);
    });

    // 文件加载重试事件 - 已禁用以避免无限重试循环
    // loadPDF 函数已内置 3 次重试机制，这里不再重复重试
    // this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.RETRY, (fileData) => {
    //   this.#handleFileLoadRetry(fileData);
    // });

    // 已初始化状态事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.STATE.INITIALIZED, this.#onInitialized.bind(this));
  }

  /**
   * 处理WebSocket消息
   * @param {Object} message - WebSocket消息
   * @private
   */
  #handleWebSocketMessage(message) {
    const { type, data } = message;
    
    if (!this.#initialized) {
      this.#logger.warn('Viewer not initialized yet, queuing WebSocket message:', message.type);
      this.#messageQueue.push(message);
      return;
    }

    
    switch (type) {
      case 'load_pdf_file':
        this.#handleLoadPdfFileMessage(data);
        break;
      
      default:
        // 其他消息类型不处理
        this.#logger.debug(`Received unhandled WebSocket message type: ${type}`);
        break;
    }
  }

  /**
   * 处理加载PDF文件消息
   * @param {Object} data - 文件数据
   * @private
   */
  #handleLoadPdfFileMessage(data) {
    // 支持新消息格式 (file_path) 和旧格式 (fileId)
    let fileData = null;

    if (data && data.filename && data.url) {
      if (data.file_path) {
        // 新格式：使用 file_path
        fileData = {
          file_path: data.file_path,
          filename: data.filename,
          url: data.url
        };
      } else if (data.fileId) {
        // 旧格式：保持兼容性
        fileData = {
          filename: data.filename,
          url: data.url,
          fileId: data.fileId
        };
      }

      if (fileData) {
        this.#logger.info(`Received load PDF file request: ${data.filename}`);

        // 触发文件加载事件
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, fileData, { actorId: 'WebSocket' });
      } else {
        this.#logger.warn('Invalid load_pdf_file message format:', data);
      }
    } else {
      this.#logger.warn('Invalid load_pdf_file message format (missing required fields):', data);
    }
  }

  /**
   * 处理文件加载请求
   * @param {Object} fileData - 文件数据
   * @private
   */
  async #handleFileLoadRequested(fileData) {
    try {
      this.#logger.info("Handling file load request:", fileData);

      // 先关闭当前文件（如果有）
      if (this.#currentFile) {
        await this.#handleFileClose();
      }

      // 显示加载状态
      this.#uiManager.showLoading(true);
      this.#uiManager.updateProgress(0, '开始加载');

      // 支持新消息格式 (file_path 优先)
      if (fileData.file_path) {
        this.#logger.info("Detected file_path in request, constructing proxy URL");
        fileData.url = `/pdfs/${encodeURIComponent(fileData.filename)}`;
      }

      // 加载PDF文档
      const pdfDocument = await this.#pdfManager.loadPDF(fileData);
      this.#currentFile = fileData;
      this.#totalPages = pdfDocument.numPages;
      
      // 隐藏进度条
      this.#uiManager.hideProgress();
      this.#uiManager.showLoading(false);
      
      // 更新状态并触发渲染
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        file: fileData,
        totalPages: this.#totalPages
      }, { actorId: 'PDFViewerApp' });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED, 
        this.#totalPages, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的页面信息
      this.#uiManager.updatePageInfo(1, this.#totalPages);

      // 渲染第一页
      await this.#renderPage(1);

    } catch (error) {
      this.#logger.error("Failed to load PDF file:", error);
      this.#uiManager.hideProgress();
      this.#uiManager.showLoading(false);
      
      // 显示用户友好的错误信息
      this.#uiManager.showError(error);
      
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, {
        error: error.message,
        file: fileData
      }, { actorId: 'PDFViewerApp' });
      this.#errorHandler.handleError(error, "PDFLoad");
    }
  }

  /**
   * 处理页面跳转
   * @param {Object} data - 跳转数据
   * @private
   */
  async #handleNavigationGoto(data) {
    const pageNumber = parseInt(data.pageNumber);
    if (pageNumber >= 1 && pageNumber <= this.#totalPages) {
      this.#currentPage = pageNumber;
      await this.#renderPage(pageNumber);
      
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#currentPage,
        totalPages: this.#totalPages
      }, { actorId: 'PDFViewerApp' });
      
      // 更新UI管理器中的页面信息
      this.#uiManager.updatePageInfo(this.#currentPage, this.#totalPages);
    }
  }

  /**
   * 处理上一页导航
   * @private
   */
  async #handleNavigationPrevious() {
    if (this.#currentPage > 1) {
      this.#currentPage--;
      await this.#renderPage(this.#currentPage);
      
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#currentPage,
        totalPages: this.#totalPages
      }, { actorId: 'PDFViewerApp' });
      
      // 更新UI管理器中的页面信息
      this.#uiManager.updatePageInfo(this.#currentPage, this.#totalPages);
    }
  }

  /**
   * 处理下一页导航
   * @private
   */
  async #handleNavigationNext() {
    if (this.#currentPage < this.#totalPages) {
      this.#currentPage++;
      await this.#renderPage(this.#currentPage);
      
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#currentPage,
        totalPages: this.#totalPages
      }, { actorId: 'PDFViewerApp' });
      
      // 更新UI管理器中的页面信息
      this.#uiManager.updatePageInfo(this.#currentPage, this.#totalPages);
    }
  }

  /**
   * 渲染指定页面
   * @param {number} pageNumber - 页面编号
   * @private
   */
  async #renderPage(pageNumber) {
    try {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_REQUESTED, {
        pageNumber,
        totalPages: this.#totalPages
      }, { actorId: 'PDFViewerApp' });

      const page = await this.#pdfManager.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.#zoomLevel });
      
      await this.#uiManager.renderPage(page, viewport);
      
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, {
        pageNumber,
        viewport
      }, { actorId: 'PDFViewerApp' });

    } catch (error) {
      this.#logger.error(`Failed to render page ${pageNumber}:`, error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_FAILED, {
        pageNumber,
        error: error.message
      }, { actorId: 'PDFViewerApp' });
      this.#errorHandler.handleError(error, "PageRender");
    }
  }

  /**
   * 处理放大操作
   * @private
   */
  #handleZoomIn() {
    this.#zoomLevel = Math.min(this.#zoomLevel + 0.25, 3.0);
    this.#applyZoom();
  }

  /**
   * 处理缩小操作
   * @private
   */
  #handleZoomOut() {
    this.#zoomLevel = Math.max(this.#zoomLevel - 0.25, 0.5);
    this.#applyZoom();
  }

  /**
   * 处理适应宽度操作
   * @private
   */
  async #handleZoomFitWidth() {
    if (this.#currentFile && this.#currentPage > 0) {
      const page = await this.#pdfManager.getPage(this.#currentPage);
      const containerWidth = this.#uiManager.getContainerWidth();
      const viewport = page.getViewport({ scale: 1 });
      this.#zoomLevel = containerWidth / viewport.width;
      this.#applyZoom();
    }
  }

  /**
   * 处理适应高度操作
   * @private
   */
  async #handleZoomFitHeight() {
    if (this.#currentFile && this.#currentPage > 0) {
      const page = await this.#pdfManager.getPage(this.#currentPage);
      const containerHeight = this.#uiManager.getContainerHeight();
      const viewport = page.getViewport({ scale: 1 });
      this.#zoomLevel = containerHeight / viewport.height;
      this.#applyZoom();
    }
  }

  /**
   * 处理实际大小操作
   * @private
   */
  #handleZoomActualSize() {
    this.#zoomLevel = 1.0;
    this.#applyZoom();
  }

  /**
   * 应用缩放设置
   * @private
   */
  async #applyZoom() {
    if (this.#currentFile && this.#currentPage > 0) {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
        zoomLevel: this.#zoomLevel
      }, { actorId: 'PDFViewerApp' });
      
      // 更新UI管理器中的缩放比例
      this.#uiManager.setScale(this.#zoomLevel);
      
      // 重新渲染当前页面
      await this.#renderPage(this.#currentPage);
    }
  }

  /**
   * 处理缩放改变事件
   * @param {Object} data - 缩放数据
   * @private
   */
  #handleZoomChanged(data) {
    if (data && data.zoomLevel) {
      this.#zoomLevel = data.zoomLevel;
      // UI管理器已经通过setScale方法更新显示
      this.#logger.debug(`Zoom level changed to: ${this.#zoomLevel}`);
    }
  }

  /**
   * 处理文件加载进度
   * @param {Object} progressData - 进度数据
   * @private
   */
  #handleFileLoadProgress(progressData) {
    this.#logger.debug(`File load progress: ${progressData.percent}%`);
    this.#uiManager.updateProgress(progressData.percent, '加载中');
  }
  #onInitialized() {
    this.#logger.info('Processing queued WebSocket messages:', this.#messageQueue.length);
    this.#messageQueue.forEach(message => this.#handleWebSocketMessage(message));
    this.#messageQueue = [];
  }

  /**
   * 处理文件加载重试
   * @param {Object} fileData - 文件数据
   * @private
   */
  async #handleFileLoadRetry(fileData) {
    this.#logger.info("Retrying file load:", fileData);
    this.#uiManager.hideError();
    this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, fileData, {
      actorId: 'PDFViewerApp'
    });
  }

  /**
   * 处理文件关闭
   * @private
   */
  async #handleFileClose() {
    this.#logger.info("Closing current PDF file");
    
    // 清理资源
    this.#pdfManager.cleanup();
    this.#uiManager.cleanup();
    
    this.#currentFile = null;
    this.#currentPage = 1;
    this.#totalPages = 0;
    this.#zoomLevel = 1.0;
    
    this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.LOADING, false, { 
      actorId: 'PDFViewerApp' 
    });
  }

  /**
   * 初始化WebSocket连接和相关管理器
   * @private
   */
  #initializeWebSocket() {
    try {
      this.#logger.info("Initializing WebSocket connection...");
      
      // 连接WebSocket服务器
      this.#wsClient.connect();
      
      this.#logger.info("WebSocket connection initialized successfully.");
    } catch (error) {
      this.#logger.error("Failed to initialize WebSocket connection:", error);
      this.#errorHandler.handleError(error, "WebSocketInitialization");
    }
  }

  /**
   * 销毁应用，清理所有资源
   */
  destroy() {
    this.#logger.info("Destroying PDF Viewer App...");
    
    // 断开WebSocket连接
    if (this.#wsClient) {
      this.#wsClient.disconnect();
    }
    
    this.#pdfManager.destroy();
    this.#uiManager.destroy();
    this.#eventBus.destroy();
    
    this.#logger.info("PDF Viewer App destroyed.");
    this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.DESTROYED, undefined, {
      actorId: 'PDFViewerApp'
    });
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
}

// ===== 应用启动 =====
document.addEventListener("DOMContentLoaded", async () => {
  const app = new PDFViewerApp();
  const indexLogger = new Logger("pdf-viewer/main.js");
  
  // PDF.js will be loaded by PDFManager via ES modules
  indexLogger.info("PDF.js will be loaded dynamically by PDFManager");
  console.log("[PDFViewer] PDF.js will be loaded dynamically by PDFManager");
  
  try {
    indexLogger.info("Starting PDFViewer App initialization...");
    console.log("[PDFViewer] Starting PDFViewer App initialization...");

    await app.initialize();

    // 暴露应用实例到全局，便于调试
    window.pdfViewerApp = {
      getState: () => app.getState(),
      destroy: () => app.destroy(),
      _internal: app // 用于高级调试
    };

    indexLogger.info("PDFViewer App initialized successfully");
    console.log("[PDFViewer] PDFViewer App initialized successfully");
    console.log("[PDFViewer] PDFViewerApp ready for use");

    // 自动加载测试PDF文件
    console.log("[PDFViewer] Attempting to load test PDF...");
    try {
      const testPdfData = {
        filename: "test.pdf",
        url: "/test.pdf",
        fileId: "test-pdf-001"
      };

      // 触发PDF加载事件
      app.getEventBus().emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, testPdfData, {
        actorId: 'PDFViewerApp'
      });
      console.log("[PDFViewer] Test PDF load request sent");
    } catch (loadError) {
      console.error("[PDFViewer] Failed to load test PDF:", loadError);
    }

  } catch (error) {
    indexLogger.error("Failed to start PDF Viewer App:", error);
    console.error("[PDFViewer] Failed to start PDF Viewer App:", error);
  }
});