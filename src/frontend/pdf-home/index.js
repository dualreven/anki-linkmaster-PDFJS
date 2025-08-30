/**
 * @file 应用主入口，负责模块的初始化、协调和生命周期管理。
 * @module PDFHomeApp
 */

import { EventBus } from "../common/event/event-bus.js";
import TableWrapper from './table-wrapper.js';
import { APP_EVENTS } from "../common/event/event-constants.js";
import Logger, { LogLevel } from "../common/utils/logger.js";
import { ErrorHandler } from "../common/error/error-handler.js";
import { UIManager } from "../common/ui/ui-manager.js";
import PDFManager from "../common/pdf/pdf-manager.js";
import WSClient from "../common/ws/ws-client.js";

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
  #initialized = false;

  constructor() {
    this.#logger = new Logger("PDFHomeApp");
    this.#eventBus = new EventBus({
      enableValidation: true,
      logLevel: LogLevel.DEBUG,
    });
    this.#errorHandler = new ErrorHandler(this.#eventBus);
    this.#websocketManager = new WSClient("ws://localhost:8765", this.#eventBus);
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);
  }

  /**
   * 初始化所有应用模块。
   */
  async initialize() {
    try {
      this.#logger.info("Initializing PDF Home App...");
      this.#setupGlobalErrorHandling();
      
      this.#pdfManager.initialize();
      this.#uiManager.initialize(); // UIManager now has its own initialization logic

      // Initialize table wrapper (Tabulator)
      const tableContainer = document.querySelector('#pdf-table-container');
      if (tableContainer) {
        this.tableWrapper = new TableWrapper(tableContainer, {
          columns: [
            { title: "File", field: "filename", headerFilter: true },
            { title: "Title", field: "title" },
            { title: "Pages", field: "page_count", hozAlign: "center" },
            { title: "Cards", field: "cards_count", hozAlign: "center" },
          ],
          selectable: true
        });

        // Subscribe to pdf list updates from event bus
        this.#eventBus.on('pdf:list:updated', (pdfs) => {
          try {
            const mapped = Array.isArray(pdfs) ? pdfs.map(p => ({ ...p })) : [];
            this.tableWrapper.setData(mapped);
          } catch (e) {
            this.#logger.error('Failed to update table wrapper data', e);
          }
        }, { subscriberId: 'PDFHomeApp' });
      } else {
        this.#logger.warn('Table container #pdf-table-container not found; skipping TableWrapper init');
      }
      this.#websocketManager.connect();
      
      this.#initialized = true;
      this.#logger.info("PDF Home App initialized successfully.");
      this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, { actorId: 'PDFHomeApp' });
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
    this.#websocketManager.disconnect();
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
      websocketConnected: this.#websocketManager.isConnected(),
      pdfCount: this.#pdfManager.getPDFs().length,
    };
  }
}

// ===== 应用启动 =====
document.addEventListener("DOMContentLoaded", () => {
  const app = new PDFHomeApp();
  const index_logger = new Logger("pdf-home/index.js");
  app.initialize().then(() => {
    window.app = {
        getState: () => app.getState(),
        destroy: () => app.destroy(),
        _internal: app // For advanced debugging
    };
    index_logger.info("PDF Home App started. Use window.app.getState() for status.");
  }).catch(error => {
    index_logger.error("Failed to start PDF Home App:", error);
  });
});
