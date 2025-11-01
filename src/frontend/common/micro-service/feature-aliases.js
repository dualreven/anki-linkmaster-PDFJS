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
  // 示例（Step 2 开始按需启用）：
  // "annotation": "pdf-annotation",
  // "pdf-outline": "pdf-outline", // 自映射通常不需要；仅示例
};

export default FEATURE_ALIASES;

