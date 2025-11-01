/**
 * search-result-item/public.js
 * 统一公共入口：对外仅从本文件导出能力，禁止跨特性引用内部 components/*
 */
import { ResultItemRenderer } from "./components/result-item-renderer.js";

/**
 * 工厂：创建条目渲染器
 * @param {import('../../../common/utils/logger.js').Logger|null} logger
 * @param {Object} [options]
 * @returns {ResultItemRenderer}
 */
export function createResultItemRenderer(logger, options = {}) {
  return new ResultItemRenderer(logger, options);
}

export { ResultItemRenderer };

