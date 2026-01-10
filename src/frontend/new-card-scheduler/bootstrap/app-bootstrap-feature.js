import { getLogger } from "../../common/utils/logger.js";
import { createAppContainer, createFeatureRegistry } from "../../common/micro-service/app-bootstrap.js";
import eventBusSingleton from "../../common/event/event-bus.js";

import { LegacyNewCardSchedulerFeature } from "../features/legacy/legacy-feature.js";

const defaultLogger = getLogger("new-card-scheduler.bootstrap");

/**
 * 启动 new-card-scheduler（Feature-based bootstrap，最小可用）
 *
 * @param {object} [options]
 * @param {HTMLElement} [options.rootEl] - 缺省：内部查找 #planner-workspace
 * @param {import("../../common/event/event-bus.js").EventBus} [options.eventBus] - 缺省：全局 singleton
 * @param {import("../../common/utils/logger.js").Logger} [options.logger]
 * @param {string} [options.clientId] - 缺省：从 URL 解析或回退 'new-card-scheduler'
 * @param {string} [options.wsUrl] - 缺省：内部 resolve ws port
 * @param {{showInfo: Function, showError: Function}} [options.notification]
 * @param {boolean} [options.enableWindowControls=true]
 * @returns {Promise<{destroy: Function}>}
 */
export async function bootstrapNewCardSchedulerAppFeature(options = {}) {
  const eventBus = options.eventBus || eventBusSingleton;
  const logger = options.logger || defaultLogger;

  const container = createAppContainer({
    name: "new-card-scheduler",
    eventBus,
    logger
  });

  const registry = createFeatureRegistry({
    container,
    eventBus,
    logger
  });

  registry.register(new LegacyNewCardSchedulerFeature({
    rootEl: options.rootEl,
    clientId: options.clientId,
    wsUrl: options.wsUrl,
    notification: options.notification,
    enableWindowControls: options.enableWindowControls !== false
  }));

  await registry.installAll();

  let destroyed = false;

  return {
    async destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      const names = registry.getRegisteredFeatures();
      for (let i = names.length - 1; i >= 0; i -= 1) {
        await registry.uninstall(names[i]);
      }
    }
  };
}

