/**
 * @file PDF查看器应用核心模块
 * @module PDFViewerAppCore
 * @description PDF查看器应用的核心功能，包括初始化、状态管理和基础协调
 */

import { EventBus } from "../common/event/event-bus.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf-viewer-constants.js";
import Logger, { LogLevel } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { PDFManager } from "./pdf-manager.js";
import { UIManager } from "./ui-manager.js";
import { WSClient } from "../common/ws/ws-client.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS } from "../common/event/event-constants.js";

/**
 * @class PDFViewerAppCore
 * @description PDF查看器应用的核心协调器，管理所有模块的生命周期
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
    try{
      this.#logger.info("Initializing PDF Viewer App...");
      this.#setupGlobalErrorHandling();

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
   * 处理已初始化状态
   */
  onInitialized() {
    this.#logger.info('Processing queued WebSocket messages:', this.#messageQueue.length);
    this.#messageQueue.forEach(message => this.handleWebSocketMessage(message));
    this.#messageQueue = [];
  }

  /**
   * 处理WebSocket消息
   * @param {Object} message - WebSocket消息
   */
  handleWebSocketMessage(message) {
    const { type, data } = message;

    if (!this.#initialized) {
      this.#logger.warn('Viewer not initialized yet, queuing WebSocket message:', message.type);
      this.#messageQueue.push(message);
      return;
    }

    switch (type) {
      case 'load_pdf_file':
        this.handleLoadPdfFileMessage(data);
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
   */
  handleLoadPdfFileMessage(data) {
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
}