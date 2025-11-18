/**
 * @file 应用核心功能域
 * @module AppCoreFeature
 * @description 负责应用容器、WebSocket连接等核心基础设施
 */

import { createPDFViewerContainer } from "../../container/app-container.js";
import { createWebSocketAdapter } from "../../adapters/websocket-adapter.js";
import { WebSocketAdapterViewer } from "../../adapters/websocket-adapter-viewer.js";  // 新增：注册适配器
// 不再直接在此处创建 ConsoleWebSocketBridge（由容器层统一管理）
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { showError } from "../../../common/utils/notification.js";

/**
 * 应用核心功能域
 * @class AppCoreFeature
 * @implements {IFeature}
 */
export class AppCoreFeature {
  #appContainer = null;
  #wsClient = null;
  #wsAdapter = null;
  #wsAdapterViewer = null;  // 新增：专属注册适配器
  #consoleBridge = null;

  /** 功能名称 */
  get name() {
    // 规范化命名：基础设施前缀 infra-
    return "infra-app";
  }

  /** 版本号 */
  get version() {
    return "1.0.0";
  }

  /** 依赖的功能 */
  get dependencies() {
    return []; // 核心功能，无依赖
  }

  /**
   * 安装功能
   * @param {FeatureContext} context - 功能上下文
   */
  async install(context) {
    const { logger, config = {}, container } = context;

    logger.info("Installing AppCoreFeature...");

    // 获取 WebSocket URL（从配置或 URL 参数）
    let wsUrl = config.wsUrl;
    if (!wsUrl) {
      // 从 URL 参数获取端口
      const urlParams = new URLSearchParams(window.location.search);
      const msgCenterPort = urlParams.get("msgCenter");
      const wsPort = msgCenterPort ? parseInt(msgCenterPort, 10) : 8765;
      wsUrl = `ws://localhost:${wsPort}`;
    }

    logger.info(`Using WebSocket URL: ${wsUrl}`);

    // 创建应用容器
    this.#appContainer = createPDFViewerContainer({
      wsUrl,
      enableValidation: true,
      logger
    });

    // 初始化容器
    if (!this.#appContainer.isInitialized()) {
      logger.info("Initializing app container...");
      await this.#appContainer.initialize();

      // 获取 WSClient
      const { wsClient } = this.#appContainer.getDependencies();
      this.#wsClient = wsClient;

      // 将 wsClient 注册到根容器，供其他 Feature（如 PDFBookmarkFeature）获取
      try {
        if (container && typeof container.registerGlobal === "function" && this.#wsClient) {
          container.registerGlobal("wsClient", this.#wsClient);
          logger.info("wsClient registered globally in DI container");
        }
      } catch (e) {
        logger.warn("Failed to register wsClient globally", e);
      }

      logger.info("App container initialized");
    }

    // 连接 WebSocket
    logger.info("Connecting WebSocket...");
    this.#appContainer.connect();

    // 安装 WebSocketAdapter，将内部事件与WS契约桥接
    try {
      const { eventBus } = this.#appContainer.getDependencies();
      if (this.#wsClient && eventBus) {
        // 旧的 WebSocketAdapter 负责消息路由（保留所有现有功能）
        this.#wsAdapter = createWebSocketAdapter(this.#wsClient, eventBus);
        this.#wsAdapter.setupMessageHandlers();

        // 新的 WebSocketAdapterViewer 负责客户端注册（使用统一新协议）
        this.#wsAdapterViewer = new WebSocketAdapterViewer(this.#wsClient, eventBus);
        this.#wsAdapterViewer.setupMessageHandlers();

        logger.info("WebSocketAdapter and WebSocketAdapterViewer initialized");
      }
    } catch (e) {
      logger.error("Failed to initialize WebSocketAdapter");
      logger.error(`Error name: ${e?.name}`);
      logger.error(`Error message: ${e?.message}`);
      logger.error(`Error stack: ${e?.stack}`);
      console.error("WebSocketAdapter initialization error:", e);
    }

    // 不再创建独立的 Console 桥接器，避免与容器层冲突与重复日志

    // 全局后端错误 → toast 透传（便于调试）
    try {
      const bus = context.globalEventBus;
      bus.on(WEBSOCKET_EVENTS.MESSAGE.SEND_FAILED, (err) => {
        try {
          const msg = (err && err.error_message) || "WebSocket 消息发送失败";
          const type = err && err.message_type;
          showError(type ? `${type}: ${msg}` : msg, 5000);
        } catch { }
      }, { subscriberId: "AppCoreFeature" });

      bus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (payload) => {
        try {
          const type = payload && (payload.type || payload.received_type);
          const errMsg = (payload && (payload.message || payload.error_message))
            || (payload && payload.error && (payload.error.message || payload.error.code))
            || "操作失败";
          showError(type ? `${type}: ${errMsg}` : errMsg, 6000);
        } catch { }
      }, { subscriberId: "AppCoreFeature" });
    } catch (e) {
      logger.warn("注册全局错误 toast 失败", e);
    }

    logger.info("AppCoreFeature installed successfully");
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info("Uninstalling AppCoreFeature...");

    // 断开 WebSocket
    if (this.#appContainer) {
      this.#appContainer.disconnect();
    }

    // 销毁 Console 桥接器
    if (this.#consoleBridge) {
      this.#consoleBridge.disable();
      this.#consoleBridge = null;
    }

    // 销毁 WebSocketAdapter
    if (this.#wsAdapter && typeof this.#wsAdapter.destroy === "function") {
      this.#wsAdapter.destroy();
    }
    this.#wsAdapter = null;

    // 销毁 WebSocketAdapterViewer
    if (this.#wsAdapterViewer && typeof this.#wsAdapterViewer.destroy === "function") {
      this.#wsAdapterViewer.destroy();
    }
    this.#wsAdapterViewer = null;

    // 销毁容器
    if (this.#appContainer) {
      this.#appContainer.dispose();
      this.#appContainer = null;
    }

    this.#wsClient = null;

    logger.info("AppCoreFeature uninstalled");
  }

  /**
   * 获取应用容器（供其他 Feature 使用）
   */
  getAppContainer() {
    return this.#appContainer;
  }

  /**
   * 获取 WebSocket 客户端（供其他 Feature 使用）
   */
  getWSClient() {
    return this.#wsClient;
  }
}

