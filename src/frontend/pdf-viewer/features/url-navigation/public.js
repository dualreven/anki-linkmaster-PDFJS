/**
 * url-navigation 公共导出入口
 * - 供其他 features 使用的稳定 API，避免跨特性直接依赖内部实现文件
 * - 内部仍复用 URLParamsParser 实现
 */

import { URLParamsParser } from "./components/url-params-parser.js";

/**
 * 解析 URL 参数
 * @param {string} [url] - 可选，默认读取 window.location.href
 * @returns {{
 *   pdfId: string|null,
 *   title?: string|null,
 *   pageAt: number|null,
 *   position: number|null,
 *   anchorId: string|null,
 *   annotationId: string|null,
 *   outlineItemId: string|null,
 *   hasParams: boolean
 * }}
 */
export function parseUrlParams(url) {
  return URLParamsParser.parse(url);
}

/**
 * 校验 URL 参数载荷
 * @param {object} params
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
export function validateUrlParams(params) {
  return URLParamsParser.validate(params);
}

export default {
  parseUrlParams,
  validateUrlParams,
};

