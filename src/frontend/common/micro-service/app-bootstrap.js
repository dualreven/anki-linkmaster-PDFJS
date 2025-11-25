/**
 * @file 应用级 DI 与 FeatureRegistry 启动辅助工具
 * @module AppBootstrap
 * @description
 * 提供创建应用级 DependencyContainer 与 FeatureRegistry 的统一入口，
 * 用于 pdf-home / pdf-viewer 等前端模块的启动流程。
 */

import { DependencyContainer } from "./dependency-container.js";
import { FeatureRegistry } from "./feature-registry.js";

/**
 * 创建应用级依赖注入容器，并预注册核心服务。
 *
 * @param {Object} options
 * @param {string} options.name - 容器名称（如 'pdf-home-v2'、'pdf-viewer'）
 * @param {import('../event/event-bus.js').EventBus} [options.eventBus] - 全局事件总线
 * @param {import('../utils/logger.js').Logger} [options.logger] - 应用级日志记录器
 * @returns {DependencyContainer}
 */
export function createAppContainer({ name, eventBus, logger } = {}) {
  const container = new DependencyContainer(name || "app");

  if (eventBus) {
    container.register("eventBus", eventBus, { scope: "singleton" });
  }

  if (logger) {
    container.register("logger", logger, { scope: "singleton" });
  }

  return container;
}

/**
 * 创建 FeatureRegistry，并注入统一的全局 EventBus / Logger / 别名配置。
 *
 * @param {Object} options
 * @param {DependencyContainer} options.container - 应用级依赖容器
 * @param {import('../event/event-bus.js').EventBus} [options.eventBus] - 全局事件总线
 * @param {import('../utils/logger.js').Logger} [options.logger] - 日志记录器
 * @param {Record<string,string>} [options.aliases] - 功能别名映射
 * @returns {FeatureRegistry}
 */
export function createFeatureRegistry({ container, eventBus, logger, aliases } = {}) {
  if (!container) {
    throw new Error("createFeatureRegistry requires a DependencyContainer instance");
  }

  return new FeatureRegistry({
    container,
    globalEventBus: eventBus,
    logger,
    aliases
  });
}

