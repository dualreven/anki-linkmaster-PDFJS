/**
 * @file 表格工具函数模块
 * @module TableUtils
 * @description 表格相关的工具函数和辅助功能
 */

import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { getLogger } from '../../../../common/utils/logger.js';
const logger = getLogger('PDFList.TableUtils');


/**
 * @namespace TableUtils
 * @description 表格工具函数集合
 */
export class TableUtils {
  /**
   * 运行Tabulator烟雾测试
   * @static
   */
  static runTabulatorSmokeTest() {
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
        logger.debug('Tabulator smoke test - DOM present:', exists);
        try { t.destroy(); } catch (e) {}
        if (container.parentElement) container.parentElement.removeChild(container);
      }, 50);
    } catch (e) {
      logger.warn('Tabulator smoke test failed', e);
    }
  }

  /**
   * 自动运行非破坏性烟雾测试
   * @static
   */
  static autoRunSmokeTest() {
    if (typeof window !== 'undefined') {
      try {
        setTimeout(() => {
          if (!window.__tabulatorSmokeRun) {
            window.__tabulatorSmokeRun = true;
            try { TableUtils.runTabulatorSmokeTest(); } catch (e) { logger.warn('Auto smoke test failed', e); }
          }
        }, 250);
      } catch (e) { logger.warn('Schedule smoke test failed', e); }
    }
  }

  /**
   * 准备数据，进行防御性拷贝
   * @static
   * @param {Array<Object>} data - 原始数据
   * @returns {Array<Object>} 拷贝后的数据
   */
  static prepareData(data) {
    return Array.isArray(data) ? data.map(r => Object.assign({}, r)) : [];
  }

  /**
   * 调用本地监听器
   * @static
   * @param {Object} localListeners - 本地监听器对象
   * @param {string} event - 事件名称
   * @param {any} payload - 事件数据
   */
  static callLocalListeners(localListeners, event, payload) {
    const list = localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try { fn(payload); } catch (e) { logger.warn(`Listener for ${event} threw`, e); }
      });
    }
  }

  /**
   * 确保Tabulator重绘
   * @static
   * @param {Object} tabulator - Tabulator实例
   */
  static ensureTabulatorRedraw(tabulator) {
    if (tabulator && typeof tabulator.redraw === 'function') {
      try { tabulator.redraw(true); } catch (e) { /* ignore */ }
    }
  }

  /**
   * 记录DOM诊断信息
   * @static
   * @param {HTMLElement} tableWrapper - 表格包装器元素
   * @param {Object} tabulator - Tabulator实例
   */
  static logDOMDiagnostics(tableWrapper, tabulator) {
    const childCount = tableWrapper ? tableWrapper.childElementCount : 0;
    const innerLen = tableWrapper && tableWrapper.innerHTML ? tableWrapper.innerHTML.length : 0;

    const wrapperIsTabulator = tableWrapper ?
      tableWrapper.classList && tableWrapper.classList.contains('tabulator') : false;
    const tabEl = tableWrapper ?
      (wrapperIsTabulator ? tableWrapper :
        (tableWrapper.querySelector('.tabulator') || tableWrapper.querySelector('.tabulator-table'))) : null;
    const tabExists = !!tabEl;

    let rectInfo = 'null';
    if (tableWrapper && typeof tableWrapper.getBoundingClientRect === 'function') {
      const r = tableWrapper.getBoundingClientRect();
      rectInfo = `${Math.round(r.width)}x${Math.round(r.height)}`;
    }

    logger.info(`TableWrapper DOM after setData: childCount=${childCount}, innerHTMLLen=${innerLen}, tableWrapper.className=${tableWrapper ? tableWrapper.className : 'null'}, tabExists=${tabExists}, rect=${rectInfo}`);
  }

  /**
   * 处理缺失的DOM元素
   * @static
   * @param {HTMLElement} tableWrapper - 表格包装器元素
   * @param {Object} tabulator - Tabulator实例
   */
  static handleMissingDOMElements(tableWrapper, tabulator) {
    const wrapperIsTabulator = tableWrapper ?
      tableWrapper.classList && tableWrapper.classList.contains('tabulator') : false;
    const tabEl = tableWrapper ?
      (wrapperIsTabulator ? tableWrapper :
        (tableWrapper.querySelector('.tabulator') || tableWrapper.querySelector('.tabulator-table'))) : null;
    const tabExists = !!tabEl;

    if (!tabExists) {
      try {
        if (tableWrapper) tableWrapper.style.height = tableWrapper.style.height || '300px';
        if (tabulator && typeof tabulator.redraw === 'function') tabulator.redraw(true);
        const tabEl2 = tableWrapper.classList && tableWrapper.classList.contains('tabulator') ?
          tableWrapper : (tableWrapper.querySelector('.tabulator') || tableWrapper.querySelector('.tabulator-table'));
        logger.info('Fallback attempt after forcing height, tabExistsNow=' + !!tabEl2 + ', tableWrapper.className=' + (tableWrapper ? tableWrapper.className : 'null'));
      } catch (e) { logger.warn('Fallback redraw failed', e); }
    }
  }

  /**
   * 记录计算样式信息
   * @static
   * @param {HTMLElement} container - 容器元素
   * @param {HTMLElement} tableWrapper - 表格包装器元素
   */
  static logComputedStyles(container, tableWrapper) {
    try {
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        const cs = (el) => window.getComputedStyle(el);
        const contStyles = cs(container);
        const wrapStyles = cs(tableWrapper);
        logger.info(`Computed styles - container: display=${contStyles.display}, height=${contStyles.height}, overflow=${contStyles.overflow}`);
        logger.info(`Computed styles - wrapper: display=${wrapStyles.display}, height=${wrapStyles.height}, overflow=${wrapStyles.overflow}`);

        let p = container;
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
   * @static
   * @param {Object} tabulator - Tabulator实例
   */
  static logTabulatorInstanceInfo(tabulator) {
    try {
      const keys = Object.keys(tabulator || {}).slice(0, 40);
      logger.info('Tabulator instance keys (sample):', keys);

      try {
        const tEl = (tabulator && (tabulator.element || tabulator.table || tabulator.tableElement)) || null;
        logger.info('Tabulator DOM reference present:', !!tEl);

        let tdataLen = 'n/a';
        try {
          tdataLen = (tabulator && typeof tabulator.getData === 'function') ?
            (Array.isArray(tabulator.getData()) ? tabulator.getData().length : 'non-array') : 'no-getData';
        } catch (e) { tdataLen = 'getData-error'; }
        logger.info('Tabulator internal data length:', tdataLen);

        let colsCount = 'n/a';
        try {
          colsCount = (tabulator && typeof tabulator.getColumns === 'function') ?
            (tabulator.getColumns().length) : 'no-getColumns';
        } catch (e) { colsCount = 'getColumns-error'; }
        logger.info('Tabulator columns count:', colsCount);
      } catch (e) { logger.warn('Tabulator deeper introspect failed', e); }
    } catch (e) { logger.warn('Tabulator introspect failed', e); }
  }

  /**
   * 验证 Tabulator 实例
   * @static
   * @param {Object} tabulator - Tabulator实例
   * @returns {boolean} 是否有效
   */
  static validateTabulatorInstance(tabulator) {
    if (!tabulator) {
      logger.warn('Tabulator instance is null or undefined');
      return false;
    }

    const requiredMethods = ['setData', 'getData', 'redraw', 'destroy'];
    const missingMethods = requiredMethods.filter(method => typeof tabulator[method] !== 'function');

    if (missingMethods.length > 0) {
      logger.warn('Tabulator instance missing required methods:', missingMethods);
      return false;
    }

    return true;
  }
}

// 自动运行烟雾测试
TableUtils.autoRunSmokeTest();
