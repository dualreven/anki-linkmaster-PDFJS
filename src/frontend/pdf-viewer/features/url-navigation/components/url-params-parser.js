/**
 * URL参数解析器
 * @module URLParamsParser
 * @description 负责解析和验证URL查询参数，提取PDF导航相关的参数
 */

import { getLogger } from '../../../../common/utils/logger.js';

/**
 * URL参数解析器类
 * @class URLParamsParser
 */
export class URLParamsParser {
  static #logger = getLogger('URLParamsParser');

  /**
   * 解析URL并提取PDF导航参数
   * @param {string} [url=window.location.href] - 要解析的URL（默认为当前页面URL）
   * @returns {Object} 解析结果
   * @returns {string|null} return.pdfId - PDF文件ID（不含.pdf扩展名）
   * @returns {number|null} return.pageAt - 目标页码（从1开始）
   * @returns {number|null} return.position - 页面内位置百分比（0-100）
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

      // 提取参数
      const pdfId = params.get('pdf-id');
      const title = params.get('title');
      const pageAtStr = params.get('page-at');
      const positionStr = params.get('position');

      // 解析数值参数
      const pageAt = pageAtStr ? parseInt(pageAtStr, 10) : null;
      const position = positionStr ? parseFloat(positionStr) : null;

      const hasParams = pdfId !== null || pageAt !== null || position !== null;

      const result = {
        pdfId,
        title,
        pageAt,
        position,
        hasParams,
      };

      this.#logger.debug('URL参数解析结果:', result);

      return result;
    } catch (error) {
      this.#logger.error('URL解析失败:', error);
      return {
        pdfId: null,
        pageAt: null,
        position: null,
        hasParams: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证解析出的参数是否有效
   * @param {Object} params - 解析出的参数对象
   * @param {string|null} params.pdfId - PDF文件ID
   * @param {number|null} params.pageAt - 目标页码
   * @param {number|null} params.position - 位置百分比
   * @returns {Object} 验证结果
   * @returns {boolean} return.isValid - 参数是否有效
   * @returns {string[]} return.errors - 错误信息数组
   * @returns {string[]} return.warnings - 警告信息数组
   *
   * @example
   * const params = { pdfId: 'sample', pageAt: 5, position: 50 };
   * const validation = URLParamsParser.validate(params);
   * // { isValid: true, errors: [], warnings: [] }
   */
  static validate(params) {
    const errors = [];
    const warnings = [];

    // 验证pdf-id（必填）
    if (!params.pdfId) {
      errors.push('缺少必填参数: pdf-id');
    } else if (typeof params.pdfId !== 'string' || params.pdfId.trim() === '') {
      errors.push('pdf-id 必须是非空字符串');
    } else if (params.pdfId.includes('/') || params.pdfId.includes('\\')) {
      errors.push('pdf-id 不能包含路径分隔符');
    }

    // 验证page-at（可选）
    if (params.pageAt !== null) {
      if (!Number.isInteger(params.pageAt)) {
        errors.push('page-at 必须是整数');
      } else if (params.pageAt < 1) {
        errors.push('page-at 必须大于等于1');
      } else if (params.pageAt > 10000) {
        warnings.push('page-at 超过10000，可能超出PDF总页数');
      }
    }

    // 验证position（可选）
    if (params.position !== null) {
      if (typeof params.position !== 'number' || isNaN(params.position)) {
        errors.push('position 必须是数字');
      } else if (params.position < 0 || params.position > 100) {
        errors.push('position 必须在0-100之间');
      }
    }

    const isValid = errors.length === 0;

    const result = {
      isValid,
      errors,
      warnings,
    };

    if (!isValid) {
      this.#logger.warn('参数验证失败:', result);
    } else if (warnings.length > 0) {
      this.#logger.warn('参数验证警告:', result);
    }

    return result;
  }

  /**
   * 标准化参数值（修正边界情况）
   * @param {Object} params - 解析出的参数对象
   * @param {Object} [options] - 标准化选项
   * @param {number} [options.maxPages=null] - PDF的最大页数（用于限制pageAt）
   * @returns {Object} 标准化后的参数
   *
   * @example
   * const params = { pdfId: 'sample', pageAt: 999, position: 105 };
   * const normalized = URLParamsParser.normalize(params, { maxPages: 10 });
   * // { pdfId: 'sample', pageAt: 10, position: 100 }
   */
  static normalize(params, options = {}) {
    const normalized = { ...params };

    // 标准化pageAt
    if (normalized.pageAt !== null) {
      // 确保至少为1
      if (normalized.pageAt < 1) {
        this.#logger.warn(`pageAt ${normalized.pageAt} < 1, 修正为1`);
        normalized.pageAt = 1;
      }

      // 如果提供了最大页数，限制pageAt
      if (options.maxPages && normalized.pageAt > options.maxPages) {
        this.#logger.warn(`pageAt ${normalized.pageAt} > maxPages ${options.maxPages}, 修正为${options.maxPages}`);
        normalized.pageAt = options.maxPages;
      }
    }

    // 标准化position
    if (normalized.position !== null) {
      if (normalized.position < 0) {
        this.#logger.warn(`position ${normalized.position} < 0, 修正为0`);
        normalized.position = 0;
      } else if (normalized.position > 100) {
        this.#logger.warn(`position ${normalized.position} > 100, 修正为100`);
        normalized.position = 100;
      }
    }

    return normalized;
  }

  /**
   * 构建URL查询字符串
   * @param {Object} params - 参数对象
   * @param {string} params.pdfId - PDF文件ID
   * @param {number} [params.pageAt] - 目标页码
   * @param {number} [params.position] - 位置百分比
   * @returns {string} URL查询字符串（不含?前缀）
   *
   * @example
   * const queryString = URLParamsParser.buildQueryString({
   *   pdfId: 'sample',
   *   pageAt: 5,
   *   position: 50
   * });
   * // 'pdf-id=sample&page-at=5&position=50'
   */
  static buildQueryString(params) {
    const searchParams = new URLSearchParams();

    if (params.pdfId) {
      searchParams.set('pdf-id', params.pdfId);
    }

    if (params.pageAt !== null && params.pageAt !== undefined) {
      searchParams.set('page-at', params.pageAt.toString());
    }

    if (params.position !== null && params.position !== undefined) {
      searchParams.set('position', params.position.toString());
    }

    return searchParams.toString();
  }
}

export default URLParamsParser;
