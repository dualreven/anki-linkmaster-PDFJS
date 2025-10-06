/**
 * @file 表格初始化服务
 * @module TableInitializer
 * @description 处理Tabulator表格的初始化、选项准备和容器管理
 */

import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getLogger } from '../../../../common/utils/logger.js';
const logger = getLogger('PDFList.TableInitializer');


/**
 * 表格初始化服务类
 * @class TableInitializer
 */
export class TableInitializer {
  #container;
  #tableWrapper;
  #options;
  #tabulator;
  #fallbackMode = false;

  /**
   * 构造函数
   * @param {HTMLElement|string} container - 容器元素或选择器
   * @param {Object} options - 配置选项
   */
  constructor(container, options = {}) {
    this.#container = this._resolveContainer(container);
    this.#tableWrapper = this._getOrCreateWrapper();
    this.#options = this._prepareOptions(options);
    this.#tabulator = null;
  }

  /**
   * 解析容器元素
   * @param {HTMLElement|string} container - 容器
   * @returns {HTMLElement} 容器元素
   * @private
   */
  _resolveContainer(container) {
    if (typeof container === 'string') {
      const element = document.querySelector(container);
      if (!element) throw new Error(`Container not found: ${container}`);
      return element;
    } else if (container instanceof HTMLElement) {
      return container;
    } else {
      throw new Error('Container must be a valid DOM element or selector string');
    }
  }

  /**
   * 查找或创建内部 tableWrapper 插槽
   * @returns {HTMLElement} tableWrapper 元素
   * @private
   */
  _getOrCreateWrapper() {
    const existing = this.#container.querySelector('.pdf-table-wrapper');
    if (existing) {
      logger.debug('Using existing table wrapper');
      return existing;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-table-wrapper';
    wrapper.style.minHeight = '200px';
    this.#container.appendChild(wrapper);

    logger.debug('Created new table wrapper');
    return wrapper;
  }

  /**
   * 准备Tabulator配置选项
   * @param {Object} options - 用户提供的选项
   * @returns {Object} 合并后的选项
   * @private
   */
  _prepareOptions(options) {
    const defaultPlaceholder = this._createDefaultPlaceholder();
    const defaultOptions = this._getDefaultOptions(defaultPlaceholder);

    const mergedOptions = Object.assign({}, defaultOptions, options);

    // 注释掉行格式化函数 - 现在使用 rowSelection formatter 列来处理选择
    // if (!mergedOptions.rowFormatter) {
    //   mergedOptions.rowFormatter = this._createRowFormatter();
    // }

    logger.debug('Table options prepared:', Object.keys(mergedOptions));
    return mergedOptions;
  }

  /**
   * 创建默认占位符HTML
   * @returns {string} 占位符HTML
   * @private
   */
  _createDefaultPlaceholder() {
    return `
      <div style="text-align:center;padding:24px;color:#666;">
        <div style="font-size:32px;margin-bottom:8px">📄</div>
        <div>暂无数据</div>
      </div>`;
  }

  /**
   * 获取默认配置选项
   * @param {string} placeholder - 占位符HTML
   * @returns {Object} 默认选项
   * @private
   */
  _getDefaultOptions(placeholder) {
    return {
      height: 'auto',
      layout: 'fitColumns',
      layoutColumnsOnNewData: false,
      placeholder: placeholder,
      // 其他默认选项可以在这里添加
      pagination: false,
      movableColumns: true,
      resizableColumns: true,
    };
  }

  /**
   * 创建行格式化函数
   * @returns {Function} 行格式化函数
   * @private
   */
  _createRowFormatter() {
    return function(row) {
      try {
        const rowEl = row.getElement ? row.getElement() : null;
        if (!rowEl) {
          logger.warn('Row element not available in formatter');
          return;
        }

        const firstCell = rowEl.querySelector('.tabulator-cell');
        if (!firstCell) {
          logger.warn('First cell not found in row formatter');
          return;
        }

        let checkbox = firstCell.querySelector('.pdf-table-row-select');
        if (!checkbox) {
          checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'pdf-table-row-select';

          // 设置数据属性
          const data = (typeof row.getData === 'function') ? row.getData() : null;
          if (data) {
            if (data.id !== undefined) {
              checkbox.dataset.rowId = data.id;
            } else if (data.filename) {
              checkbox.dataset.filename = data.filename;
            }
          }

          // 设置初始选中状态
          try {
            checkbox.checked = checkbox.checked || rowEl.classList.contains('tabulator-selected');
          } catch(e) {
            logger.warn('Error setting checkbox state:', e);
          }

          // 添加变更监听器
          checkbox.addEventListener('change', (e) => {
            try {
              if (e.target.checked) {
                rowEl.classList.add('tabulator-selected');
              } else {
                rowEl.classList.remove('tabulator-selected');
              }
            } catch (err) {
              logger.warn('Error handling checkbox change:', err);
            }
          });

          firstCell.insertBefore(checkbox, firstCell.firstChild);
          logger.debug('Added checkbox to row');
        } else {
          // 更新现有复选框状态
          try {
            checkbox.checked = rowEl.classList.contains('tabulator-selected');
          } catch(e) {
            logger.warn('Error updating checkbox state:', e);
          }
        }
      } catch (e) {
        logger.warn('Row formatter error:', e);
      }
    };
  }

  /**
   * 同步初始化 Tabulator 实例
   * @returns {Tabulator|null} Tabulator实例或null（如果失败）
   */
  initializeSync() {
    try {
      // 检查测试环境
      const isTestEnvironment = typeof global !== 'undefined' && global._forceTabulatorFailure;

      if (isTestEnvironment) {
        throw new Error('Forced Tabulator failure for testing');
      }

      logger.info('Initializing Tabulator instance synchronously...');
      this.#tabulator = new Tabulator(this.#tableWrapper, Object.assign({}, this.#options));

      logger.info('Tabulator initialized successfully');
      this.#fallbackMode = false;

      return this.#tabulator;
    } catch (error) {
      logger.warn('Tabulator initialization failed, enabling fallback mode:', error);
      this.#fallbackMode = true;
      this.#tabulator = null;

      return null;
    }
  }

  /**
   * 异步初始化 Tabulator 实例（保持向后兼容）
   * @returns {Promise<Tabulator|null>} Tabulator实例或null（如果失败）
   */
  async initialize() {
    return this.initializeSync();
  }

  // Getters
  get container() { return this.#container; }
  get tableWrapper() { return this.#tableWrapper; }
  get options() { return this.#options; }
  get tabulator() { return this.#tabulator; }
  get fallbackMode() { return this.#fallbackMode; }

  /**
   * 重新初始化表格
   * @param {Object} newOptions - 新的配置选项
   * @returns {Promise<Tabulator|null>} 新的Tabulator实例
   */
  async reinitialize(newOptions = {}) {
    // 销毁现有实例
    if (this.#tabulator) {
      try {
        this.#tabulator.destroy();
      } catch (e) {
        logger.warn('Error destroying existing tabulator:', e);
      }
    }

    // 重新准备选项
    this.#options = this._prepareOptions(newOptions);

    // 重新初始化
    return await this.initialize();
  }

  /**
   * 检查初始化状态
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.#tabulator !== null || this.#fallbackMode;
  }

  /**
   * 获取初始化状态信息
   * @returns {Object} 状态信息
   */
  getInitializationStatus() {
    return {
      initialized: this.isInitialized(),
      fallbackMode: this.#fallbackMode,
      hasTabulator: this.#tabulator !== null,
      containerElement: this.#container ? this.#container.tagName : null,
      wrapperElement: this.#tableWrapper ? this.#tableWrapper.className : null
    };
  }

  /**
   * 销毁表格实例
   */
  destroy() {
    if (this.#tabulator) {
      try {
        this.#tabulator.destroy();
        logger.info('Tabulator instance destroyed');
      } catch (e) {
        logger.warn('Error destroying tabulator:', e);
      }
      this.#tabulator = null;
    }

    // 清理 wrapper
    if (this.#tableWrapper && this.#tableWrapper.parentElement) {
      this.#tableWrapper.innerHTML = '';
    }

    this.#fallbackMode = false;
  }
}
