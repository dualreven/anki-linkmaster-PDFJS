/**
 * @file PDF查看器应用主入口，负责模块的初始化、协调和生命周期管理
 * @module PDFViewerApp
 * @description 基于事件总线的组合式架构，管理PDF查看器的所有核心功能
 */

import { PDFViewerAppCore } from "./app-core.js";
import { EventHandlers } from "./event-handlers.js";
import Logger from "../common/utils/logger.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf_viewer-constants.js";
import { createConsoleWebSocketBridge } from "../common/utils/console-websocket-bridge.js";

/**
 * @class PDFViewerApp
 * @description PDF查看器应用的主类，整合核心功能和事件处理
 */
export class PDFViewerApp extends PDFViewerAppCore {
  #eventHandlers;

  constructor() {
    super();
    this.#eventHandlers = new EventHandlers(this);
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

// ===== 应用启动 =====
document.addEventListener("DOMContentLoaded", async () => {
  const app = new PDFViewerApp();
  const indexLogger = new Logger("pdf_viewer/main.js");

  // PDF.js will be loaded by PDFManager via ES modules
  indexLogger.info("PDF.js will be loaded dynamically by PDFManager");

  indexLogger.info("Starting PDFViewer App initialization...");

  await app.initialize();

  // 暴露应用实例到全局，便于调试
  window.pdfViewerApp = {
    getState: () => app.getState(),
    destroy: () => app.destroy(),
    _internal: app // 用于高级调试
  };

  indexLogger.info("PDFViewer App initialized successfully");

  // Check for injected PDF path and load it
  if (window.PDF_PATH) {
    indexLogger.info(`Found injected PDF path: ${window.PDF_PATH}`);
    const eventBus = app.getEventBus();
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, { filename: window.PDF_PATH }, { actorId: 'Launcher' });
  }
});