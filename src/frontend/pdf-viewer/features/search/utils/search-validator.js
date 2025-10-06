/**
 * 搜索输入验证工具
 * @file features/search/utils/search-validator.js
 * @description 提供搜索输入的验证和清理功能
 */

import { getLogger } from '../../../../common/utils/logger.js';
const logger = getLogger('SearchValidator');


/**
 * 验证搜索关键词是否有效
 * @param {string} query - 搜索关键词
 * @returns {Object} 验证结果
 * @returns {boolean} result.valid - 是否有效
 * @returns {string} result.error - 错误信息（如果无效）
 * @returns {string} result.cleaned - 清理后的关键词
 *
 * @example
 * const result = validateSearchQuery('  test  ');
 * // { valid: true, error: null, cleaned: 'test' }
 */
export function validateSearchQuery(query) {
  // 检查是否为空
  if (!query || typeof query !== 'string') {
    return {
      valid: false,
      error: '搜索关键词不能为空',
      cleaned: '',
    };
  }

  // 清理空白字符
  const cleaned = query.trim();

  // 检查清理后是否为空
  if (cleaned.length === 0) {
    return {
      valid: false,
      error: '搜索关键词不能为空',
      cleaned: '',
    };
  }

  // 检查最小长度（至少1个字符）
  if (cleaned.length < 1) {
    return {
      valid: false,
      error: '搜索关键词至少需要1个字符',
      cleaned,
    };
  }

  // 检查最大长度（防止过长查询）
  if (cleaned.length > 1000) {
    return {
      valid: false,
      error: '搜索关键词过长（最多1000个字符）',
      cleaned: cleaned.substring(0, 1000),
    };
  }

  return {
    valid: true,
    error: null,
    cleaned,
  };
}

/**
 * 验证正则表达式是否有效
 * @param {string} pattern - 正则表达式模式
 * @returns {Object} 验证结果
 * @returns {boolean} result.valid - 是否有效
 * @returns {string} result.error - 错误信息（如果无效）
 * @returns {RegExp} result.regex - 正则表达式对象（如果有效）
 *
 * @example
 * const result = validateRegex('\\d+');
 * // { valid: true, error: null, regex: /\d+/ }
 */
export function validateRegex(pattern) {
  try {
    const regex = new RegExp(pattern);
    return {
      valid: true,
      error: null,
      regex,
    };
  } catch (error) {
    logger.warn('Invalid regex pattern:', error.message);
    return {
      valid: false,
      error: `无效的正则表达式: ${error.message}`,
      regex: null,
    };
  }
}

/**
 * 清理并转义特殊字符（用于非正则搜索）
 * @param {string} text - 要清理的文本
 * @returns {string} 清理后的文本
 *
 * @example
 * const escaped = escapeRegexChars('hello (world)');
 * // 'hello \\(world\\)'
 */
export function escapeRegexChars(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查搜索选项是否有效
 * @param {import('../../../types/events').SearchOptions} options - 搜索选项
 * @returns {Object} 验证结果
 * @returns {boolean} result.valid - 是否有效
 * @returns {string} result.error - 错误信息（如果无效）
 * @returns {import('../../../types/events').SearchOptions} result.cleaned - 清理后的选项
 */
export function validateSearchOptions(options) {
  const cleaned = {
    caseSensitive: false,
    wholeWords: false,
    highlightAll: true,
    useRegex: false,
  };

  if (!options || typeof options !== 'object') {
    logger.warn('Invalid search options, using defaults');
    return {
      valid: true,
      error: null,
      cleaned,
    };
  }

  // 验证并清理各个选项
  if (typeof options.caseSensitive === 'boolean') {
    cleaned.caseSensitive = options.caseSensitive;
  }

  if (typeof options.wholeWords === 'boolean') {
    cleaned.wholeWords = options.wholeWords;
  }

  if (typeof options.highlightAll === 'boolean') {
    cleaned.highlightAll = options.highlightAll;
  }

  if (typeof options.useRegex === 'boolean') {
    cleaned.useRegex = options.useRegex;
  }

  return {
    valid: true,
    error: null,
    cleaned,
  };
}

/**
 * 检查搜索是否过于宽泛（可能导致性能问题）
 * @param {string} query - 搜索关键词
 * @param {number} totalPages - PDF总页数
 * @returns {Object} 检查结果
 * @returns {boolean} result.isTooGeneral - 是否过于宽泛
 * @returns {string} result.warning - 警告信息
 */
export function checkSearchGenerality(query, totalPages = 100) {
  const cleaned = query.trim();

  // 非常短的查询（1-2个字符）在大文档中可能匹配太多
  if (cleaned.length <= 2 && totalPages > 50) {
    return {
      isTooGeneral: true,
      warning: `关键词 "${cleaned}" 过短，可能匹配大量结果，建议使用更具体的关键词`,
    };
  }

  // 常见的单字符或双字符（在大文档中匹配太多）
  const commonChars = ['a', 'e', 'i', 'o', 'u', 'the', 'and', 'or', 'in', 'on', 'at'];
  if (commonChars.includes(cleaned.toLowerCase()) && totalPages > 50) {
    return {
      isTooGeneral: true,
      warning: `关键词 "${cleaned}" 是常见词汇，可能匹配大量结果`,
    };
  }

  return {
    isTooGeneral: false,
    warning: null,
  };
}
