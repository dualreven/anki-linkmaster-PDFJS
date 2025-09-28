/**
 * @file PDF查看器应用容器 - 依赖注入和生命周期管理
 * @module PDFViewerContainer
 * @description 参考pdf-home设计，实现pdf-viewer的容器化架构
 */

import { EventBus } from '../../common/event/event-bus.js';
import { getLogger, setGlobalWebSocketClient, LogLevel } from '../../common/utils/logger.js';
import { WSClient } from '../../common/ws/ws-client.js';
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

  // 创建核心依赖 - 使用getLogger单例模式
  const containerLogger = logger || getLogger('PDFViewer');
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
  let consoleBridge = null;
  let earlyConsoleBridge = null;

  /**
   * 确保基础设施已初始化
   */
  function ensureInfra() {
    if (!wsClient) {
      wsClient = new WSClient(state.wsUrl, eventBus);
      containerLogger.info(`[pdf-viewer] WSClient created for: ${state.wsUrl}`);

      // 设置全局WebSocket客户端用于Logger传输
      setGlobalWebSocketClient(wsClient);
      containerLogger.info('[pdf-viewer] Global WebSocket client set for Logger transmission');

      // 创建Console桥接器
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
   * 连接WebSocket服务器
   */
  function connect() {
    if (state.disposed || state.connected) return;

    try {
      containerLogger.info(`[pdf-viewer] connecting WS: ${state.wsUrl}`);

      // 启用早期Console桥接器
      if (earlyConsoleBridge && !earlyConsoleBridge.enabled) {
        earlyConsoleBridge.enable();
        containerLogger.info('[pdf-viewer] Early console bridge enabled');
      }

      ensureInfra();
      wsClient.connect();
      state.connected = true;

      // WebSocket连接建立后切换到主Console桥接器
      setTimeout(() => {
        if (wsClient && wsClient.isConnected()) {
          try {
            if (earlyConsoleBridge) {
              earlyConsoleBridge.disable();
            }
            if (consoleBridge) {
              consoleBridge.enable();
            }
            containerLogger.info('[pdf-viewer] Console bridge switched to main bridge');
          } catch (bridgeError) {
            containerLogger.warn('[pdf-viewer] Console bridge switch failed', bridgeError);
          }
        }
      }, 100);

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