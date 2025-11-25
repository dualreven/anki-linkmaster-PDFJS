/**
 * @file 应用容器基类 - WebSocket管理和生命周期
 * @module AppContainerBase
 * @description 提供跨模块复用的容器基础设施（EventBus、WSClient、状态管理）
 * @version 1.0.0
 */

import eventBusSingleton from "../event/event-bus.js";
import { getLogger, setGlobalWebSocketClient } from "../utils/logger.js";
import WSClient from "../ws/ws-client.js";

/**
 * 应用容器基类配置
 * @typedef {Object} AppContainerConfig
 * @property {string} moduleName - 模块名称（如 'pdf-viewer' 或 'pdf-home'）
 * @property {string} [wsUrl] - WebSocket连接URL
 * @property {Object} [logger] - 外部日志实例
 * @property {Object} [wsClientOptions] - WSClient额外配置
 */

/**
 * 创建应用容器基类实例
 * @param {AppContainerConfig} config - 配置选项
 * @returns {Object} 容器基础接口
 */
export function createAppContainerBase(config) {
  const {
    moduleName,
    wsUrl = null,
    logger = null,
    wsClientOptions = {}
  } = config;

  // 验证必需参数
  if (!moduleName) {
    throw new Error('AppContainerBase requires moduleName');
  }

  // 创建核心依赖
  const containerLogger = logger || getLogger(`${moduleName}.container`);
  const eventBus = eventBusSingleton;

  // 容器状态
  const state = {
    wsUrl: wsUrl || buildWsUrlFromQuery(),
    disposed: false,
    connected: false,
    initialized: false,
    moduleName
  };

  let wsClient = null;

  /**
   * 初始化容器（不自动连接）
   * @returns {Promise<void>}
   */
  async function initialize() {
    if (state.disposed) {
      containerLogger.warn(`[${moduleName}] Cannot initialize: container disposed`);
      return;
    }
    if (state.initialized) {
      containerLogger.debug(`[${moduleName}] Container already initialized`);
      return;
    }

    containerLogger.info(`[${moduleName}] Initializing container...`);

    // 准备WSClient但不连接
    if (!wsClient && state.wsUrl) {
      try {
        // 传递 wsClientOptions（如果提供），包含 client_name、client_id、module 等选项
        // 调用方负责显式构建完整的 client_name（禁止依赖 WSClient 自动推断）
        const finalOptions = wsClientOptions ? { ...wsClientOptions } : null;

        wsClient = new WSClient(state.wsUrl, eventBus, finalOptions);
        setGlobalWebSocketClient(wsClient);
        containerLogger.info(`[${moduleName}] WSClient created for: ${state.wsUrl}`);
      } catch (e) {
        containerLogger.warn(`[${moduleName}] WSClient creation failed`, e);
      }
    }

    state.initialized = true;
    containerLogger.info(`[${moduleName}] Container initialized`);
  }

  /**
   * 连接WebSocket服务器
   */
  function connect() {
    if (state.disposed) {
      containerLogger.warn(`[${moduleName}] Cannot connect: container disposed`);
      return;
    }
    if (state.connected) {
      containerLogger.debug(`[${moduleName}] Already connected`);
      return;
    }

    // 确保已经初始化
    if (!state.initialized) {
      containerLogger.warn(`[${moduleName}] Container not initialized, call initialize() first`);
      return;
    }

    try {
      containerLogger.info(`[${moduleName}] Connecting WS: ${state.wsUrl}`);

      // 确保WSClient存在
      if (!wsClient) {
        containerLogger.error(`[${moduleName}] WSClient not available`);
        return;
      }

      wsClient.connect();
      state.connected = true;
      containerLogger.info(`[${moduleName}] WebSocket connected`);

    } catch (error) {
      containerLogger.warn(`[${moduleName}] Connect failed`, error);
    }
  }

  /**
   * 断开WebSocket连接
   */
  function disconnect() {
    if (!state.connected) {
      containerLogger.debug(`[${moduleName}] Already disconnected`);
      return;
    }

    try {
      if (wsClient) {
        wsClient.disconnect();
      }
      state.connected = false;
      containerLogger.info(`[${moduleName}] WebSocket disconnected`);
    } catch (error) {
      containerLogger.warn(`[${moduleName}] Disconnect error`, error);
    }
  }

  /**
   * 销毁容器，清理所有资源
   */
  function dispose() {
    if (state.disposed) {
      containerLogger.debug(`[${moduleName}] Already disposed`);
      return;
    }

    containerLogger.info(`[${moduleName}] Disposing container...`);
    state.disposed = true;
    disconnect();
    wsClient = null;
    containerLogger.info(`[${moduleName}] Container disposed`);
  }

  /**
   * 更新WebSocket URL并重新连接
   * @param {string} newWsUrl - 新的WebSocket URL
   */
  function updateWebSocketUrl(newWsUrl) {
    if (state.disposed) {
      containerLogger.warn(`[${moduleName}] Cannot update URL: container disposed`);
      return;
    }

    const oldUrl = state.wsUrl;
    containerLogger.info(`[${moduleName}] Updating WebSocket URL from ${oldUrl} to ${newWsUrl}`);

    // 更新状态
    state.wsUrl = newWsUrl;

    // 如果当前已连接，需要断开并重新连接
    if (state.connected) {
      disconnect();
      wsClient = null; // 重置客户端以使用新URL

      // 重新初始化并连接
      state.initialized = false;
      initialize().then(() => connect());
    } else {
      // 如果未连接，只需重置初始化状态
      wsClient = null;
      state.initialized = false;
    }
  }

  /**
   * 获取容器管理的依赖
   * @returns {Object} 依赖对象 {logger, eventBus, wsClient}
   */
  function getDependencies() {
    return {
      logger: containerLogger,
      eventBus,
      wsClient
    };
  }

  /**
   * 检查容器是否已初始化
   * @returns {boolean}
   */
  function isInitialized() {
    return state.initialized;
  }

  /**
   * 获取容器状态（只读）
   * @returns {Object} 状态快照
   */
  function getState() {
    return {
      moduleName: state.moduleName,
      wsUrl: state.wsUrl,
      disposed: state.disposed,
      connected: state.connected,
      initialized: state.initialized
    };
  }

  // 返回基础接口
  return {
    // 生命周期方法
    initialize,
    connect,
    disconnect,
    dispose,

    // 状态查询
    isInitialized,
    getState,

    // 依赖管理
    getDependencies,

    // 配置更新
    updateWebSocketUrl,

    // 内部访问（供子类使用）
    _getLogger: () => containerLogger,
    _getEventBus: () => eventBus,
    _getWSClient: () => wsClient,
    _getState: () => state  // 注意：这是内部状态，可以修改
  };
}

/**
 * 从URL查询参数构建WebSocket URL
 * @returns {string|null} WebSocket URL
 */
export function buildWsUrlFromQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const msgCenterPort = params.get("msgCenter") || "8765";
    const host = location.hostname || "127.0.0.1";
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${host}:${msgCenterPort}/`;
  } catch {
    return null;
  }
}
