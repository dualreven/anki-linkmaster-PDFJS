/**
 * @file PDF查看器应用容器 - 依赖注入和生命周期管理
 * @module PDFViewerContainer
 * @description 参考pdf-home设计，实现pdf-viewer的容器化架构
 */

import eventBusSingleton from '../../common/event/event-bus.js';  // 使用默认导出的单例
import { getLogger, setGlobalWebSocketClient, LogLevel } from '../../common/utils/logger.js';
import WSClient from '../../common/ws/ws-client.js';  // WSClient也是默认导出
import { createConsoleWebSocketBridge } from '../../common/utils/console-websocket-bridge.js';

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

  // 创建核心依赖 - 使用单例模式
  const containerLogger = logger || getLogger('pdf-viewer.container');
  const eventBus = eventBusSingleton;  // 使用共享的EventBus单例

  // 容器状态
  const state = {
    wsUrl: wsUrl || buildWsUrlFromQuery(),
    disposed: false,
    connected: false,
    initialized: false  // 添加初始化状态
  };

  let wsClient = null;
  let consoleBridge = null;
  let earlyConsoleBridge = null;

  /**
   * 确保基础设施已初始化
   */
  function ensureInfra() {
    // 这里只负责设置Console桥接器
    // WSClient的创建移到initialize()方法中
    if (!consoleBridge && !earlyConsoleBridge) {
      setupConsoleBridge();
    }
  }

  /**
   * 设置Console桥接器
   */
  function setupConsoleBridge() {
    // PDF-Viewer特定的过滤规则
    const pdfViewerSkipPatterns = [
      'PDF\\.js.*worker.*ready',           // PDF.js Worker就绪
      'Canvas.*render.*progress',          // Canvas渲染进度
      'Page.*\\d+.*rendered',             // 页面渲染完成 (频繁)
      'Zoom.*level.*\\d+\\.\\d+',         // 缩放级别变化 (频繁)
      'Scroll.*position.*\\d+',           // 滚动位置更新
      'WebSocket.*ping.*pong',            // WebSocket心跳
      'Console log recorded successfully' // 后端响应确认
    ];

    // 早期Console桥接器 - 在WebSocket连接前缓存日志
    earlyConsoleBridge = createConsoleWebSocketBridge('pdf-viewer', (message) => {
      if (wsClient && wsClient.isConnected()) {
        wsClient.send({ type: 'console_log', data: message });
      }
    });

    // 创建主Console桥接器
    consoleBridge = createConsoleWebSocketBridge('pdf-viewer', (message) => {
      if (wsClient && wsClient.isConnected()) {
        wsClient.send({ type: 'console_log', data: message });
      }
    });

    // 设置PDF-Viewer特定的过滤规则
    if (consoleBridge.setSkipPatterns) {
      consoleBridge.setSkipPatterns(pdfViewerSkipPatterns);
    }
    if (earlyConsoleBridge.setSkipPatterns) {
      earlyConsoleBridge.setSkipPatterns(pdfViewerSkipPatterns);
    }

    // 暴露给全局供调试使用
    window.__earlyConsoleBridge = earlyConsoleBridge;
    containerLogger.info('[pdf-viewer] Console bridge setup completed with PDF-specific filters');
  }

  /**
   * 禁用Console桥接器，避免日志循环
   * 参考pdf-home的实现
   */
  function disableConsoleBridge() {
    try {
      // 禁用早期Console桥接器
      if (earlyConsoleBridge && earlyConsoleBridge.enabled) {
        earlyConsoleBridge.disable();
        containerLogger.info('[pdf-viewer] Early console bridge disabled');
      }

      // 禁用主Console桥接器
      if (consoleBridge && consoleBridge.enabled) {
        consoleBridge.disable();
        containerLogger.info('[pdf-viewer] Console bridge disabled');
      }

      // 清理全局引用
      if (window.__earlyConsoleBridge) {
        delete window.__earlyConsoleBridge;
      }
    } catch (e) {
      containerLogger.warn('[pdf-viewer] Error disabling console bridge:', e);
    }
  }

  /**
   * 连接WebSocket服务器
   */
  function connect() {
    if (state.disposed || state.connected) return;

    // 禁用 ConsoleWebSocketBridge，避免日志循环
    // 参考 pdf-home 的实现：完全禁用 Console Bridge
    disableConsoleBridge();

    // 确保已经初始化
    if (!state.initialized) {
      containerLogger.warn('[pdf-viewer] Container not initialized, call initialize() first');
      return;
    }

    try {
      containerLogger.info(`[pdf-viewer] connecting WS: ${state.wsUrl}`);

      // 确保WSClient存在
      if (!wsClient) {
        containerLogger.error('[pdf-viewer] WSClient not available');
        return;
      }

      wsClient.connect();
      state.connected = true;

    } catch (error) {
      containerLogger.warn('[pdf-viewer] connect failed', error);
    }
  }

  /**
   * 断开连接
   */
  function disconnect() {
    try {
      // 禁用Console桥接器
      if (consoleBridge) {
        consoleBridge.disable();
      }
      if (earlyConsoleBridge) {
        earlyConsoleBridge.disable();
      }

      if (wsClient) {
        wsClient.disconnect();
      }
      state.connected = false;
      containerLogger.info('[pdf-viewer] Disconnected and console bridges disabled');
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

  /**
   * 初始化容器（不自动连接）
   * @returns {Promise<void>}
   */
  async function initialize() {
    if (state.disposed) return;
    if (state.initialized) return;

    containerLogger.info('[pdf-viewer] Initializing container...');

    // 确保基础设施
    ensureInfra();

    // 准备WSClient但不连接
    if (!wsClient && state.wsUrl) {
      try {
        wsClient = new WSClient(state.wsUrl, eventBus);
        setGlobalWebSocketClient(wsClient);
        containerLogger.info(`[pdf-viewer] WSClient created for: ${state.wsUrl}`);
      } catch (e) {
        containerLogger.warn('[pdf-viewer] WSClient creation failed', e);
      }
    }

    state.initialized = true;
    containerLogger.info('[pdf-viewer] Container initialized');
  }

  /**
   * 检查容器是否已初始化
   * @returns {boolean}
   */
  function isInitialized() {
    return !!state.initialized;
  }

  // 返回容器接口
  return {
    initialize,      // 新增
    isInitialized,   // 新增
    connect,
    disconnect,
    reloadData,
    dispose,
    getDependencies,
    updateWebSocketUrl
  };
}

/**
 * 从URL查询参数构建WebSocket URL
 * @returns {string|null} WebSocket URL
 */
function buildWsUrlFromQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const msgCenterPort = params.get('msgCenter') || '8765';
    const host = location.hostname || '127.0.0.1';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host}:${msgCenterPort}/`;
  } catch {
    return null;
  }
}