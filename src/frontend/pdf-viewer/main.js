/**
 * @file PDF查看器应用主入口，负责模块的初始化、协调和生命周期管理
 * @module PDFViewerApp
 * @description 基于事件总线的组合式架构，管理PDF查看器的所有核心功能
 */

// 导入PDF.js viewer的CSS样式（用于文字层）
import 'pdfjs-dist/web/pdf_viewer.css';

import { PDFViewerAppCore } from "./app-core.js";
import { EventHandlers } from "./event-handlers.js";
import { getLogger } from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
import { createConsoleWebSocketBridge } from "../common/utils/console-websocket-bridge.js";

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

// ===== 应用启动 =====
// 使用新的bootstrap模式启动应用
import { bootstrapPDFViewerApp } from "./bootstrap/app-bootstrap.js";

document.addEventListener("DOMContentLoaded", async () => {
  const indexLogger = getLogger("PDFViewer");
  indexLogger.info("DOMContentLoaded: Starting PDF Viewer App bootstrap...");

  try {
    await bootstrapPDFViewerApp();
    indexLogger.info("PDF Viewer App bootstrap completed successfully");
  } catch (error) {
    indexLogger.error("PDF Viewer App bootstrap failed:", error);
  }
});