/**
 * @file WebSocket事件管理器
 * @module WebSocketEventManager
 * @description 专门处理WebSocket相关的事件监听和管理
 */

import { resolveWebSocketPort, DEFAULT_WS_PORT } from "../../utils/ws-port-resolver.js";
import { getLogger } from "../../../common/utils/logger.js";

/**
 * WebSocket事件管理器类
 * @class WebSocketEventManager
 */
export class WebSocketEventManager {
  #logger;
  #eventBus;
  #websocketManager;
  #wsPort;

  /**
   * 构造函数
   * @param {Object} eventBus - 事件总线
   * @param {Object} websocketManager - WebSocket管理器
   */
  constructor(eventBus, websocketManager) {
    this.#eventBus = eventBus;
    this.#websocketManager = websocketManager;
    this.#logger = getLogger("WebSocketEventManager");
    this.#wsPort = DEFAULT_WS_PORT;
  }

  /**
   * 设置WebSocket客户端
   * @returns {Promise<void>}
   */
  async setupWebSocketClient() {
    try {
      // 解析端口
      this.#wsPort = await resolveWebSocketPort();
      this.#logger.info(`WebSocket port resolved to: ${this.#wsPort}`);

      // 更新WebSocket URL
      if (this.#websocketManager && typeof this.#websocketManager.setUrl === 'function') {
        this.#websocketManager.setUrl(`ws://localhost:${this.#wsPort}`);
        this.#logger.info(`WebSocket URL updated to: ws://localhost:${this.#wsPort}`);
      }
    } catch (error) {
      this.#logger.error("Failed to setup WebSocket client:", error);
      throw error;
    }
  }

  /**
   * 设置WebSocket事件监听器
   */
  setupEventListeners() {
    // 在连接前注册"连接建立"监听，避免竞态丢失事件
    this.#eventBus.on('websocket:connection:established', () => {
      this.#handleWebSocketConnected();
    }, { subscriberId: 'WebSocketEventManager' });

    // 监听连接关闭事件
    this.#eventBus.on('websocket:connection:closed', () => {
      this.#handleWebSocketDisconnected();
    }, { subscriberId: 'WebSocketEventManager' });

    // 监听重连事件
    this.#eventBus.on('websocket:connection:reconnected', () => {
      this.#handleWebSocketReconnected();
    }, { subscriberId: 'WebSocketEventManager' });

    this.#logger.info("WebSocket event listeners setup completed");
  }

  /**
   * 处理WebSocket连接建立
   * @private
   */
  #handleWebSocketConnected() {
    this.#logger.info("WebSocket connected");

    // 完全禁用ConsoleWebSocketBridge，避免日志重复
    try {
      if (window.__earlyConsoleBridge?.disable) {
        window.__earlyConsoleBridge.disable();
        delete window.__earlyConsoleBridge;
      }
      this.#logger.info("Early console bridge disabled");
    } catch(e) {
      this.#logger.warn("Error disabling early bridge:", e);
    }
  }

  /**
   * 处理WebSocket连接断开
   * @private
   */
  #handleWebSocketDisconnected() {
    this.#logger.warn("WebSocket connection lost");
    // 可以在这里添加断线处理逻辑
  }

  /**
   * 处理WebSocket重连
   * @private
   */
  #handleWebSocketReconnected() {
    this.#logger.info("WebSocket reconnected successfully");
    // 可以在这里添加重连后的处理逻辑
  }

  /**
   * 连接WebSocket
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.#websocketManager && !this.#websocketManager.isConnected()) {
      await this.#websocketManager.connect();
    }
  }

  /**
   * 断开WebSocket连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.#websocketManager && this.#websocketManager.isConnected()) {
      await this.#websocketManager.disconnect();
    }
  }

  /**
   * 获取WebSocket连接状态
   * @returns {boolean} 连接状态
   */
  isConnected() {
    return this.#websocketManager ? this.#websocketManager.isConnected() : false;
  }

  /**
   * 获取WebSocket端口
   * @returns {number} WebSocket端口
   */
  getPort() {
    return this.#wsPort;
  }

  /**
   * 获取WebSocket URL
   * @returns {string} WebSocket URL
   */
  getUrl() {
    return `ws://localhost:${this.#wsPort}`;
  }

  /**
   * 获取WebSocket状态信息
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      port: this.#wsPort,
      url: this.getUrl(),
      hasWebSocketManager: this.#websocketManager !== null,
      readyState: this.#websocketManager?.getReadyState?.() || 'unknown'
    };
  }

  /**
   * 销毁WebSocket事件管理器
   */
  destroy() {
    this.#logger.info("Destroying WebSocketEventManager");

    // 不需要销毁websocketManager，因为它是外部传入的依赖
    this.#websocketManager = null;
    this.#logger.info("WebSocketEventManager destroyed");
  }
}