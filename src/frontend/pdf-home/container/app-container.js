import Logger from '../../common/utils/logger.js';
import { WEBSOCKET_MESSAGE_EVENTS } from '../../common/event/event-constants.js';
import eventBusSingleton from '../../common/event/event-bus.js';
import WSClient from '../../common/ws/ws-client.js';
import { DependencyContainer } from '../../common/micro-service/dependency-container.js';
// utf-8
// pdf-home container: uses DependencyContainer to manage services

/**
 * 创建 PDF-Home 应用容器（增强版，使用依赖注入）
 * @param {Object} options - 配置选项
 * @param {HTMLElement|string} options.root - 根元素
 * @param {string} options.wsUrl - WebSocket URL
 * @param {Logger} options.logger - Logger 实例（可选）
 * @param {boolean} options.enableValidation - 是否启用验证，默认 true
 * @returns {Object} 容器实例
 */
export function createPDFHomeContainer({ root, wsUrl, logger, enableValidation = true } = {}) {
  const state = {
    root: resolveRoot(root),
    wsUrl: wsUrl || buildWsUrlFromQuery(),
    disposed: false,
    initialized: false,
  };

  // 创建依赖注入容器
  const diContainer = new DependencyContainer('pdf-home');

  // 注册核心服务
  registerCoreServices(diContainer, { logger, wsUrl: state.wsUrl });

  let uiManager = null;

  function connect() {
    if (state.disposed) return;
    try {
      if (!state.wsUrl) state.wsUrl = buildWsUrlFromQuery();
      const logger = diContainer.get('logger');
      logger.info(`[pdf-home] connecting WS: ${state.wsUrl}`);

      const wsClient = diContainer.get('wsClient');
      wsClient.connect();
      // initial data
      requestList();
    } catch (e) {
      const logger = diContainer.get('logger');
      logger.warn('[pdf-home] connect failed', e);
    }
  }

  function disconnect() {
    try {
      const wsClient = diContainer.get('wsClient');
      wsClient?.disconnect?.();
    } catch {}
  }

  function dispose() {
    state.disposed = true;
    disconnect();
    try { uiManager?.dispose?.(); } catch {}
    uiManager = null;
    diContainer.dispose();
  }

  function reloadData() { requestList(); }

  // mount UI and bridge events
  ensureUI();
  ensureEventBridges();

  return {
    connect,
    disconnect,
    reloadData,
    dispose,
    getDependencies,
    initialize,
    isInitialized,
    // 暴露容器实例（用于高级用法）
    getContainer: () => diContainer
  };

  // ---------------- helpers ----------------
  function ensureUI() {
    if (uiManager) return;
    const logger = diContainer.get('logger');
    import('../ui-manager.js').then((mod) => {
      const UIManager = mod.UIManager || mod.default;
      uiManager = new UIManager({ root: state.root, logger, send });
      uiManager.on?.('action:open-pdf', (payload) => send({ type: 'pdf-library:open:viewer', payload }));
      uiManager.on?.('action:remove-pdf', (payload) => send({ type: 'pdf-library:remove:records', payload }));
      uiManager.on?.('action:refresh', () => requestList());
    }).catch((e) => logger.warn('UI manager load failed', e));
  }

  function ensureEventBridges() {
    const eventBus = diContainer.get('eventBus');

    // 注释掉重复的事件监听，避免setData被多次调用
    // PDF列表更新已经在index.js中通过PDF_MANAGEMENT_EVENTS.LIST.UPDATED事件处理了
    // PDFManager会将WebSocket消息转换为PDF_MANAGEMENT_EVENTS事件

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (message) => {
      try { uiManager?.notify?.({ level: 'info', message: message?.data?.message || 'OK' }); } catch {}
    }, { subscriberId: 'pdf-home.container' });

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => {
      try { uiManager?.notify?.({ level: 'error', message: message?.data?.message || '操作失败' }); } catch {}
    }, { subscriberId: 'pdf-home.container' });
  }

  function requestList() {
    send({ type: 'pdf-library:list:records', data: {} });
  }

  function send(msg) {
    try {
      const wsClient = diContainer.get('wsClient');
      const logger = diContainer.get('logger');
      wsClient?.send?.({ type: msg.type, data: msg.payload || msg.data || {} });
    } catch (e) {
      const logger = diContainer.get('logger');
      logger.warn('send failed', e);
    }
  }

  /**
   * 暴露核心依赖给外部使用（向后兼容）
   * @returns {Object} 包含 logger, eventBus, wsClient 的对象
   */
  function getDependencies() {
    return {
      logger: diContainer.get('logger'),
      eventBus: diContainer.get('eventBus'),
      wsClient: diContainer.has('wsClient') ? diContainer.get('wsClient') : null
    };
  }

  /**
   * 初始化容器内部服务（不产生副作用，如连接）
   */
  async function initialize() {
    if (state.disposed) return;
    if (state.initialized) return;

    const logger = diContainer.get('logger');

    if (!state.wsUrl) state.wsUrl = buildWsUrlFromQuery();

    // 确保 wsClient 已创建（但不连接）
    if (!diContainer.has('wsClient') && state.wsUrl) {
      try {
        const eventBus = diContainer.get('eventBus');
        const wsClient = new WSClient(state.wsUrl, eventBus);
        diContainer.register('wsClient', wsClient);
        logger.debug('WSClient created and registered');
      } catch (e) {
        logger.warn('ws client prepare failed', e);
      }
    }

    state.initialized = true;
  }

  function isInitialized() {
    return !!state.initialized;
  }
}

/**
 * 注册核心服务到依赖容器
 * @param {DependencyContainer} container - 依赖容器
 * @param {Object} options - 配置选项
 * @param {Logger} options.logger - Logger 实例（可选）
 * @param {string} options.wsUrl - WebSocket URL
 * @private
 */
function registerCoreServices(container, { logger, wsUrl } = {}) {
  // 注册 Logger
  const loggerInstance = logger || new Logger('pdf-home.container');
  container.register('logger', loggerInstance);

  // 注册 EventBus（使用全局单例）
  container.register('eventBus', eventBusSingleton);

  // WSClient 延迟注册（在 initialize 方法中注册）
  // 因为需要等待 wsUrl 确定和 eventBus 准备好
}

function resolveRoot(root) {
  if (root instanceof HTMLElement) return root;
  if (typeof root === 'string') return document.querySelector(root);
  return document.getElementById('app') || document.body;
}

function buildWsUrlFromQuery() {
  try {
    const params = new URLSearchParams(location.search);
    const msgCenterPort = params.get('msgCenter') || '8765';
    const host = location.hostname || '127.0.0.1';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${host}:${msgCenterPort}/`;
  } catch { return null; }
}
