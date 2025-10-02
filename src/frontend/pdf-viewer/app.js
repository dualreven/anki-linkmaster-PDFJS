/**
 * @file PDF查看器应用主类
 * @module PDFViewerApp
 * @description 整合核心功能和事件处理
 */

import { PDFViewerAppCore } from "./app-core.js";
import { EventHandlers } from "./handlers/event-handlers-refactored.js";

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
      this.logger.info("[App.initialize] Step 1: Setting up event handlers...");
      this.#eventHandlers.setupEventListeners();
      this.logger.info("[App.initialize] Step 2: Event handlers setup complete, calling super.initialize()...");

      // 调用父类的初始化方法
      await super.initialize();

      this.logger.info("[App.initialize] Step 3: super.initialize() complete");
      this.logger.info("[App.initialize] Step 4: Checking renderModeManager status...");
      this.logger.info(`[App.initialize] renderModeManager exists: ${!!this.renderModeManager}`);
      if (this.renderModeManager) {
        this.logger.info(`[App.initialize] renderModeManager mode: ${this.renderModeManager.getCurrentMode()}`);
      }
      this.logger.info("PDF Viewer App initialized successfully.");
    } catch (error) {
      this.logger.error("Application initialization failed.", error);
      this.errorHandler.handleError(error, "App.initialize");
      throw error;
    }
  }
}