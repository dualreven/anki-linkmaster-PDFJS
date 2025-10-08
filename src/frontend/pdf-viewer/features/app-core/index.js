/**
 * @file 应用核心功能域
 * @module AppCoreFeature
 * @description 负责应用容器、WebSocket连接等核心基础设施
 */

import { createPDFViewerContainer } from '../../container/app-container.js';
import { createWebSocketAdapter } from '../../adapters/websocket-adapter.js';
import { createConsoleWebSocketBridge } from '../../../common/utils/console-websocket-bridge.js';

/**
 * 应用核心功能域
 * @class AppCoreFeature
 * @implements {IFeature}
 */
export class AppCoreFeature {
  #appContainer = null;
  #wsClient = null;
  #wsAdapter = null;
  #consoleBridge = null;

  /** 功能名称 */
  get name() {
    return 'app-core';
  }

  /** 版本号 */
  get version() {
    return '1.0.0';
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
    const { globalEventBus, logger, config = {}, container } = context;

    logger.info('Installing AppCoreFeature...');

    // 获取 WebSocket URL（从配置或 URL 参数）
    let wsUrl = config.wsUrl;
    if (!wsUrl) {
      // 从 URL 参数获取端口
      const urlParams = new URLSearchParams(window.location.search);
      const msgCenterPort = urlParams.get('msgCenter');
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
      logger.info('Initializing app container...');
      await this.#appContainer.initialize();

      // 获取 WSClient
      const { wsClient } = this.#appContainer.getDependencies();
      this.#wsClient = wsClient;

      // 将 wsClient 注册到根容器，供其他 Feature（如 PDFBookmarkFeature）获取
      try {
        if (container && typeof container.registerGlobal === 'function' && this.#wsClient) {
          container.registerGlobal('wsClient', this.#wsClient);
          logger.info('wsClient registered globally in DI container');
        }
      } catch (e) {
        logger.warn('Failed to register wsClient globally', e);
      }

      logger.info('App container initialized');
    }

    // 连接 WebSocket
    logger.info('Connecting WebSocket...');
    this.#appContainer.connect();

    // 安装 WebSocketAdapter，将内部事件与WS契约桥接
    try {
      const { eventBus } = this.#appContainer.getDependencies();
      if (this.#wsClient && eventBus) {
        this.#wsAdapter = createWebSocketAdapter(this.#wsClient, eventBus);
        this.#wsAdapter.setupMessageHandlers();
      }
    } catch (e) {
      logger.warn('Failed to initialize WebSocketAdapter', e);
    }

    // 不再创建独立的 Console 桥接器，避免与容器层冲突与重复日志

    logger.info('AppCoreFeature installed successfully');
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info('Uninstalling AppCoreFeature...');

    // 断开 WebSocket
    if (this.#appContainer) {
      this.#appContainer.disconnect();
    }

    // 销毁 Console 桥接器
    if (this.#consoleBridge) {
      this.#consoleBridge.disable();
      this.#consoleBridge = null;
    }

    // 销毁容器
    if (this.#appContainer) {
      this.#appContainer.dispose();
      this.#appContainer = null;
    }

    this.#wsAdapter = null;

    this.#wsClient = null;

    logger.info('AppCoreFeature uninstalled');
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
