/**
 * @file PDF Home应用核心类，负责应用的生命周期管理（重构版）
 * @module PDFHomeApp
 * @description 基于组合模式重构，使用专门的管理器处理不同职责
 */

import { createPDFHomeContainer } from "../container/app-container.js";
import { getLogger } from "../../common/utils/logger.js";
import { UIManager } from "../ui-manager.js";
import PDFManager from "../../common/pdf/pdf-manager.js";
import { DEFAULT_WS_PORT } from "../utils/ws-port-resolver.js";

// 导入专门的管理器
import { AppInitializationManager } from "./managers/app-initialization-manager.js";
import { TableConfigurationManager } from "./managers/table-configuration-manager.js";
import { WebSocketEventManager } from "./managers/websocket-event-manager.js";

/**
 * @class PDFHomeApp
 * @description 应用的核心协调器，使用组合模式管理各个专门的管理器
 */
export class PDFHomeApp {
  #logger;
  #eventBus;
  #websocketManager;
  #pdfManager;
  #uiManager;
  #coreGuard = null;
  #appContainer;

  // 专门的管理器
  #initializationManager;
  #tableConfigurationManager;
  #websocketEventManager;

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

    // 确保容器已初始化，这样wsClient才会被创建
    if (this.#appContainer.initialize && !this.#appContainer.isInitialized()) {
      // 这里不能使用await，因为构造函数不能是async
      // 所以我们暂时先获取可用的依赖
    }

    // 从容器获取依赖
    const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#websocketManager = wsClient;

    // 初始化基础管理器
    this.#initializeBasicManagers(deps);

    // 初始化专门的管理器
    this.#initializeSpecializedManagers();
  }

  /**
   * 初始化基础管理器
   * @param {Object} deps - 依赖对象
   * @private
   */
  #initializeBasicManagers(deps) {
    // 创建核心保护器
    this.#coreGuard = deps.coreGuard || null;

    // 创建各个基础管理器
    this.#pdfManager = new PDFManager(this.#eventBus);
    this.#uiManager = new UIManager(this.#eventBus);

    this.#logger.info("Basic managers initialized");
  }

  /**
   * 初始化专门的管理器
   * @private
   */
  #initializeSpecializedManagers() {
    // 创建应用初始化管理器
    this.#initializationManager = new AppInitializationManager({
      eventBus: this.#eventBus,
      appContainer: this.#appContainer,
      pdfManager: this.#pdfManager,
      uiManager: this.#uiManager,
      websocketManager: this.#websocketManager
    });

    // 创建表格配置管理器
    this.#tableConfigurationManager = new TableConfigurationManager(
      this.#eventBus,
      this.#uiManager
    );

    // 创建WebSocket事件管理器
    this.#websocketEventManager = new WebSocketEventManager(
      this.#eventBus,
      this.#websocketManager
    );

    this.#logger.info("Specialized managers initialized with modular architecture");
  }

  /**
   * 初始化所有应用模块
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

      // 0. 首先确保容器已初始化，以便获取wsClient
      if (this.#appContainer.initialize && !this.#appContainer.isInitialized()) {
        await this.#appContainer.initialize();
        // 重新获取依赖，特别是wsClient
        const { wsClient } = this.#appContainer.getDependencies();
        this.#websocketManager = wsClient;

        // 重新创建WebSocketEventManager，使用正确的wsClient
        this.#websocketEventManager = new WebSocketEventManager(
          this.#eventBus,
          this.#websocketManager
        );
      }

      // 1. 设置WebSocket客户端
      await this.#websocketEventManager.setupWebSocketClient();

      // 2. 设置表格配置
      this.#tableConfigurationManager.setupEventListeners();

      // 3. 设置WebSocket事件监听
      this.#websocketEventManager.setupEventListeners();

      // 4. 连接WebSocket（如果需要）
      if (!this.#websocketEventManager.isConnected()) {
        await this.#websocketEventManager.connect();
      }

      // 5. 执行主要初始化过程
      const success = await this.#initializationManager.initialize();

      if (success) {
        this.#logger.info("PDF Home App initialized successfully.");
      } else {
        throw new Error("Initialization manager failed to complete initialization");
      }

    } catch (error) {
      this.#logger.error("Application initialization failed.", error);
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  /**
   * 获取表格包装器实例（向后兼容）
   * @returns {TableWrapper|null} 表格包装器实例
   */
  get tableWrapper() {
    return this.#tableConfigurationManager.getTableWrapper();
  }

  /**
   * 设置表格包装器实例（向后兼容）
   * @param {TableWrapper} wrapper - 表格包装器实例
   */
  set tableWrapper(wrapper) {
    // 这个setter主要用于向后兼容，实际的表格管理由TableConfigurationManager处理
    this.#logger.debug("tableWrapper setter called - delegating to TableConfigurationManager");
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态对象
   */
  getState() {
    return {
      initialization: this.#initializationManager.getStatus(),
      tableConfiguration: this.#tableConfigurationManager.getStatus(),
      websocket: this.#websocketEventManager.getStatus(),
      managers: {
        pdf: this.#pdfManager !== null,
        ui: this.#uiManager !== null
      },
      architecture: 'modular-composition'
    };
  }

  /**
   * 检查应用是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.#initializationManager.isInitialized();
  }

  /**
   * 获取PDF管理器（用于调试和测试）
   * @returns {PDFManager} PDF管理器实例
   */
  getPDFManager() {
    return this.#pdfManager;
  }

  /**
   * 获取UI管理器（用于调试和测试）
   * @returns {UIManager} UI管理器实例
   */
  getUIManager() {
    return this.#uiManager;
  }


  /**
   * 获取WebSocket管理器（用于调试和测试）
   * @returns {Object} WebSocket管理器实例
   */
  getWebSocketManager() {
    return this.#websocketManager;
  }

  /**
   * 销毁应用
   */
  async destroy() {
    this.#logger.info("Destroying PDFHomeApp and all managers");

    // 销毁专门的管理器
    if (this.#initializationManager) {
      this.#initializationManager.destroy();
      this.#initializationManager = null;
    }

    if (this.#tableConfigurationManager) {
      this.#tableConfigurationManager.destroy();
      this.#tableConfigurationManager = null;
    }

    if (this.#websocketEventManager) {
      this.#websocketEventManager.destroy();
      this.#websocketEventManager = null;
    }

    // 销毁基础管理器
    if (this.#uiManager && typeof this.#uiManager.destroy === 'function') {
      await this.#uiManager.destroy();
    }

    if (this.#pdfManager && typeof this.#pdfManager.destroy === 'function') {
      await this.#pdfManager.destroy();
    }

    this.#logger.info("PDFHomeApp destroyed successfully");
  }
}