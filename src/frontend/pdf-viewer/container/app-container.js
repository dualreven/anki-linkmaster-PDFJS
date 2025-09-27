/**
 * @file PDF查看器应用容器 - 依赖注入和生命周期管理
 * @module PDFViewerContainer
 * @description 参考pdf-home设计，实现pdf-viewer的容器化架构
 */

import { EventBus } from '../../common/event/event-bus.js';
import Logger, { LogLevel } from '../../common/utils/logger.js';
import { WSClient } from '../../common/ws/ws-client.js';

/**
 * 创建PDF查看器应用容器
 * @param {Object} options - 配置选项
 * @param {string} [options.wsUrl] - WebSocket连接URL
 * @param {boolean} [options.enableValidation=true] - 是否启用事件验证
 * @param {Logger} [options.logger] - 外部日志实例
 * @returns {Object} 容器实例，包含connect/disconnect/getDependencies等方法
 */
export function createPDFViewerContainer({
  wsUrl = 'ws://localhost:8765',
  enableValidation = true,
  logger = null
} = {}) {

  // 创建核心依赖
  const containerLogger = logger || new Logger('pdf-viewer.container');
  const eventBus = new EventBus({
    enableValidation,
    logLevel: LogLevel.INFO
  });

  // 容器状态
  const state = {
    wsUrl,
    disposed: false,
    connected: false
  };

  let wsClient = null;

  /**
   * 确保基础设施已初始化
   */
  function ensureInfra() {
    if (!wsClient) {
      wsClient = new WSClient(state.wsUrl, eventBus);
      containerLogger.info(`[pdf-viewer] WSClient created for: ${state.wsUrl}`);
    }
  }

  /**
   * 连接WebSocket服务器
   */
  function connect() {
    if (state.disposed || state.connected) return;

    try {
      containerLogger.info(`[pdf-viewer] connecting WS: ${state.wsUrl}`);
      ensureInfra();
      wsClient.connect();
      state.connected = true;

      // 初始化时请求基础数据（如果需要的话）
      // TODO: 根据pdf-viewer的实际需求添加初始化逻辑
    } catch (error) {
      containerLogger.warn('[pdf-viewer] connect failed', error);
    }
  }

  /**
   * 断开连接
   */
  function disconnect() {
    try {
      if (wsClient) {
        wsClient.disconnect();
      }
      state.connected = false;
    } catch (error) {
      containerLogger.warn('[pdf-viewer] disconnect error', error);
    }
  }

  /**
   * 销毁容器，清理所有资源
   */
  function dispose() {
    state.disposed = true;
    disconnect();
    wsClient = null;
    containerLogger.info('[pdf-viewer] container disposed');
  }

  /**
   * 重新加载数据
   */
  function reloadData() {
    if (state.disposed) return;
    containerLogger.info('[pdf-viewer] reloading data');
    // TODO: 根据pdf-viewer的需求实现数据重载逻辑
  }

  /**
   * 更新WebSocket URL并重新连接
   * @param {string} newWsUrl - 新的WebSocket URL
   */
  function updateWebSocketUrl(newWsUrl) {
    if (state.disposed) return;

    const oldUrl = state.wsUrl;
    containerLogger.info(`[pdf-viewer] updating WebSocket URL from ${oldUrl} to ${newWsUrl}`);

    // 更新状态
    state.wsUrl = newWsUrl;

    // 如果当前已连接，需要断开并重新连接
    if (state.connected) {
      disconnect();
      wsClient = null; // 重置客户端以使用新URL
      connect();
    } else {
      // 如果未连接，只需重置客户端
      wsClient = null;
    }
  }

  /**
   * 获取容器管理的依赖
   * @returns {Object} 依赖对象 {logger, eventBus, wsClient}
   */
  function getDependencies() {
    ensureInfra();
    return {
      logger: containerLogger,
      eventBus,
      wsClient
    };
  }

  // 返回容器接口
  return {
    connect,
    disconnect,
    reloadData,
    dispose,
    getDependencies,
    updateWebSocketUrl
  };
}