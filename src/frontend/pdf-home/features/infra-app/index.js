/**
 * @file PDF Home 应用核心功能域
 * @module PDFHomeInfraAppFeature
 * @description 负责 PDF Home 的 WebSocket 注册（使用新协议），并复用公共 WS 基础设施 helper
 */

import { WebSocketAdapterHome } from "../../adapters/websocket-adapter-home.js";
import { setupWsInfra } from "../../../common/features/ws-infra/index.js";

/**
 * PDF Home 应用核心功能域
 * @class PDFHomeInfraAppFeature
 * @implements {IFeature}
 */
export class PDFHomeInfraAppFeature {
  #wsInfra = null;

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

    try {
      // 使用公共 WS 基础设施 helper 安装适配器
      this.#wsInfra = setupWsInfra({
        container,
        eventBus: globalEventBus,
        logger,
        adapterFactories: [
          (wsClient, eventBus) => new WebSocketAdapterHome(wsClient, eventBus)
        ]
      });
      logger.info("WebSocketAdapterHome initialized successfully via WsInfra helper");
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

    // 统一销毁 WS 适配器
    if (this.#wsInfra && typeof this.#wsInfra.dispose === "function") {
      this.#wsInfra.dispose();
    }
    this.#wsInfra = null;

    logger.info("PDFHomeInfraAppFeature uninstalled");
  }
}
