/**
 * @file 表格封装核心模块
 * @module TableWrapperCore
 * @description TableWrapper的核心功能，包括基础表格封装和初始化
 */

import { Tabulator } from 'tabulator-tables';
import { getLogger } from '../common/utils/logger.js';
import { TableUtils } from './table-utils.js';

const logger = getLogger('TableWrapperCore');

/**
 * @class TableWrapperCore
 * @description 表格封装核心类，处理基础表格功能和初始化
 */
export class TableWrapperCore {
  #container;
  #tableWrapper;
  #options;
  #tabulator;
  #localListeners;
  #fallbackMode = false;
  #fallbackTable = null;
  #fallbackData = [];

  // Expose read-only accessors for integration code
  get tabulator() { return this.#tabulator; }
  get tableWrapper() { return this.#tableWrapper; }
  get container() { return this.#container; }
  get fallbackMode() { return this.#fallbackMode; }
  get options() { return this.#options; }
  get localListeners() { return this.#localListeners; }
  get fallbackData() { return this.#fallbackData; }

  /**
   * 创建 TableWrapper 实例
   * @param {HTMLElement|string} container - 容器元素或选择器字符串
   * @param {Object} [options] - Tabulator配置选项
   */
  constructor(container, options = {}) {
    if (typeof container === 'string') {
      this.#container = document.querySelector(container);
    } else {
      this.#container = container;
    }

    if (!this.#container) throw new Error('Container not found');

    this.#tableWrapper = this._getOrCreateWrapper();
    this.#options = this.#prepareOptions(options);
    this.#tabulator = null;
    this.#localListeners = Object.create(null);
    this._init();
  }

  /**
   * 准备Tabulator配置选项
   * @param {Object} options - 用户提供的选项
   * @returns {Object} 合并后的选项
   * @private
   */
  #prepareOptions(options) {
    const defaultPlaceholder = `
      <div style="text-align:center;padding:24px;color:#666;">
        <div style="font-size:32px;margin-bottom:8px">📄</div>
        <div>暂无数据</div>
      </div>`;

    return Object.assign({
      height: 'auto',
      layout: 'fitColumns',
      selectable: true,
      selectableRangeMode: "click",
      selectableRollingSelection: false,
      layoutColumnsOnNewData: false,
      placeholder: defaultPlaceholder,
      rowFormatter: this.#createRowFormatter()
    }, options);
  }

  /**
   * 创建行格式化函数
   * @returns {Function} 行格式化函数
   * @private
   */
  #createRowFormatter() {
    return function(row) {
      try {
        const rowEl = row.getElement ? row.getElement() : null;
        if (!rowEl) return;
        
        const firstCell = rowEl.querySelector('.tabulator-cell');
        if (!firstCell) return;
        
        let cb = firstCell.querySelector('.pdf-table-row-select');
        if (!cb) {
          cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'pdf-table-row-select';
          
          const data = (typeof row.getData === 'function') ? row.getData() : null;
          if (data) {
            if (data.id !== undefined) cb.dataset.rowId = data.id;
            else if (data.filename) cb.dataset.filename = data.filename;
          }
          
          try { cb.checked = cb.checked || rowEl.classList.contains('tabulator-selected'); } catch(e) {}
          
          cb.addEventListener('change', (e) => {
            try {
              if (e.target.checked) rowEl.classList.add('tabulator-selected');
              else rowEl.classList.remove('tabulator-selected');
            } catch (err) { /* ignore */ }
          });
          
          firstCell.insertBefore(cb, firstCell.firstChild);
        } else {
          try { cb.checked = rowEl.classList.contains('tabulator-selected'); } catch(e) {}
        }
      } catch (e) {
        // silently ignore rowFormatter errors
      }
    };
  }

  /**
   * 查找或创建内部 tableWrapper 插槽
   * @returns {HTMLElement} tableWrapper 元素
   * @private
   */
  _getOrCreateWrapper() {
    const existing = this.#container.querySelector('.pdf-table-wrapper');
    if (existing) return existing;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-table-wrapper';
    wrapper.style.minHeight = '200px';
    this.#container.appendChild(wrapper);
    return wrapper;
  }

  /**
   * 初始化 Tabulator 实例
   * @private
   */
  _init() {
    try {
      const isTestEnvironment = typeof global !== 'undefined' && global._forceTabulatorFailure;
      
      if (isTestEnvironment) {
        throw new Error('Forced Tabulator failure for testing');
      }
      
      this.#tabulator = new Tabulator(this.#tableWrapper, Object.assign({}, this.#options));
      logger.info('Tabulator initialized');
      this.#fallbackMode = false;
    } catch (error) {
      logger.warn('Tabulator initialization failed, falling back to HTML table:', error);
      this.#fallbackMode = true;
      this.#tabulator = null;
    }
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 要渲染的行对象数组
   * @returns {Promise|void}
   */
  setData(data) {
    const rows = TableUtils.prepareData(data);

    if (this.#fallbackMode) {
      this._callLocalListeners('data-loaded', rows);
      return Promise.resolve();
    }

    // 确保渲染器已准备就绪
    return this.#ensureRendererReady()
      .then(() => {
        const result = this.#tabulator.setData(rows);

        return Promise.resolve(result)
          .then(() => this.#handleDataLoaded(rows))
          .catch(err => this.#handleSetDataError(err, rows));
      })
      .catch(err => {
        logger.warn('Failed to ensure renderer ready, using fallback:', err);
        this.#handleSetDataError(err, rows);
        return Promise.resolve();
      });
  }

  /**
   * 确保渲染器已准备就绪
   * @returns {Promise} 解析后渲染器就绪的Promise
   * @private
   */
  #ensureRendererReady() {
    return new Promise((resolve, reject) => {
      // 检查 Tabulator 实例是否存在
      if (!this.#tabulator) {
        reject(new Error('Tabulator instance not available'));
        return;
      }

      // 检查渲染器是否已经就绪
      const checkRenderer = () => {
        try {
          // 尝试访问渲染器的关键属性
          const renderer = this.#tabulator.renderer;
          if (renderer && renderer.verticalFillMode !== undefined) {
            logger.debug('Renderer is ready');
            resolve();
            return true;
          }
        } catch (e) {
          // 渲染器还没有准备好
        }
        return false;
      };

      // 立即检查一次
      if (checkRenderer()) {
        return;
      }

      // 如果渲染器还没准备好，等待一小段时间再检查
      let attempts = 0;
      const maxAttempts = 10;
      const checkInterval = 50; // ms

      const intervalId = setInterval(() => {
        attempts++;

        if (checkRenderer()) {
          clearInterval(intervalId);
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          logger.warn(`Renderer not ready after ${maxAttempts} attempts, proceeding anyway`);
          resolve(); // 仍然继续，但有警告
        }
      }, checkInterval);
    });
  }


  /**
   * 处理数据加载完成后的逻辑
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  #handleDataLoaded(rows) {
    logger.debug('setData count=', rows.length);
    this._callLocalListeners('data-loaded', rows);

    try {
      TableUtils.ensureTabulatorRedraw(this.#tabulator);
      TableUtils.logDOMDiagnostics(this.#tableWrapper, this.#tabulator);
      TableUtils.handleMissingDOMElements(this.#tableWrapper, this.#tabulator);
      TableUtils.logComputedStyles(this.#container, this.#tableWrapper);
      TableUtils.logTabulatorInstanceInfo(this.#tabulator);
    } catch (e) {
      logger.warn('Error inspecting tableWrapper DOM', e);
    }
  }

  /**
   * 处理设置数据错误
   * @param {Error} err - 错误对象
   * @param {Array<Object>} rows - 数据行
   * @private
   */
  #handleSetDataError(err, rows) {
    logger.warn('Tabulator setData failed', err);
    this._callLocalListeners('data-loaded', rows);
  }


  /**
   * 清空表格数据
   * @returns {void}
   */
  clear() {
    if (this.#fallbackMode) {
      return;
    }

    this.#tabulator.clearData();
  }

  /**
   * 销毁 Tabulator 实例
   * @returns {void}
   */
  destroy() {
    if (this.#tabulator) {
      this.#tabulator.destroy();
      this.#tabulator = null;
    }
    
    this.#fallbackData = [];
    
    // keep wrapper element to avoid detaching container
    while (this.#tableWrapper.firstChild) this.#tableWrapper.removeChild(this.#tableWrapper.firstChild);
  }

  /**
   * 调用本地监听器
   * @param {string} event - 事件名称
   * @param {any} payload - 事件数据
   * @protected
   */
  _callLocalListeners(event, payload) {
    const list = this.#localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try { fn(payload); } catch (e) { logger.warn(`Listener for ${event} threw`, e); }
      });
    }
  }

  /**
   * 兼容性API：loadData
   * @param {Array<Object>} data - 数据
   * @returns {Promise} Promise对象
   */
  loadData(data) {
    return Promise.resolve(this.setData(data));
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   */
  displayEmptyState(message) {
    if (this.#fallbackMode) {
      return;
    }

    try {
      this.#tabulator.clearData();
    } catch (e) {
      logger.warn('Failed to clear data for empty state', e);
    }
  }
}