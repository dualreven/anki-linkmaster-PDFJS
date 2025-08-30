// table-wrapper.js
// Tabulator-based table wrapper for pdf-home (native JS integration)

import { Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import Logger from '../common/utils/logger.js';

const logger = new Logger('TableWrapper');

/**
 * TableWrapper - 基于 Tabulator 的表格封装
 *
 * 说明：
 * - 该类封装了 Tabulator 实例并提供一组被 pdf-home 使用的简洁 API。
 * - 遵循项目约定：不直接清空宿主 container，仅在内部的 tableWrapper 插槽中更新内容；事件与 DOM 操作应在初始化时注册一次。
 *
 * @example
 * const wrapper = new TableWrapper(document.querySelector('#pdf-table-container'), { columns: [...] });
 * wrapper.setData(pdfs);
 *
 */
export default class TableWrapper {
  /**
   * 创建 TableWrapper 实例并在 container 内准备 tableWrapper 插槽。
   * @param {HTMLElement|string} container - 容器元素或选择器字符串（外壳，不能被清空）
   * @param {Object} [options] - 传递给 Tabulator 的配置项（会与默认项合并）
   */
  constructor(container, options = {}) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) throw new Error('Container not found');

    this.tableWrapper = this._getOrCreateWrapper();

    this.options = Object.assign({
      // avoid forcing 100% height which can collapse if parent has no explicit height
      height: 'auto',
      layout: 'fitColumns',
      selectable: true,
      layoutColumnsOnNewData: false,
    }, options);

    this.tabulator = null;
    // local event listeners for wrapper-level events (data-loaded, etc.)
    this._localListeners = Object.create(null);
    this._init();
  }

  /**
   * 查找或创建内部 tableWrapper 插槽。
   * 如果容器中已有 .pdf-table-wrapper，则复用；否则创建一个新的并附加到 container 中。
   * @returns {HTMLElement} tableWrapper 元素
   */
  _getOrCreateWrapper() {
    const existing = this.container.querySelector('.pdf-table-wrapper');
    if (existing) return existing;
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-table-wrapper';
    // ensure wrapper has a minimum height so Tabulator can render
    wrapper.style.minHeight = '200px';
    this.container.appendChild(wrapper);
    return wrapper;
  }

  /**
   * 初始化 Tabulator 实例并挂载到 tableWrapper 上。
   * 仅在构造时调用一次，且不得在每次渲染时重复创建实例。
   * @private
   */
  _init() {
    // Initialize Tabulator instance inside tableWrapper
    this.tabulator = new Tabulator(this.tableWrapper, Object.assign({}, this.options));
    logger.info('Tabulator initialized');
  }

  /**
   * 设置表格数据（防御性拷贝）。
   * @param {Array<Object>} data - 要渲染的行对象数组，方法内部会拷贝每个对象以防外部修改影响内部状态。
   * @returns {void}
   */
  setData(data) {
    // Defensive copy
    const rows = Array.isArray(data) ? data.map(r => Object.assign({}, r)) : [];
    const result = this.tabulator.setData(rows);
    // Notify local listeners after data is set. Tabulator may return a Promise.
    Promise.resolve(result).then(() => {
      logger.debug('setData count=', rows.length);
      this._callLocalListeners('data-loaded', rows);
      try {
        // ensure tabulator redraw
        if (this.tabulator && typeof this.tabulator.redraw === 'function') {
          try { this.tabulator.redraw(true); } catch (e) { /* ignore */ }
        }

        const childCount = this.tableWrapper ? this.tableWrapper.childElementCount : 0;
        const innerLen = this.tableWrapper && this.tableWrapper.innerHTML ? this.tableWrapper.innerHTML.length : 0;
        // Detect Tabulator element: it may be the wrapper itself (Tabulator adds classes to the container)
        const wrapperIsTabulator = this.tableWrapper ? this.tableWrapper.classList && this.tableWrapper.classList.contains('tabulator') : false;
        const tabEl = this.tableWrapper ? (wrapperIsTabulator ? this.tableWrapper : (this.tableWrapper.querySelector('.tabulator') || this.tableWrapper.querySelector('.tabulator-table'))) : null;
        const tabExists = !!tabEl;
        let rectInfo = 'null';
        if (this.tableWrapper && typeof this.tableWrapper.getBoundingClientRect === 'function') {
          const r = this.tableWrapper.getBoundingClientRect();
          rectInfo = `${Math.round(r.width)}x${Math.round(r.height)}`;
        }
        logger.info(`TableWrapper DOM after setData: childCount=${childCount}, innerHTMLLen=${innerLen}, tableWrapper.className=${this.tableWrapper ? this.tableWrapper.className : 'null'}, tabExists=${tabExists}, rect=${rectInfo}`);

        // If Tabulator did not create DOM (neither wrapper nor child), try forcing a height and redraw as fallback
        if (!tabExists) {
          try {
            if (this.tableWrapper) this.tableWrapper.style.height = this.tableWrapper.style.height || '300px';
            if (this.tabulator && typeof this.tabulator.redraw === 'function') this.tabulator.redraw(true);
            const tabEl2 = this.tableWrapper.classList && this.tableWrapper.classList.contains('tabulator') ? this.tableWrapper : (this.tableWrapper.querySelector('.tabulator') || this.tableWrapper.querySelector('.tabulator-table'));
            logger.info('Fallback attempt after forcing height, tabExistsNow=' + !!tabEl2 + ', tableWrapper.className=' + (this.tableWrapper ? this.tableWrapper.className : 'null'));
          } catch (e) { logger.warn('Fallback redraw failed', e); }
        }

        // Additional diagnostics: computed styles and Tabulator instance keys
        try {
          if (typeof window !== 'undefined' && window.getComputedStyle) {
            const cs = (el) => window.getComputedStyle(el);
            const contStyles = cs(this.container);
            const wrapStyles = cs(this.tableWrapper);
            logger.info(`Computed styles - container: display=${contStyles.display}, height=${contStyles.height}, overflow=${contStyles.overflow}`);
            logger.info(`Computed styles - wrapper: display=${wrapStyles.display}, height=${wrapStyles.height}, overflow=${wrapStyles.overflow}`);
            let p = this.container;
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

        try {
          const keys = Object.keys(this.tabulator || {}).slice(0, 40);
          logger.info('Tabulator instance keys (sample):', keys);

          // Deeper introspection: DOM refs, internal data and columns
          try {
            const tEl = (this.tabulator && (this.tabulator.element || this.tabulator.table || this.tabulator.tableElement)) || null;
            logger.info('Tabulator DOM reference present:', !!tEl);
            let tdataLen = 'n/a';
            try { tdataLen = (this.tabulator && typeof this.tabulator.getData === 'function') ? (Array.isArray(this.tabulator.getData()) ? this.tabulator.getData().length : 'non-array') : 'no-getData'; } catch (e) { tdataLen = 'getData-error'; }
            logger.info('Tabulator internal data length:', tdataLen);
            let colsCount = 'n/a';
            try { colsCount = (this.tabulator && typeof this.tabulator.getColumns === 'function') ? (this.tabulator.getColumns().length) : 'no-getColumns'; } catch (e) { colsCount = 'getColumns-error'; }
            logger.info('Tabulator columns count:', colsCount);
          } catch (e) { logger.warn('Tabulator deeper introspect failed', e); }

        } catch (e) { logger.warn('Tabulator introspect failed', e); }
      } catch (e) {
        logger.warn('Error inspecting tableWrapper DOM', e);
      }
    }).catch(err => {
      logger.warn('Tabulator setData failed', err);
      this._callLocalListeners('data-loaded', rows);
    });
    return result;
  }

  /**
   * 获取当前被选中的行数据（由 Tabulator 管理）。
   * @returns {Array<Object>} 被选中的行对象数组
   */
  getSelectedRows() {
    return this.tabulator.getSelectedData() || [];
  }

  /**
   * 清空表格数据（保留 tableWrapper DOM 结构以避免破坏宿主容器）。
   * @returns {void}
   */
  clear() {
    this.tabulator.clearData();
  }

  /**
   * 销毁 Tabulator 实例并清空内部内容，但不移除 tableWrapper 元素本身（避免破坏宿主容器结构）。
   * @returns {void}
   */
  destroy() {
    if (this.tabulator) {
      this.tabulator.destroy();
      this.tabulator = null;
    }
    // keep wrapper element to avoid detaching container
    while (this.tableWrapper.firstChild) this.tableWrapper.removeChild(this.tableWrapper.firstChild);
  }

  // Additional helpers

  _callLocalListeners(event, payload) {
    const list = this._localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try { fn(payload); } catch (e) { logger.warn(`Listener for ${event} threw`, e); }
      });
    }
  }

  /**
   * Backwards-compatible loadData API
   */
  loadData(data) {
    return Promise.resolve(this.setData(data));
  }

  /**
   * Render a simple empty state inside the tableWrapper (does not remove the wrapper element)
   */
  displayEmptyState(message) {
    // Clear Tabulator data and show a small placeholder
    try { this.tabulator.clearData(); } catch (e) {}
    while (this.tableWrapper.firstChild) this.tableWrapper.removeChild(this.tableWrapper.firstChild);
    const empty = document.createElement('div');
    empty.className = 'pdf-table-empty-state';
    empty.innerHTML = `\n      <div style=\"text-align:center;padding:24px;color:#666;\">\n        <div style=\"font-size:32px;margin-bottom:8px\">📄</div>\n        <div>${message || '暂无数据'}</div>\n      </div>`;
    this.tableWrapper.appendChild(empty);
    this._callLocalListeners('data-loaded', []);
  }

  // Additional helpers
  /**
   * 绑定 Tabulator 事件代理，封装对外订阅接口。
   * @param {string} event - Tabulator 事件名
   * @param {Function} handler - 事件处理函数
   */
  on(event, handler) {
    // Register local listener
    if (!this._localListeners[event]) this._localListeners[event] = [];
    this._localListeners[event].push(handler);

    // Also register with Tabulator if available (for Tabulator-specific events)
    try {
      if (this.tabulator && typeof this.tabulator.on === 'function') {
        this.tabulator.on(event, handler);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 解除绑定 Tabulator 事件代理。
   * @param {string} event - Tabulator 事件名
   * @param {Function} handler - 事件处理函数
   */
  off(event, handler) {
    // Remove from local listeners
    if (this._localListeners[event]) {
      this._localListeners[event] = this._localListeners[event].filter(fn => fn !== handler);
    }

    // Also remove from Tabulator if available
    try {
      if (this.tabulator && typeof this.tabulator.off === 'function') {
        this.tabulator.off(event, handler);
      }
    } catch (e) {}
  }

}

export function runTabulatorSmokeTest() {
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '10px';
    container.style.bottom = '10px';
    container.style.width = '320px';
    container.style.height = '200px';
    container.style.zIndex = '9999';
    container.style.background = 'white';
    container.className = 'tabulator-smoke-container';
    document.body.appendChild(container);

    const t = new Tabulator(container, {
      height: '100%',
      layout: 'fitColumns',
      columns: [{ title: 'A', field: 'a' }],
      data: [{ a: 'test' }]
    });

    // allow microtask for Tabulator to render
    setTimeout(() => {
      const exists = !!(container.querySelector('.tabulator') || container.querySelector('.tabulator-table'));
      console.info('[TableWrapper][SmokeTest] Tabulator DOM present:', exists);
      try { t.destroy(); } catch (e) {}
      if (container.parentElement) container.parentElement.removeChild(container);
    }, 50);
  } catch (e) {
    console.warn('[TableWrapper][SmokeTest] failed', e);
  }
}

// Auto-run the non-destructive smoke test once on page load to verify Tabulator runtime
if (typeof window !== 'undefined') {
  try {
    setTimeout(() => {
      if (!window.__tabulatorSmokeRun) {
        window.__tabulatorSmokeRun = true;
        try { runTabulatorSmokeTest(); } catch (e) { console.warn('[TableWrapper] auto smoke test failed', e); }
      }
    }, 250);
  } catch (e) { console.warn('[TableWrapper] schedule smoke test failed', e); }
}
