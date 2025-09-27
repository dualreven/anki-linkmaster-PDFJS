/**
 * @file PDF查看器应用主入口，负责模块的初始化、协调和生命周期管理
 * @module PDFViewerApp
 * @description 基于事件总线的组合式架构，管理PDF查看器的所有核心功能
 */

import { PDFViewerAppCore } from "./app-core.js";
import { EventHandlers } from "./event-handlers.js";
import Logger from "../common/utils/logger.js";
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
document.addEventListener("DOMContentLoaded", async () => {
  // 从URL参数获取端口配置
  const urlParams = new URLSearchParams(window.location.search);
  const msgCenterPort = urlParams.get('msgCenter') || '8765';
  const wsUrl = `ws://localhost:${msgCenterPort}`;

  const app = new PDFViewerApp({ wsUrl });  // 直接传入正确的WebSocket URL
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
  let pdfPath = null;

  // 优先检查window.PDF_PATH（通过script标签注入）
  if (window.PDF_PATH) {
    pdfPath = window.PDF_PATH;
    indexLogger.info(`Found injected PDF path: ${pdfPath}`);
  }
  // 其次检查URL参数file（通过launcher.py传递）
  else if (urlParams.get('file')) {
    pdfPath = decodeURIComponent(urlParams.get('file'));
    indexLogger.info(`Found PDF file from URL parameter: ${pdfPath}`);
  }

  if (pdfPath) {
    // 从完整路径中提取文件名
    const filename = pdfPath.includes('\\') || pdfPath.includes('/')
      ? pdfPath.split(/[\\\/]/).pop()
      : pdfPath;

    const eventBus = app.getEventBus();
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, {
      filename: filename,
      file_path: pdfPath
    }, { actorId: 'Launcher' });
  }
});