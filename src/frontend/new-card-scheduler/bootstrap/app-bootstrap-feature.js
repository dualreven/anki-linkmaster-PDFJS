import { getLogger } from "../../common/utils/logger.js";
import { createAppContainer, createFeatureRegistry } from "../../common/micro-service/app-bootstrap.js";
import eventBusSingleton from "../../common/event/event-bus.js";
import { showError, showInfo } from "../../common/utils/notification.js";

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
  const notification = options.notification || { showInfo, showError };
  if (!notification || typeof notification.showInfo !== "function" || typeof notification.showError !== "function") {
    throw new Error("bootstrapNewCardSchedulerAppFeature: notification.showInfo/showError 必填");
  }

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
    notification,
    enableWindowControls: options.enableWindowControls !== false
  }));

  await registry.installAll();

  const registered = registry.getRegisteredFeatures();
  const installed = registry.getInstalledFeatures();
  const summary = registry.getStatusSummary();
  const failed = Array.isArray(summary?.features)
    ? summary.features.filter((f) => f?.status === "failed")
    : [];

  const line = (label, items) => {
    const list = Array.isArray(items) ? items.filter((x) => typeof x === "string" && x.trim()) : [];
    return `- ${label} (${list.length}): ${list.length ? list.join(", ") : "（无）"}`;
  };

  logger.info("[NCS Bootstrap] install summary");
  logger.info(line("registered", registered));
  logger.info(line("installed", installed));
  if (failed.length) {
    const failedNames = failed.map((f) => {
      const name = typeof f?.name === "string" ? f.name : "(unknown)";
      const msg = typeof f?.error === "string" ? f.error : "";
      return msg ? `${name}: ${msg}` : name;
    });
    logger.info(line("failed", failedNames));
    notification.showError("有 feature 安装失败（详见日志）", 3500);
  } else {
    logger.info(line("failed", []));
  }

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
