/**
 * URL参数解析器
 * @module URLParamsParser
 * @description 负责解析和验证URL查询参数，提取PDF导航相关的参数
 */

import { getLogger } from "../../../../common/utils/logger.js";

/**
 * URL参数解析器类
 * @class URLParamsParser
 */
export class URLParamsParser {
  static #logger = getLogger("URLParamsParser");

  /**
   * 解析URL并提取PDF导航参数
   * @param {string} [url=window.location.href] - 要解析的URL（默认为当前页面URL）
   * @returns {Object} 解析结果
   * @returns {string|null} return.pdfId - PDF文件ID（不含.pdf扩展名）
   * @returns {number|null} return.pageAt - 目标页码（从1开始）
   * @returns {number|null} return.position - 页面内位置百分比（0-100）
   * @returns {string|null} return.anchorId - 锚点ID（12位十六进制）
   * @returns {string|null} return.annotationId - 标注ID（字符串）
   * @returns {boolean} return.hasParams - 是否存在任何导航参数
   *
   * @example
   * // 解析包含完整参数的URL
   * const result = URLParamsParser.parse('http://localhost:3000/?pdf-id=sample&page-at=5&position=50');
   * // { pdfId: 'sample', pageAt: 5, position: 50, hasParams: true }
   *
   * @example
   * // 解析只有pdf-id的URL
   * const result = URLParamsParser.parse('http://localhost:3000/?pdf-id=document');
   * // { pdfId: 'document', pageAt: null, position: null, hasParams: true }
   */
  static parse(url = window.location.href) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // 提取参数（只保留必要的加载参数，移除所有导航参数）
      const pdfId = params.get("pdf-id");
      const title = params.get("title");

      const hasParams = pdfId !== null || title !== null;

      const result = {
        pdfId,
        title,
        hasParams,
      };

      this.#logger.debug("URL参数解析结果:", result);
      this.#logger.info(`[URLParamsParser] 解析结果: pdfId=${result.pdfId}, hasParams=${result.hasParams}`, { toast: { type: "info", ms: 3000 } });

      return result;
    } catch (error) {
      this.#logger.error("URL解析失败:", error, { toast: { type: "error", ms: 3000 } });
      return {
        pdfId: null,
        title: null,
        hasParams: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证解析出的参数是否有效
   * @param {Object} params - 解析出的参数对象
   * @param {string|null} params.pdfId - PDF文件ID
   * @returns {Object} 验证结果
   * @returns {boolean} return.isValid - 参数是否有效
   * @returns {string[]} return.errors - 错误信息数组
   * @returns {string[]} return.warnings - 警告信息数组
   *
   * @example
   * const params = { pdfId: 'sample' };
   * const validation = URLParamsParser.validate(params);
   * // { isValid: true, errors: [], warnings: [] }
   */
  static validate(params) {
    const errors = [];
    const warnings = [];

    // 验证pdf-id（可选，如果提供则需符合格式）
    if (params.pdfId) {
      if (typeof params.pdfId !== "string" || params.pdfId.trim() === "") {
        errors.push("pdf-id 必须是非空字符串");
      } else if (params.pdfId.includes("/") || params.pdfId.includes("\\")) {
        errors.push("pdf-id 不能包含路径分隔符");
      }
    }

    const isValid = errors.length === 0;

    const result = {
      isValid,
      errors,
      warnings,
    };

    if (!isValid) {
      this.#logger.warn("参数验证失败:", result, { toast: { type: "error", ms: 3000 } });
    } else if (warnings.length > 0) {
      this.#logger.warn("参数验证警告:", result, { toast: { type: "warn", ms: 3000 } });
    }

    return result;
  }

  /**
   * 标准化参数值（修正边界情况）
   * @param {Object} params - 解析出的参数对象
   * @returns {Object} 标准化后的参数
   *
   * @example
   * const params = { pdfId: 'sample' };
   * const normalized = URLParamsParser.normalize(params);
   * // { pdfId: 'sample' }
   */
  static normalize(params) {
    // 当前只有 pdfId 和 title，无需额外标准化
    return { ...params };
  }

  /**
   * 构建URL查询字符串
   * @param {Object} params - 参数对象
   * @param {string} [params.pdfId] - PDF文件ID
   * @param {string} [params.title] - PDF标题
   * @returns {string} URL查询字符串（不含?前缀）
   *
   * @example
   * const queryString = URLParamsParser.buildQueryString({ pdfId: 'sample' });
   * // 'pdf-id=sample'
   */
  static buildQueryString(params) {
    const searchParams = new URLSearchParams();

    if (params.pdfId) {
      searchParams.set("pdf-id", params.pdfId);
    }

    if (params.title) {
      searchParams.set("title", params.title);
    }

    return searchParams.toString();
  }
}

export default URLParamsParser;
