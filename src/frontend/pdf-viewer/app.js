/**
 * @file PDF查看器应用主类
 * @module PDFViewerApp
 * @description 整合核心功能和事件处理
 */

import { PDFViewerAppCore } from "./app-core.js";
import { EventHandlers } from "./event-handlers.js";

/**
 * @class PDFViewerApp
 * @description PDF查看器应用的主类，整合核心功能和事件处理
 */
export class PDFViewerApp extends PDFViewerAppCore {
  #eventHandlers;

  constructor(options = {}) {
    super(options);
    this.#eventHandlers = new EventHandlers(this);
  }

  setWebSocketUrl(wsUrl) {
    // 更新容器的WebSocket URL
    if (this._appContainer) {
      this._appContainer.updateWebSocketUrl(wsUrl);
    }
  }

  /**
   * 初始化所有应用模块
   * @returns {Promise<void>}
   */
  async initialize() {
    try{
      this.logger.info("Initializing PDF Viewer App...");
      this.#eventHandlers.setupEventListeners();

      // 调用父类的初始化方法
      await super.initialize();

      this.logger.info("PDF Viewer App initialized successfully.");
    } catch (error) {
      this.logger.error("Application initialization failed.", error);
      this.errorHandler.handleError(error, "App.initialize");
      throw error;
    }
  }
}