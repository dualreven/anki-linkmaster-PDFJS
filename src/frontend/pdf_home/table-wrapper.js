/**
 * @file 表格封装主模块
 * @module TableWrapper
 * @description 表格封装主文件，基于TableWrapperCore的简化封装
 */

import { getLogger } from '../common/utils/logger.js';
import { TableWrapperCore } from './table-wrapper-core.js';
import { TableUtils } from './table-utils.js';

const logger = getLogger('TableWrapper');

/**
 * @class TableWrapper
 * @description 表格封装主类，基于TableWrapperCore的简化封装
 */
export class TableWrapper extends TableWrapperCore {
  /**
   * 创建 TableWrapper 实例
   * @param {HTMLElement|string} container - 容器元素或选择器字符串
   * @param {Object} [options] - Tabulator配置选项
   */
  constructor(container, options = {}) {
    super(container, options);
    logger.debug('TableWrapper initialized');
  }
}

// 导出工具函数
export { TableUtils };

// 保持向后兼容性
export function runTabulatorSmokeTest() {
  return TableUtils.runTabulatorSmokeTest();
}