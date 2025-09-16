/**
 * @file 表格回退模式模块
 * @module TableFallbackMode
 * @description 处理Tabulator失败时的HTML表格回退实现
 */

import Logger from '../common/utils/logger.js';

const logger = new Logger('TableFallbackMode');

/**
 * @class TableFallbackMode
 * @description HTML表格回退模式实现类
 */
export class TableFallbackMode {
  #tableWrapper;
  #options;
  #fallbackTable = null;
  #fallbackData = [];
  #localListeners;

  /**
   * 创建回退模式实例
   * @param {HTMLElement} tableWrapper - 表格包装器元素
   * @param {Object} options - 表格选项
   * @param {Object} localListeners - 本地监听器对象
   */
  constructor(tableWrapper, options, localListeners) {
    this.#tableWrapper = tableWrapper;
    this.#options = options;
    this.#localListeners = localListeners;
  }

  /**
   * 创建回退HTML表格
   */
  createFallbackTable() {
    // 清空现有内容
    while (this.#tableWrapper.firstChild) {
      this.#tableWrapper.removeChild(this.#tableWrapper.firstChild);
    }

    // 创建回退表格
    this.#fallbackTable = document.createElement('table');
    this.#fallbackTable.className = 'pdf-table-fallback';
    this.#fallbackTable.style.width = '100%';
    this.#fallbackTable.style.borderCollapse = 'collapse';
    this.#fallbackTable.style.minHeight = '200px';

    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // 添加选择列
    const selectHeader = document.createElement('th');
    selectHeader.style.width = '40px';
    selectHeader.style.padding = '8px';
    selectHeader.style.border = '1px solid #ddd';
    selectHeader.style.textAlign = 'center';
    selectHeader.innerHTML = '<input type="checkbox" class="pdf-table-select-all">';
    headerRow.appendChild(selectHeader);

    // 添加数据列
    if (this.#options.columns && Array.isArray(this.#options.columns)) {
      this.#options.columns.forEach(column => {
        const th = document.createElement('th');
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.textAlign = 'left';
        th.textContent = column.title || column.field;
        headerRow.appendChild(th);
      });
    }

    thead.appendChild(headerRow);
    this.#fallbackTable.appendChild(thead);

    // 创建表体
    const tbody = document.createElement('tbody');
    this.#fallbackTable.appendChild(tbody);

    // 添加到容器
    this.#tableWrapper.appendChild(this.#fallbackTable);

    // 绑定全选事件
    const selectAllCheckbox = this.#fallbackTable.querySelector('.pdf-table-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = this.#fallbackTable.querySelectorAll('tbody input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        // 触发行选择事件
        this._callLocalListeners('row-selection-changed', this.getSelectedRows());
      });
    }

    logger.info('Fallback table created');
  }

  /**
   * 更新回退表格数据
   * @param {Array} data - 要显示的数据
   */
  updateFallbackTable(data) {
    if (!this.#fallbackTable) return;

    this.#fallbackData = this.#prepareData(data);
    const tbody = this.#fallbackTable.querySelector('tbody');
    
    // 清空现有数据行
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }

    // 如果没有数据，显示空状态
    if (!this.#fallbackData || this.#fallbackData.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = (this.#options.columns ? this.#options.columns.length + 1 : 1);
      emptyCell.style.padding = '24px';
      emptyCell.style.textAlign = 'center';
      emptyCell.style.color = '#666';
      emptyCell.innerHTML = '<div>暂无数据</div>';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    // 添加数据行
    this.#fallbackData.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      tr.dataset.rowIndex = index;

      // 添加选择框
      const selectCell = document.createElement('td');
      selectCell.style.padding = '8px';
      selectCell.style.border = '1px solid #ddd';
      selectCell.style.textAlign = 'center';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'pdf-table-row-select';
      checkbox.dataset.rowIndex = index;
      checkbox.addEventListener('change', () => {
        // 触发行选择事件
        this._callLocalListeners('row-selection-changed', this.getSelectedRows());
      });
      selectCell.appendChild(checkbox);
      tr.appendChild(selectCell);

      // 添加数据列
      if (this.#options.columns && Array.isArray(this.#options.columns)) {
        this.#options.columns.forEach(column => {
          const td = document.createElement('td');
          td.style.padding = '8px';
          td.style.border = '1px solid #ddd';
          td.textContent = row[column.field] || '';
          tr.appendChild(td);
        });
      }

      tbody.appendChild(tr);
    });

    logger.info('Fallback table updated with', this.#fallbackData.length, 'rows');
  }

  /**
   * 获取当前被选中的行数据（回退模式）
   * @returns {Array<Object>} 被选中的行对象数组
   */
  getSelectedRows() {
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

  /**
   * 清空回退表格数据
   */
  clearFallbackTable() {
    this.updateFallbackTable([]);
  }

  /**
   * 销毁回退表格
   */
  destroyFallbackTable() {
    if (this.#fallbackTable) {
      this.#fallbackTable = null;
    }
    this.#fallbackData = [];
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