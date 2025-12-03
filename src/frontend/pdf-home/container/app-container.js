import Logger from "../../common/utils/logger.js";
import { WEBSOCKET_MESSAGE_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_LEGACY_TYPES } from "../../common/event/event-constants.js";
import eventBusSingleton from "../../common/event/event-bus.js";
import { DependencyContainer } from "../../common/micro-service/dependency-container.js";
import { createAppContainerBase, buildWsUrlFromQuery } from "../../common/containers/app-container-base.js";
import { createWsConsoleBridge } from "../../common/utils/console-websocket-bridge.js";
// utf-8
// pdf-home container: uses DependencyContainer to manage services
// v2.0.0: 使用共享的 buildWsUrlFromQuery 函数

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
  // 创建依赖注入容器
  const diContainer = new DependencyContainer("pdf-home");

  const state = {
    root: resolveRoot(root)
  };

  let consoleBridge = null;

  // 注册核心服务（logger/eventBus），WSClient 由 AppContainerBase 管理
  registerCoreServices(diContainer, { logger });

  const baseContainer = createAppContainerBase({
    moduleName: "pdf-home",
    resolveInitialWsUrl: () => wsUrl || buildWsUrlFromQuery(),
    createIdentityOptions: () => ({
      client_name: "pdf-home",
      client_id: "pdf-home",
      module: "pdf-home"
    }),
    createLogger: () => {
      const loggerInstance = logger || new Logger("pdf-home.container");
      diContainer.register("logger", loggerInstance);
      return loggerInstance;
    },
    createEventBus: () => {
      diContainer.register("eventBus", eventBusSingleton);
      return eventBusSingleton;
    },
    onWsClientCreated: ({ wsClient }) => {
      diContainer.register("wsClient", wsClient);
    },
    onBeforeConnect: ({ logger: containerLogger }) => {
      // 懒创建 ConsoleBridge 并启用
      const wsClient = diContainer.has("wsClient") ? diContainer.get("wsClient") : null;
      if (!consoleBridge && wsClient) {
        try {
          consoleBridge = createWsConsoleBridge({
            source: "pdf-home",
            getWsClient: () => diContainer.has("wsClient") ? diContainer.get("wsClient") : null,
            minLevel: "warn"
          });
        } catch (e) {
          containerLogger.warn("[pdf-home] console bridge setup failed", e);
        }
      }
      if (consoleBridge && !consoleBridge.enabled && typeof consoleBridge.enable === "function") {
        try {
          consoleBridge.enable();
          containerLogger.info("[pdf-home] Console bridge enabled");
        } catch (e) {
          containerLogger.warn("[pdf-home] enable console bridge failed", e);
        }
      }
    },
    onBeforeDisconnect: ({ logger: containerLogger }) => {
      if (consoleBridge && consoleBridge.enabled && typeof consoleBridge.disable === "function") {
        try {
          consoleBridge.disable();
        } catch (e) {
          containerLogger.warn("[pdf-home] disable console bridge failed", e);
        }
      }
    },
    onConnected: ({ logger: containerLogger, wsClient }) => {
      try {
        containerLogger.info("[pdf-home] requesting initial list after connect");
        requestListWithClient(wsClient, containerLogger);
      } catch (e) {
        containerLogger.warn("[pdf-home] initial requestList failed", e);
      }
    },
    onReloadData: ({ logger: containerLogger, wsClient }) => {
      try {
        requestListWithClient(wsClient, containerLogger);
      } catch (e) {
        containerLogger.warn("[pdf-home] reloadData requestList failed", e);
      }
    }
  });

  let uiManager = null;

  function connect() {
    if (baseContainer._getState().disposed) {return;}
    baseContainer.connect();
  }

  function disconnect() {
    baseContainer.disconnect();
  }

  function dispose() {
    const loggerInstance = diContainer.get("logger");
    loggerInstance.info("[pdf-home] Disposing container...");
    baseContainer.dispose();
    try {
      uiManager?.dispose?.();
    } catch (e) {
      const logger = diContainer.get("logger");
      logger.warn("[pdf-home] uiManager dispose failed", e);
    }
    uiManager = null;
    consoleBridge = null;
    diContainer.dispose();
  }

  // mount UI and bridge events
  ensureUI();
  ensureEventBridges();

  return {
    connect,
    disconnect,
    reloadData: () => baseContainer.reloadData(),
    dispose,
    getDependencies,
    initialize: () => baseContainer.initialize(),
    isInitialized: () => baseContainer.isInitialized(),
    // 暴露容器实例（用于高级用法）
    getContainer: () => diContainer
  };

  // ---------------- helpers ----------------
  function ensureUI() {
    if (uiManager) {return;}
    const logger = diContainer.get("logger");
    import("../ui-manager.js").then((mod) => {
      const UIManager = mod.UIManager || mod.default;
      uiManager = new UIManager({ root: state.root, logger, send });
      uiManager.on?.("action:open-pdf", (payload) => send({ type: WEBSOCKET_MESSAGE_TYPES.OPEN_PDF, payload }));
      uiManager.on?.("action:remove-pdf", (payload) => send({ type: WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_REMOVE_RECORDS, payload }));
      uiManager.on?.("action:refresh", () => requestList());
    }).catch((e) => logger.warn("UI manager load failed", e));
  }

  function ensureEventBridges() {
    const eventBus = diContainer.get("eventBus");

    // 注释掉重复的事件监听，避免setData被多次调用
    // PDF列表更新已经在index.js中通过PDF_MANAGEMENT_EVENTS.LIST.UPDATED事件处理了
    // PDFManager会将WebSocket消息转换为PDF_MANAGEMENT_EVENTS事件

    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.SUCCESS, (message) => {
      try {
        uiManager?.notify?.({
          level: "info",
          message: message?.data?.message || "OK"
        });
      } catch (e) {
        const logger = diContainer.get("logger");
        logger.warn("[pdf-home] notify success failed", e);
      }
    }, { subscriberId: "pdf-home.container" });
  }

  function requestList() {
    send({ type: WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_LIST_RECORDS, data: {} });
  }

  function requestListWithClient(wsClient, loggerInstance) {
    if (!wsClient || typeof wsClient.send !== "function") {
      loggerInstance?.warn?.("[pdf-home] requestListWithClient skipped: wsClient not available");
      return;
    }
    try {
      wsClient.send({
        type: WEBSOCKET_LEGACY_TYPES.PDF_LIBRARY_LIST_RECORDS,
        data: {}
      });
    } catch (e) {
      loggerInstance?.warn?.("[pdf-home] requestListWithClient send failed", e);
    }
  }

  function send(msg) {
    try {
      const wsClient = diContainer.get("wsClient");
      wsClient?.send?.({ type: msg.type, data: msg.payload || msg.data || {} });
    } catch (e) {
      const logger = diContainer.get("logger");
      logger.warn("send failed", e);
    }
  }

  /**
   * 暴露核心依赖给外部使用（向后兼容）
   * @returns {Object} 包含 logger, eventBus, wsClient 的对象
   */
  function getDependencies() {
    return {
      logger: diContainer.get("logger"),
      eventBus: diContainer.get("eventBus"),
      wsClient: diContainer.has("wsClient") ? diContainer.get("wsClient") : null
    };
  }

}

/**
 * 注册核心服务到依赖容器
 * @param {DependencyContainer} container - 依赖容器
 * @param {Object} options - 配置选项
 * @param {Logger} options.logger - Logger 实例（可选）
 * @private
 */
function registerCoreServices(container, { logger } = {}) {
  // 注册 Logger
  const loggerInstance = logger || new Logger("pdf-home.container");
  container.register("logger", loggerInstance);

  // 注册 EventBus（使用全局单例）
  container.register("eventBus", eventBusSingleton);

  // WSClient 延迟注册（在 initialize 方法中注册）
  // 因为需要等待 wsUrl 确定和 eventBus 准备好
}

function resolveRoot(root) {
  if (root instanceof HTMLElement) {return root;}
  if (typeof root === "string") {return document.querySelector(root);}
  return document.getElementById("app") || document.body;
}

// 导出 buildWsUrlFromQuery 以保持向后兼容
export { buildWsUrlFromQuery };
