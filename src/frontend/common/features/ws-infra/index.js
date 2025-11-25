/**
 * @file WebSocket 基础设施安装辅助工具
 * @module WsInfraHelper
 * @description
 * 在前端应用中统一安装一个或多个 WebSocket 适配器实例，
 * 避免在 pdf-home / pdf-viewer 等模块中重复编写相同的 wsClient + eventBus 适配逻辑。
 */

/**
 * 安装 WebSocket 适配器集合
 *
 * @param {Object} options
 * @param {import('../../common/micro-service/dependency-container.js').DependencyContainer} options.container - DI 容器（必须包含 wsClient 服务）
 * @param {import('../../common/event/event-bus.js').EventBus} options.eventBus - 全局事件总线
 * @param {import('../../common/utils/logger.js').Logger} options.logger - 日志记录器
 * @param {Array<Function>} options.adapterFactories - 适配器工厂列表：(wsClient, eventBus) => adapter
 * @returns {{ adapters: any[], dispose: () => void }} 已创建的适配器集合与清理函数
 */
export function setupWsInfra({ container, eventBus, logger, adapterFactories } = {}) {
  if (!container || typeof container.get !== "function") {
    throw new Error("[WsInfra] container with get() is required");
  }
  if (!eventBus) {
    throw new Error("[WsInfra] eventBus is required");
  }
  if (!Array.isArray(adapterFactories) || adapterFactories.length === 0) {
    throw new Error("[WsInfra] adapterFactories must be a non-empty array");
  }

  const wsClient = container.get("wsClient");
  if (!wsClient) {
    throw new Error("[WsInfra] wsClient service is required in container");
  }

  const adapters = [];

  for (const factory of adapterFactories) {
    const adapter = factory(wsClient, eventBus);
    if (!adapter || typeof adapter.setupMessageHandlers !== "function") {
      throw new Error("[WsInfra] adapter factory must return object with setupMessageHandlers()");
    }
    adapter.setupMessageHandlers();
    adapters.push(adapter);
  }

  const log = logger && typeof logger.info === "function" ? logger : null;
  try {
    log?.info?.("[WsInfra] WebSocket adapters installed", {
      count: adapters.length
    });
  } catch {
    // 日志失败不影响核心行为
  }

  return {
    adapters,
    dispose() {
      for (const adapter of adapters) {
        try {
          if (adapter && typeof adapter.destroy === "function") {
            adapter.destroy();
          }
        } catch (e) {
          try {
            log?.warn?.("[WsInfra] Adapter destroy failed", e);
          } catch {
            // 忽略 destroy 过程中的日志错误
          }
        }
      }
    }
  };
}

