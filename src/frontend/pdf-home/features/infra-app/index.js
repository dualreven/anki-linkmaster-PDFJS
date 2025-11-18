/**
 * @file PDF Home 应用核心功能域
 * @module PDFHomeInfraAppFeature
 * @description 负责 PDF Home 的 WebSocket 注册（使用新协议）
 */

import { WebSocketAdapterHome } from "../../adapters/websocket-adapter-home.js";

/**
 * PDF Home 应用核心功能域
 * @class PDFHomeInfraAppFeature
 * @implements {IFeature}
 */
export class PDFHomeInfraAppFeature {
  #wsAdapterHome = null;
  #wsClient = null;
  #eventBus = null;

  /** 功能名称 */
  get name() {
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
    const { logger, globalEventBus, container } = context;

    logger.info("Installing PDFHomeInfraAppFeature...");

    // 从 DI 容器获取 wsClient（pdf-home 在 PDFHomeAppV2 中注册）
    this.#wsClient = container.get("wsClient");
    this.#eventBus = globalEventBus;

    if (!this.#wsClient) {
      logger.error("wsClient not found in container");
      throw new Error("wsClient is required for PDFHomeInfraAppFeature");
    }

    // 创建并设置 WebSocketAdapterHome（负责客户端注册）
    try {
      this.#wsAdapterHome = new WebSocketAdapterHome(this.#wsClient, this.#eventBus);
      this.#wsAdapterHome.setupMessageHandlers();
      logger.info("WebSocketAdapterHome initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize WebSocketAdapterHome", error);
      throw error;
    }

    logger.info("PDFHomeInfraAppFeature installed");
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info("Uninstalling PDFHomeInfraAppFeature...");

    // 销毁 WebSocketAdapterHome
    if (this.#wsAdapterHome && typeof this.#wsAdapterHome.destroy === "function") {
      this.#wsAdapterHome.destroy();
    }
    this.#wsAdapterHome = null;

    this.#wsClient = null;
    this.#eventBus = null;

    logger.info("PDFHomeInfraAppFeature uninstalled");
  }
}
