/**
 * @file 应用初始化管理器
 * @module AppInitializationManager
 * @description 专门处理应用初始化过程的协调和管理
 */

import { APP_EVENTS } from "../../../common/event/event-constants.js";
import { setGlobalWebSocketClient, getLogger } from "../../../common/utils/logger.js";
import { ErrorHandler } from "../../../common/error/error-handler.js";

/**
 * 应用初始化管理器类
 * @class AppInitializationManager
 */
export class AppInitializationManager {
  #logger;
  #eventBus;
  #errorHandler;
  #appContainer;
  #pdfManager;
  #uiManager;
  #websocketManager;
  #initialized = false;

  /**
   * 构造函数
   * @param {Object} dependencies - 依赖对象
   */
  constructor(dependencies) {
    const {
      eventBus,
      appContainer,
      pdfManager,
      uiManager,
      websocketManager
    } = dependencies;

    this.#eventBus = eventBus;
    this.#appContainer = appContainer;
    this.#pdfManager = pdfManager;
    this.#uiManager = uiManager;
    this.#websocketManager = websocketManager;
    this.#logger = getLogger("AppInitializationManager");
    this.#errorHandler = new ErrorHandler(this.#eventBus);
  }

  /**
   * 执行应用初始化
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn("Application already initialized");
      return true;
    }

    try {
      this.#logger.info("Starting application initialization process");

      // 1. 设置全局错误处理
      this.#setupGlobalErrorHandling();

      // 2. 初始化应用容器
      await this.#initializeAppContainer();

      // 3. 设置全局WebSocket客户端
      this.#setupGlobalWebSocketClient();

      // 4. 初始化各个管理器
      await this.#initializeManagers();

      // 5. 标记初始化完成
      this.#markInitializationComplete();

      return true;
    } catch (error) {
      this.#handleInitializationError(error);
      return false;
    }
  }

  /**
   * 设置全局错误处理
   * @private
   */
  #setupGlobalErrorHandling() {
    this.#logger.debug("Setting up global error handling");

    // 设置全局未捕获异常处理
    window.addEventListener('error', (event) => {
      // 过滤掉资源加载错误（通常 event.error 为 null）
      if (!event.error) {
        // 这通常是脚本/图片/CSS 等资源加载失败
        if (event.message && event.message !== 'Script error.') {
          this.#logger.warn(`Resource loading error: ${event.message} at ${event.filename || 'unknown'}:${event.lineno || 0}`);
        }
        // 不调用 errorHandler，避免产生无意义的错误日志
        return;
      }

      // 只处理真正的 JavaScript 运行时错误
      this.#errorHandler.handleError(event.error, 'Global Error Handler');
    });

    // 设置全局Promise拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
      // event.reason 可能是任何值（Error、字符串、对象等）
      this.#errorHandler.handleError(event.reason, 'Unhandled Promise Rejection');
    });

    this.#logger.debug("Global error handling setup completed");
  }

  /**
   * 初始化应用容器
   * @private
   */
  async #initializeAppContainer() {
    if (!this.#appContainer.isInitialized()) {
      this.#logger.debug("Initializing application container");
      await this.#appContainer.initialize();

      // 从容器获取更新后的依赖
      const { logger, eventBus, wsClient } = this.#appContainer.getDependencies();
      this.#logger = logger;
      this.#eventBus = eventBus;
      this.#websocketManager = wsClient;

      this.#logger.debug("Application container initialized successfully");
    } else {
      this.#logger.debug("Application container already initialized");
    }
  }

  /**
   * 设置全局WebSocket客户端
   * @private
   */
  #setupGlobalWebSocketClient() {
    // 设置全局WebSocket客户端供Logger使用
    setGlobalWebSocketClient(this.#websocketManager);
    this.#logger.debug("Global WebSocket client configured");
  }

  /**
   * 初始化各个管理器
   * @private
   */
  async #initializeManagers() {
    this.#logger.debug("Initializing application managers");

    const managers = [
      { name: 'PDFManager', instance: this.#pdfManager },
      { name: 'UIManager', instance: this.#uiManager }
    ];

    for (const manager of managers) {
      try {
        if (manager.instance && typeof manager.instance.initialize === 'function') {
          this.#logger.debug(`Initializing ${manager.name}`);
          await manager.instance.initialize();
          this.#logger.debug(`${manager.name} initialized successfully`);
        } else {
          this.#logger.warn(`${manager.name} is not available or does not have initialize method`);
        }
      } catch (error) {
        this.#logger.error(`Failed to initialize ${manager.name}:`, error);
        throw new Error(`Manager initialization failed: ${manager.name}`);
      }
    }

    this.#logger.debug("All managers initialized successfully");
  }

  /**
   * 标记初始化完成
   * @private
   */
  #markInitializationComplete() {
    this.#initialized = true;
    this.#logger.info("Application initialization completed successfully");

    // 发出初始化完成事件
    this.#eventBus.emit(APP_EVENTS.INITIALIZATION.COMPLETED, undefined, {
      actorId: 'AppInitializationManager'
    });
  }

  /**
   * 处理初始化错误
   * @param {Error} error - 错误对象
   * @private
   */
  #handleInitializationError(error) {
    this.#logger.error("Application initialization failed:", error);
    this.#errorHandler.handleError(error, "App.initialize");

    // 发出初始化失败事件
    this.#eventBus.emit(APP_EVENTS.INITIALIZATION.FAILED, { error: error.message }, {
      actorId: 'AppInitializationManager'
    });
  }

  /**
   * 检查是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * 获取初始化状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      initialized: this.#initialized,
      hasAppContainer: this.#appContainer !== null,
      hasPDFManager: this.#pdfManager !== null,
      hasUIManager: this.#uiManager !== null,
      hasWebSocketManager: this.#websocketManager !== null,
      containerInitialized: this.#appContainer?.isInitialized?.() || false
    };
  }

  /**
   * 重置初始化状态（用于重新初始化）
   */
  reset() {
    this.#initialized = false;
    this.#logger.info("Application initialization state reset");
  }

  /**
   * 销毁初始化管理器
   */
  destroy() {
    this.#logger.info("Destroying AppInitializationManager");

    // 清理全局错误处理器
    window.removeEventListener('error', this.#handleInitializationError);
    window.removeEventListener('unhandledrejection', this.#handleInitializationError);

    this.#initialized = false;
    this.#logger.info("AppInitializationManager destroyed");
  }
}