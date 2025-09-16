/**
 * @file 表格事件处理模块
 * @module TableEventHandlers
 * @description 处理表格事件监听和选择功能
 */

import Logger from '../common/utils/logger.js';

const logger = new Logger('TableEventHandlers');

/**
 * @class TableEventHandlers
 * @description 表格事件处理类，管理事件监听和选择功能
 */
export class TableEventHandlers {
  #tabulator;
  #tableWrapper;
  #localListeners;
  #fallbackMode;
  #fallbackTable;
  #fallbackData;

  /**
   * 创建事件处理实例
   * @param {Object} tabulator - Tabulator实例
   * @param {HTMLElement} tableWrapper - 表格包装器元素
   * @param {Object} localListeners - 本地监听器对象
   * @param {boolean} fallbackMode - 是否处于回退模式
   * @param {HTMLElement} fallbackTable - 回退表格元素
   * @param {Array} fallbackData - 回退模式数据
   */
  constructor(tabulator, tableWrapper, localListeners, fallbackMode, fallbackTable, fallbackData) {
    this.#tabulator = tabulator;
    this.#tableWrapper = tableWrapper;
    this.#localListeners = localListeners;
    this.#fallbackMode = fallbackMode;
    this.#fallbackTable = fallbackTable;
    this.#fallbackData = fallbackData;
  }

  /**
   * 获取当前被选中的行数据
   * @returns {Array<Object>} 被选中的行对象数组
   */
  getSelectedRows() {
    // 回退模式下从 HTML 回退表格获取选中行
    if (this.#fallbackMode) {
      const selectedRows = [];
      if (!this.#fallbackTable) return selectedRows;
      
      const checkboxes = this.#fallbackTable.querySelectorAll('tbody input[type="checkbox"]:checked.pdf-table-row-select, tbody input[type="checkbox"].pdf-table-row-select:checked, tbody input[type="checkbox"]:checked');
      
      checkboxes.forEach(checkbox => {
        const rowIndex = parseInt(checkbox.dataset.rowIndex);
        if (!Number.isNaN(rowIndex) && rowIndex >= 0 && rowIndex < this.#fallbackData.length) {
          selectedRows.push(Object.assign({}, this.#fallbackData[rowIndex]));
        } else {
          // fallback: try to read filename attribute if present
          const filename = checkbox.dataset?.filename || checkbox.getAttribute('data-filename') || checkbox.getAttribute('data-filepath');
          if (filename) selectedRows.push({ filename });
        }
      });
      
      return selectedRows;
    }

    // Tabulator 模式：尝试多种方式取得选中数据
    try {
      if (!this.#tabulator) return [];
      
      // 1) 优先使用 getSelectedData()
      if (typeof this.#tabulator.getSelectedData === 'function') {
        const data = this.#tabulator.getSelectedData();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(d => Object.assign({}, d));
        }
      }
      
      // 2) 某些版本提供 getSelectedRows()
      if (typeof this.#tabulator.getSelectedRows === 'function') {
        const rows = this.#tabulator.getSelectedRows();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map(r => {
            try {
              return (typeof r.getData === 'function') ? Object.assign({}, r.getData()) : Object.assign({}, r);
            } catch (e) {
              return Object.assign({}, r);
            }
          });
        }
      }
      
      // 3) 最后尝试基于 DOM 查找 tabulator 选中行并映射到内部数据
      const domSelected = this.#tableWrapper ? Array.from(this.#tableWrapper.querySelectorAll('.tabulator-row.tabulator-selected')) : [];
      if (domSelected.length > 0) {
        const allData = (this.#tabulator && typeof this.#tabulator.getData === 'function') ? this.#tabulator.getData() : null;
        const selected = [];
        domSelected.forEach(rowEl => {
          const rowId = rowEl.getAttribute('data-row-id') || rowEl.dataset?.rowId || rowEl.dataset?.rowid || null;
          if (rowId && Array.isArray(allData)) {
            const entry = allData.find(p => String(p.id) === String(rowId) || String(p.filename) === String(rowId));
            if (entry) selected.push(Object.assign({}, entry));
          } else {
            // attempt to read a cell with data-row-id or filename
            const cellWithRowId = rowEl.querySelector('[data-row-id], [data-rowid], [data-filename], [data-filepath]');
            if (cellWithRowId) {
              const rid = cellWithRowId.getAttribute('data-row-id') || cellWithRowId.getAttribute('data-rowid') || cellWithRowId.getAttribute('data-filename') || cellWithRowId.getAttribute('data-filepath');
              if (rid) selected.push({ id: rid, filename: rid });
            }
          }
        });
        if (selected.length > 0) return selected;
      }
    } catch (e) {
      logger.warn('getSelectedRows normalization failed', e);
    }
    
    // 没有选中项时返回空数组
    return [];
  }

  /**
   * 绑定事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  on(event, handler) {
    // Register local listener
    if (!this.#localListeners[event]) this.#localListeners[event] = [];
    this.#localListeners[event].push(handler);

    if (this.#fallbackMode) {
      // 回退模式下直接绑定到HTML表格元素
      if (this.#fallbackTable) {
        this.#fallbackTable.addEventListener(event, handler);
      }
      return;
    }

    // Also register with Tabulator if available
    try {
      if (this.#tabulator && typeof this.#tabulator.on === 'function') {
        this.#tabulator.on(event, handler);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * 解除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   */
  off(event, handler) {
    // Remove from local listeners
    if (this.#localListeners[event]) {
      this.#localListeners[event] = this.#localListeners[event].filter(fn => fn !== handler);
    }

    if (this.#fallbackMode) {
      // 回退模式下从HTML表格元素解绑
      if (this.#fallbackTable) {
        this.#fallbackTable.removeEventListener(event, handler);
      }
      return;
    }

    // Also remove from Tabulator if available
    try {
      if (this.#tabulator && typeof this.#tabulator.off === 'function') {
        this.#tabulator.off(event, handler);
      }
    } catch (e) {}
  }

  /**
   * 调用本地监听器
   * @param {string} event - 事件名称
   * @param {any} payload - 事件数据
   * @private
   */
  _callLocalListeners(event, payload) {
    const list = this.#localListeners[event];
    if (Array.isArray(list)) {
      list.slice().forEach(fn => {
        try { fn(payload); } catch (e) { logger.warn(`Listener for ${event} threw`, e); }
      });
    }
  }
}