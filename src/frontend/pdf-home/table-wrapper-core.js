/**
 * @file 表格封装核心模块
 * @module TableWrapperCore
 * @description TableWrapper的核心功能，包括基础表格封装和初始化
 */

import { Tabulator } from 'tabulator-tables';
import Logger from '../common/utils/logger.js';

const logger = new Logger('TableWrapperCore');

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
    const rows = this.#prepareData(data);
    
    if (this.#fallbackMode) {
      this._callLocalListeners('data-loaded', rows);
      return Promise.resolve();
    }

    const result = this.#tabulator.setData(rows);
    
    Promise.resolve(result)
      .then(() => this.#handleDataLoaded(rows))
      .catch(err => this.#handleSetDataError(err, rows));
      
    return result;
  }

  /**
   * 准备数据，进行防御性拷贝
   * @param {Array<Object>} data - 原始数据
   * @returns {Array<Object>} 拷贝后的数据
   * @private
   */
  #prepareData(data) {
    return Array.isArray(data) ? data.map(r => Object.assign({}, r)) : [];
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
      this.#ensureTabulatorRedraw();
      this.#logDOMDiagnostics();
      this.#handleMissingDOMElements();
      this.#logComputedStyles();
      this.#logTabulatorInstanceInfo();
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
   * 确保Tabulator重绘
   * @private
   */
  #ensureTabulatorRedraw() {
    if (this.#tabulator && typeof this.#tabulator.redraw === 'function') {
      try { this.#tabulator.redraw(true); } catch (e) { /* ignore */ }
    }
  }

  /**
   * 记录DOM诊断信息
   * @private
   */
  #logDOMDiagnostics() {
    const childCount = this.#tableWrapper ? this.#tableWrapper.childElementCount : 0;
    const innerLen = this.#tableWrapper && this.#tableWrapper.innerHTML ? this.#tableWrapper.innerHTML.length : 0;
    
    const wrapperIsTabulator = this.#tableWrapper ?
      this.#tableWrapper.classList && this.#tableWrapper.classList.contains('tabulator') : false;
    const tabEl = this.#tableWrapper ?
      (wrapperIsTabulator ? this.#tableWrapper :
        (this.#tableWrapper.querySelector('.tabulator') || this.#tableWrapper.querySelector('.tabulator-table'))) : null;
    const tabExists = !!tabEl;
    
    let rectInfo = 'null';
    if (this.#tableWrapper && typeof this.#tableWrapper.getBoundingClientRect === 'function') {
      const r = this.#tableWrapper.getBoundingClientRect();
      rectInfo = `${Math.round(r.width)}x${Math.round(r.height)}`;
    }
    
    logger.info(`TableWrapper DOM after setData: childCount=${childCount}, innerHTMLLen=${innerLen}, tableWrapper.className=${this.#tableWrapper ? this.#tableWrapper.className : 'null'}, tabExists=${tabExists}, rect=${rectInfo}`);
  }

  /**
   * 处理缺失的DOM元素
   * @private
   */
  #handleMissingDOMElements() {
    const wrapperIsTabulator = this.#tableWrapper ?
      this.#tableWrapper.classList && this.#tableWrapper.classList.contains('tabulator') : false;
    const tabEl = this.#tableWrapper ?
      (wrapperIsTabulator ? this.#tableWrapper :
        (this.#tableWrapper.querySelector('.tabulator') || this.#tableWrapper.querySelector('.tabulator-table'))) : null;
    const tabExists = !!tabEl;

    if (!tabExists) {
      try {
        if (this.#tableWrapper) this.#tableWrapper.style.height = this.#tableWrapper.style.height || '300px';
        if (this.#tabulator && typeof this.#tabulator.redraw === 'function') this.#tabulator.redraw(true);
        const tabEl2 = this.#tableWrapper.classList && this.#tableWrapper.classList.contains('tabulator') ?
          this.#tableWrapper : (this.#tableWrapper.querySelector('.tabulator') || this.#tableWrapper.querySelector('.tabulator-table'));
        logger.info('Fallback attempt after forcing height, tabExistsNow=' + !!tabEl2 + ', tableWrapper.className=' + (this.#tableWrapper ? this.#tableWrapper.className : 'null'));
      } catch (e) { logger.warn('Fallback redraw failed', e); }
    }
  }

  /**
   * 记录计算样式信息
   * @private
   */
  #logComputedStyles() {
    try {
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        const cs = (el) => window.getComputedStyle(el);
        const contStyles = cs(this.#container);
        const wrapStyles = cs(this.#tableWrapper);
        logger.info(`Computed styles - container: display=${contStyles.display}, height=${contStyles.height}, overflow=${contStyles.overflow}`);
        logger.info(`Computed styles - wrapper: display=${wrapStyles.display}, height=${wrapStyles.height}, overflow=${wrapStyles.overflow}`);
        
        let p = this.#container;
        let depth = 0;
        while (p && p !== document.body && depth < 6) {
          try {
            const s = cs(p);
            logger.debug(`ancestor:${p.tagName}.${p.className || ''} display=${s.display} height=${s.height}`);
          } catch (e) {}
          p = p.parentElement; depth++;
        }
      }
    } catch (e) { logger.warn('Computed style diagnostics failed', e); }
  }

  /**
   * 记录Tabulator实例信息
   * @private
   */
  #logTabulatorInstanceInfo() {
    try {
      const keys = Object.keys(this.#tabulator || {}).slice(0, 40);
      logger.info('Tabulator instance keys (sample):', keys);

      try {
        const tEl = (this.#tabulator && (this.#tabulator.element || this.#tabulator.table || this.#tabulator.tableElement)) || null;
        logger.info('Tabulator DOM reference present:', !!tEl);
        
        let tdataLen = 'n/a';
        try {
          tdataLen = (this.#tabulator && typeof this.#tabulator.getData === 'function') ?
            (Array.isArray(this.#tabulator.getData()) ? this.#tabulator.getData().length : 'non-array') : 'no-getData';
        } catch (e) { tdataLen = 'getData-error'; }
        logger.info('Tabulator internal data length:', tdataLen);
        
        let colsCount = 'n/a';
        try {
          colsCount = (this.#tabulator && typeof this.#tabulator.getColumns === 'function') ?
            (this.#tabulator.getColumns().length) : 'no-getColumns';
        } catch (e) { colsCount = 'getColumns-error'; }
        logger.info('Tabulator columns count:', colsCount);
      } catch (e) { logger.warn('Tabulator deeper introspect failed', e); }
    } catch (e) { logger.warn('Tabulator introspect failed', e); }
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