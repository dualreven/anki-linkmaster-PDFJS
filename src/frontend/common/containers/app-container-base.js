/**
 * @file 应用容器基类 - WebSocket 管理和生命周期
 * @module AppContainerBase
 * @description 提供跨模块复用的容器基础设施（EventBus、WSClient、状态管理），通过 hook 注入各模块差异。
 * @version 2.0.0
 */

import eventBusSingleton from "../event/event-bus.js";
import { getLogger } from "../utils/logger.js";
import WSClient from "../ws/ws-client.js";

/**
 * 应用容器基类配置
 * @typedef {Object} AppContainerConfig
 * @property {string} moduleName - 模块名称（如 'pdf-viewer' 或 'pdf-home'）
 * @property {() => (string|null|undefined)} [resolveInitialWsUrl] - 可选：解析初始 WS URL 的函数
 * @property {(ctx: { wsUrl:string|null, logger:any, eventBus:any, userContext:any }) => any} createIdentityOptions - 必选：构建 WSClient 身份配置的函数
 * @property {() => any} [createLogger] - 可选：自定义 Logger 构造函数
 * @property {() => any} [createEventBus] - 可选：自定义 EventBus 构造函数
 * @property {(ctx: { wsClient:any, logger:any, eventBus:any, userContext:any }) => void} [onWsClientCreated] - 可选：WSClient 创建成功后的回调
 * @property {(ctx: { logger:any, eventBus:any, wsClient:any, userContext:any }) => void} [onBeforeConnect] - 可选：connect 调用前的 hook
 * @property {(ctx: { logger:any, eventBus:any, wsClient:any, userContext:any }) => void} [onConnected] - 可选：WS 连接成功后的 hook
 * @property {(ctx: { logger:any, eventBus:any, wsClient:any, userContext:any }) => void} [onBeforeDisconnect] - 可选：disconnect 前的 hook
 * @property {(ctx: { logger:any, eventBus:any, wsClient:any, userContext:any }) => void} [onAfterDisconnect] - 可选：disconnect 后的 hook
 * @property {(ctx: { logger:any, eventBus:any, wsClient:any, userContext:any }) => void} [onReloadData] - 可选：reloadData 调用时的 hook
 * @property {any} [userContext] - 可选：透传给各 hook 的上下文对象
 */

/**
 * 创建应用容器基类实例
 * @param {AppContainerConfig} config - 配置选项
 * @returns {Object} 容器基础接口
 */
export function createAppContainerBase(config = {}) {
  const {
    moduleName,
    resolveInitialWsUrl,
    createIdentityOptions,
    createLogger,
    createEventBus,
    onWsClientCreated,
    onBeforeConnect,
    onConnected,
    onBeforeDisconnect,
    onAfterDisconnect,
    onReloadData,
    userContext = null
  } = config;

  if (!moduleName) {
    throw new Error("AppContainerBase requires moduleName");
  }
  if (typeof createIdentityOptions !== "function") {
    throw new Error("AppContainerBase requires createIdentityOptions(options)");
  }

  const logger = typeof createLogger === "function"
    ? createLogger()
    : getLogger(`${moduleName}.container`);
  const eventBus = typeof createEventBus === "function"
    ? createEventBus()
    : eventBusSingleton;

  // 解析初始 WS URL：优先使用自定义 resolver，其次使用通用 query 解析
  let initialWsUrl = null;
  try {
    if (typeof resolveInitialWsUrl === "function") {
      initialWsUrl = resolveInitialWsUrl() || null;
    }
  } catch (e) {
    logger.warn(`[${moduleName}] resolveInitialWsUrl failed`, e);
  }
  if (!initialWsUrl) {
    initialWsUrl = buildWsUrlFromQuery();
  }

  const state = {
    moduleName,
    wsUrl: initialWsUrl,
    disposed: false,
    connected: false,
    initialized: false,
    userContext
  };

  /** @type {any} */
  let wsClient = null;

  /**
   * 初始化容器（不自动连接）
   * @returns {Promise<void>}
   */
  async function initialize() {
    if (state.disposed) {
      logger.warn(`[${moduleName}] Cannot initialize: container disposed`);
      return;
    }
    if (state.initialized) {
      logger.debug(`[${moduleName}] Container already initialized`);
      return;
    }

    logger.info(`[${moduleName}] Initializing container...`);

    // 准备 WSClient 但不连接
    if (!wsClient && state.wsUrl) {
      try {
        const identityOptions = createIdentityOptions({
          wsUrl: state.wsUrl,
          logger,
          eventBus,
          userContext: state.userContext
        });
        const finalOptions = identityOptions ?? null;
        wsClient = new WSClient(state.wsUrl, eventBus, finalOptions);

        if (typeof onWsClientCreated === "function") {
          try {
            onWsClientCreated({
              wsClient,
              logger,
              eventBus,
              userContext: state.userContext
            });
          } catch (hookError) {
            logger.warn(`[${moduleName}] onWsClientCreated hook failed`, hookError);
          }
        }

        logger.info(`[${moduleName}] WSClient created for: ${state.wsUrl}`);
      } catch (e) {
        logger.warn(`[${moduleName}] WSClient creation failed`, e);
      }
    }

    state.initialized = true;
    logger.info(`[${moduleName}] Container initialized`);
  }

  /**
   * 连接 WebSocket 服务器
   */
  function connect() {
    if (state.disposed) {
      logger.warn(`[${moduleName}] Cannot connect: container disposed`);
      return;
    }
    if (state.connected) {
      logger.debug(`[${moduleName}] Already connected`);
      return;
    }

    if (!state.initialized) {
      logger.warn(`[${moduleName}] Container not initialized, call initialize() first`);
      return;
    }

    const deps = { logger, eventBus, wsClient, userContext: state.userContext };

    if (typeof onBeforeConnect === "function") {
      try {
        onBeforeConnect(deps);
      } catch (e) {
        logger.warn(`[${moduleName}] onBeforeConnect hook failed`, e);
      }
    }

    try {
      logger.info(`[${moduleName}] Connecting WS: ${state.wsUrl}`);

      if (!wsClient) {
        logger.error(`[${moduleName}] WSClient not available`);
        return;
      }

      wsClient.connect();
      state.connected = true;
      logger.info(`[${moduleName}] WebSocket connected`);
    } catch (error) {
      logger.warn(`[${moduleName}] Connect failed`, error);
    }

    if (typeof onConnected === "function") {
      try {
        onConnected(deps);
      } catch (e) {
        logger.warn(`[${moduleName}] onConnected hook failed`, e);
      }
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  function disconnect() {
    if (!state.connected) {
      logger.debug(`[${moduleName}] Already disconnected`);
      return;
    }

    const deps = { logger, eventBus, wsClient, userContext: state.userContext };

    if (typeof onBeforeDisconnect === "function") {
      try {
        onBeforeDisconnect(deps);
      } catch (e) {
        logger.warn(`[${moduleName}] onBeforeDisconnect hook failed`, e);
      }
    }

    try {
      if (wsClient && typeof wsClient.disconnect === "function") {
        wsClient.disconnect();
      }
      state.connected = false;
      logger.info(`[${moduleName}] WebSocket disconnected`);
    } catch (error) {
      logger.warn(`[${moduleName}] Disconnect error`, error);
    }

    if (typeof onAfterDisconnect === "function") {
      try {
        onAfterDisconnect(deps);
      } catch (e) {
        logger.warn(`[${moduleName}] onAfterDisconnect hook failed`, e);
      }
    }
  }

  /**
   * 触发业务层重载数据（由 hook 决定具体行为）
   */
  function reloadData() {
    if (typeof onReloadData !== "function") {
      return;
    }
    const deps = { logger, eventBus, wsClient, userContext: state.userContext };
    try {
      onReloadData(deps);
    } catch (e) {
      logger.warn(`[${moduleName}] onReloadData hook failed`, e);
    }
  }

  /**
   * 销毁容器，清理所有资源
   */
  function dispose() {
    if (state.disposed) {
      logger.debug(`[${moduleName}] Already disposed`);
      return;
    }

    logger.info(`[${moduleName}] Disposing container...`);
    state.disposed = true;
    disconnect();
    wsClient = null;
    logger.info(`[${moduleName}] Container disposed`);
  }

  /**
   * 更新 WebSocket URL 并在需要时重新连接
   * @param {string} newWsUrl - 新的 WebSocket URL
   */
  function updateWebSocketUrl(newWsUrl) {
    if (state.disposed) {
      logger.warn(`[${moduleName}] Cannot update URL: container disposed`);
      return;
    }

    const oldUrl = state.wsUrl;
    logger.info(`[${moduleName}] Updating WebSocket URL from ${oldUrl} to ${newWsUrl}`);

    const wasConnected = state.connected;

    state.wsUrl = newWsUrl;
    state.initialized = false;
    wsClient = null;

    if (wasConnected) {
      disconnect();
      // 重新初始化并连接
      initialize().then(connect).catch((e) => {
        logger.warn(`[${moduleName}] Reconnect after URL update failed`, e);
      });
    }
  }

  /**
   * 获取容器管理的依赖
   * @returns {Object} 依赖对象 {logger, eventBus, wsClient}
   */
  function getDependencies() {
    return {
      logger,
      eventBus,
      wsClient
    };
  }

  /**
   * 检查容器是否已初始化
   * @returns {boolean}
   */
  function isInitialized() {
    return !!state.initialized;
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
    initialize,
    connect,
    disconnect,
    reloadData,
    dispose,
    updateWebSocketUrl,
    getDependencies,
    isInitialized,
    getState,
    // 内部访问（供适配层使用）
    _getLogger: () => logger,
    _getEventBus: () => eventBus,
    _getWSClient: () => wsClient,
    _getState: () => state
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
