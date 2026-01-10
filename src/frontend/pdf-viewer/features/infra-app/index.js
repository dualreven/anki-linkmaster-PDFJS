/**
 * @file 应用核心功能域
 * @module AppCoreFeature
 * @description 负责应用容器、WebSocket连接等核心基础设施
 */

import { createPDFViewerContainer } from "../../container/app-container.js";
import { createWebSocketAdapter } from "../../adapters/websocket-adapter.js";
import { WebSocketAdapterViewer } from "../../adapters/websocket-adapter-viewer.js";  // 新增：注册适配器
import { getCurrentPdfIdFromWindow } from "../../shared/url-context.js";
import { setupWsInfra } from "../../../common/features/ws-infra/index.js";
// 不再直接在此处创建 ConsoleWebSocketBridge（由容器层统一管理）
import { showError } from "../../../common/utils/notification.js";
import { WebSocketErrorHandler } from "../../../common/utils/websocket-error-handler.js";

/**
 * 应用核心功能域
 * @class AppCoreFeature
 * @implements {IFeature}
 */
export class AppCoreFeature {
  #appContainer = null;
  #wsClient = null;
  #wsInfra = null;
  #consoleBridge = null;
  #errorHandler = null;  // WebSocket 错误处理器

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

    // 安装 WebSocketAdapter，将内部事件与WS契约桥接
    try {
      const { eventBus } = this.#appContainer.getDependencies();
      if (this.#wsClient && eventBus) {
        const pdfId = getCurrentPdfIdFromWindow();
        if (!pdfId) {
          throw new Error("[AppCoreFeature] missing required URL param: pdf-id");
        }
        const pdfIdProvider = () => pdfId;

        // 通过公共 WS 基础设施 helper 安装适配器
        this.#wsInfra = setupWsInfra({
          container,
          eventBus,
          logger,
          adapterFactories: [
            (wsClient, ev) => createWebSocketAdapter(wsClient, ev, pdfIdProvider),
            (wsClient, ev) => new WebSocketAdapterViewer(wsClient, ev, pdfIdProvider)
          ]
        });
        logger.info("WebSocketAdapter and WebSocketAdapterViewer initialized via WsInfra helper");

        // 标记适配器为已初始化，开始处理队列中的消息（例如导航请求）
        try {
          const adapters = Array.isArray(this.#wsInfra?.adapters) ? this.#wsInfra.adapters : [];
          adapters.forEach((adapter) => {
            if (adapter && typeof adapter.onInitialized === "function") {
              try {
                adapter.onInitialized();
              } catch (e) {
                logger.warn("Failed to mark WebSocket adapter initialized", e);
              }
            }
          });
        } catch (e) {
          logger.warn("Failed to run WebSocket adapter onInitialized hooks", e);
        }
      }
    } catch (e) {
      logger.error("Failed to initialize WebSocketAdapter");
      logger.error(`Error name: ${e?.name}`);
      logger.error(`Error message: ${e?.message}`);
      logger.error(`Error stack: ${e?.stack}`);
      // 注意：已使用 logger.error 记录，无需 console.error
    }

    // 连接 WebSocket（确保适配器已先完成安装，避免错过 connection:established 导致注册消息漏发）
    logger.info("Connecting WebSocket...");
    this.#appContainer.connect();

    // 不再创建独立的 Console 桥接器，避免与容器层冲突与重复日志

    // 全局后端错误 → toast 透传（使用统一的 WebSocketErrorHandler）
    try {
      this.#errorHandler = new WebSocketErrorHandler(
        context.globalEventBus,
        showError,  // 传入 showError 函数
        logger,
        "AppCoreFeature"
      );
      this.#errorHandler.register();
    } catch (e) {
      logger.warn("Failed to register WebSocketErrorHandler", e);
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

    // 注销 WebSocket 错误处理器
    if (this.#errorHandler) {
      this.#errorHandler.unregister();
      this.#errorHandler = null;
    }

    // 断开 WebSocket
    if (this.#appContainer) {
      this.#appContainer.disconnect();
    }

    // 销毁 Console 桥接器
    if (this.#consoleBridge) {
      this.#consoleBridge.disable();
      this.#consoleBridge = null;
    }

    // 销毁 WebSocket 适配器集合
    if (this.#wsInfra && typeof this.#wsInfra.dispose === "function") {
      this.#wsInfra.dispose();
    }
    this.#wsInfra = null;

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
