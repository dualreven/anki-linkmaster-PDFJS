/**
 * @file Feature 别名映射（过渡期）
 * @description
 * - 用于在“特性重命名”过渡期，兼容旧名称（old）到新名称（canonical）。
 * - 本文件应仅导出常量对象，供各处创建 FeatureRegistry 时注入。
 * - Step 1 阶段默认导出空映射，保证零行为变更；Step 2 再逐步填充。
 *
 * 使用方式：
 *   import { FEATURE_ALIASES } from "./feature-aliases.js";
 *   const registry = new FeatureRegistry({ container, globalEventBus, aliases: FEATURE_ALIASES });
 */

/**
 * @type {Record<string, string>}
 */
export const FEATURE_ALIASES = {
  // Step 2（基础设施侧首批改名）
  "app-core": "infra-app",
  "core-navigation": "infra-nav-core",
  "ui-manager": "infra-ui",
  "sidebar-manager": "infra-sidebar",
  "websocket-adapter": "infra-ws-adapter",
  // Step 2（功能域统一命名 - 先加别名，再逐步切换依赖与断言）
  "annotation": "pdf-annotation",
  "search": "pdf-search",
  "text-selection-quick-actions": "pdf-quick-actions",
  // Step 3（功能域命名统一 - AI 助手）
  "ai-assistant": "pdf-ai-assistant",
};

export default FEATURE_ALIASES;

