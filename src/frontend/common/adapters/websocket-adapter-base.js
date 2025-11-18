/**
 * @file WebSocket适配器公共基类
 * @module WebSocketAdapterBase
 * @description
 * 提供 WebSocket 注册机制的公共基类，支持新协议注册。
 * 子类需要实现 `_getRegistrationConfig()` 方法来提供专属配置。
 */

import { getLogger } from "../utils/logger.js";
import { WEBSOCKET_EVENTS } from "../event/event-constants.js";

/**
 * WebSocket适配器基类
 * @class WebSocketAdapterBase
 * @abstract
 */
export class WebSocketAdapterBase {
  /** @type {import('../utils/logger.js').Logger} */
  #logger;

  /** @type {import('../event/event-bus.js').EventBus} */
  #eventBus;

  /** @type {import('../ws/ws-client.js').WSClient} */
  #wsClient;

  /** @type {Array<Function>} */
  #unsubscribeFunctions = [];

  /** @type {string} */
  #loggerName;

  /**
   * 创建WebSocket适配器基类实例
   * @param {import('../ws/ws-client.js').WSClient} wsClient - WebSocket客户端实例
   * @param {import('../event/event-bus.js').EventBus} eventBus - 事件总线实例
   * @param {Object} options - 配置选项
   * @param {string} [options.loggerName="WebSocketAdapter"] - 日志器名称
   */
  constructor(wsClient, eventBus, options = {}) {
    if (!wsClient) {
      throw new Error("WebSocketAdapterBase: wsClient is required");
    }
    if (!eventBus) {
      throw new Error("WebSocketAdapterBase: eventBus is required");
    }

    this.#loggerName = options.loggerName || "WebSocketAdapter";
    this.#logger = getLogger(this.#loggerName);
    this.#eventBus = eventBus;
    this.#wsClient = wsClient;

    this.#logger.debug(`${this.#loggerName} instance created`);
  }

  /**
   * 获取注册配置（子类必须实现）
   * @abstract
   * @returns {Object} 注册配置对象
   * @returns {string} config.client_id - 客户端唯一标识
   * @returns {string[]} config.client_type - 客户端类型标签数组
   * @returns {string[]} config.capabilities - 客户端能力数组
   * @returns {Object} [config.metadata] - 扩展元数据
   * @protected
   */
  _getRegistrationConfig() {
    throw new Error(`${this.#loggerName}: Subclass must implement _getRegistrationConfig()`);
  }

  /**
   * 设置消息处理器（公共逻辑）
   * 建立WebSocket消息与内部事件之间的桥接
   * @public
   */
  setupMessageHandlers() {
    this.#logger.info("Setting up WebSocket message handlers");

    // 设置注册消息处理器
    this.#setupRegistrationHandler();

    this.#logger.debug("WebSocket message handlers setup complete");
  }

  /**
   * 设置注册消息处理器
   * @private
   */
  #setupRegistrationHandler() {
    // 监听连接建立事件，自动发送注册消息
    const unsubConn = this.#eventBus.on(
      WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED,
      () => {
        try {
          this.#sendRegistration();
        } catch (e) {
          this.#logger.warn("Failed to send client registration", e);
        }
      },
      { subscriberId: this.#loggerName }
    );

    this.#unsubscribeFunctions.push(unsubConn);
  }

  /**
   * 发送注册消息（使用新协议）
   * @private
   */
  #sendRegistration() {
    try {
      // 获取子类提供的注册配置
      const config = this._getRegistrationConfig();

      if (!config.client_id) {
        throw new Error("Registration config must include client_id");
      }
      if (!Array.isArray(config.client_type) || config.client_type.length === 0) {
        throw new Error("Registration config must include client_type array");
      }
      if (!Array.isArray(config.capabilities)) {
        throw new Error("Registration config must include capabilities array");
      }

      // 构造新协议注册消息
      const message = {
        type: "client:register:requested",
        metadata: { version: "1.0.0" },
        data: {
          client_id: config.client_id,
          client_type: config.client_type,
          capabilities: config.capabilities,
          metadata: config.metadata || {}
        }
      };

      // 发送注册消息
      this.#wsClient.send(message);

      this.#logger.info(
        "[Registration] 已发送新协议注册消息",
        {
          client_id: config.client_id,
          client_type: config.client_type,
          capabilities: config.capabilities
        }
      );
    } catch (error) {
      this.#logger.error("[Registration] 注册失败", error);
      throw error;
    }
  }

  /**
   * 清理资源（取消所有事件订阅）
   * @public
   */
  destroy() {
    this.#logger.info("Destroying WebSocketAdapter");

    // 取消所有事件订阅
    this.#unsubscribeFunctions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (e) {
        this.#logger.warn("Failed to unsubscribe", e);
      }
    });

    this.#unsubscribeFunctions = [];
    this.#logger.debug("WebSocketAdapter destroyed");
  }

  /**
   * 获取Logger实例（供子类使用）
   * @protected
   * @returns {import('../utils/logger.js').Logger}
   */
  get logger() {
    return this.#logger;
  }

  /**
   * 获取EventBus实例（供子类使用）
   * @protected
   * @returns {import('../event/event-bus.js').EventBus}
   */
  get eventBus() {
    return this.#eventBus;
  }

  /**
   * 获取WSClient实例（供子类使用）
   * @protected
   * @returns {import('../ws/ws-client.js').WSClient}
   */
  get wsClient() {
    return this.#wsClient;
  }
}
