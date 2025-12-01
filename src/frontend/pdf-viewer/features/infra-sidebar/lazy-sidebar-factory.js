/**
 * @file lazy-sidebar-factory.js
 * @description
 * 为 pdf-viewer 内部的各类侧边栏提供统一的 lazy SidebarConfig 创建函数。
 * 仅组合 createSidebarConfig + container.get(...) + 占位 DOM，
 * 不包含任何业务逻辑，方便在 real-sidebars.js 中复用。
 */

import { createSidebarConfig } from "./sidebar-config.js";
import { getLogger } from "../../../common/utils/logger.js";

const logger = getLogger("LazySidebarFactory");

/**
 * 创建一个懒加载的 SidebarConfig。
 *
 * @param {Object} options
 * @param {string} options.id - sidebar id
 * @param {string} options.title - sidebar 标题
 * @param {string} options.tokenName - 容器中的 service 名称（如 'cardSidebarUI'）
 * @param {Object} options.container - 依赖容器
 * @param {{ defaultWidth:number, minWidth:number, maxWidth:number, resizable?:boolean }} options.width
 * @param {() => HTMLElement} options.placeholderFactory - 当 UI 尚不可用时的占位 DOM 工厂
 * @returns {import("./sidebar-config.js").SidebarConfig}
 */
export function createLazySidebarConfig(options) {
  const {
    id,
    title,
    tokenName,
    container,
    width,
    placeholderFactory
  } = options;

  /** @type {{ getContentElement?: () => HTMLElement } | null} */
  let cachedInstance = null;

  return createSidebarConfig({
    id,
    title,
    contentRenderer: () => {
      if (!cachedInstance && container && typeof container.get === "function") {
        try {
          cachedInstance = container.get(tokenName);
          logger.info(`[LazySidebarFactory] Retrieved ${tokenName} from container`, {
            id,
            found: !!cachedInstance
          });
        } catch (e) {
          logger.warn(
            `[LazySidebarFactory] Failed to get ${tokenName} from container`,
            e
          );
        }
      }

      if (cachedInstance && typeof cachedInstance.getContentElement === "function") {
        try {
          return cachedInstance.getContentElement();
        } catch (e) {
          logger.warn(`[LazySidebarFactory] getContentElement failed for ${tokenName}`, e);
        }
      }

      return placeholderFactory();
    },
    defaultWidth: width.defaultWidth,
    minWidth: width.minWidth,
    maxWidth: width.maxWidth,
    resizable: width.resizable !== false
  });
}

