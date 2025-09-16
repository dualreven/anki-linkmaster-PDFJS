// table-wrapper.js
// Tabulator-based table wrapper for pdf-home (native JS integration)

// ==================== 修改开始 ====================
// 1. 从主包导入 Tabulator 核心类
// import { Tabulator } from 'tabulator-tables';
 import { Tabulator } from 'tabulator-tables';
// 2. 从各自的独立路径中，逐一导入所有需要的模块
// ==================== 修改结束 ====================

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
  #container;
  #tableWrapper;
  #options;
  #tabulator;
  #localListeners;
  #fallbackMode = false; // 新增：回退模式标志
  #fallbackTable = null; // 新增：回退表格元素
  #fallbackData = []; // 新增：回退模式下的数据存储

  // Expose read-only accessors for integration code that expects public properties
  // e.g. other modules check `pdfTable.tableWrapper` or `pdfTable.tabulator`
  get tabulator() { return this.#tabulator; }
  get tableWrapper() { return this.#tableWrapper; }
  get container() { return this.#container; }
  get fallbackMode() { return this.#fallbackMode; } // 新增：暴露回退模式状态

  /**
   * 创建 TableWrapper 实例并在 container 内准备 tableWrapper 插槽。
   * @param {HTMLElement|string} container - 容器元素或选择器字符串（外壳，不能被清空）
   * @param {Object} [options] - 传递给 Tabulator 的配置项（会与默认项合并）
   */
  constructor(container, options = {}) {
    if (typeof container === 'string') {
      this.#container = document.querySelector(container);
    } else {
      this.#container = container;
    }

    if (!this.#container) throw new Error('Container not found');

    this.#tableWrapper = this._getOrCreateWrapper();
// 准备一个优雅的HTML字符串作为placeholder
    const defaultPlaceholder = `
      <div style="text-align:center;padding:24px;color:#666;">
        <div style="font-size:32px;margin-bottom:8px">📄</div>
        <div>暂无数据</div>
      </div>`;

    this.#options = Object.assign({
      // avoid forcing 100% height which can collapse if parent has no explicit height
      height: 'auto',
      layout: 'fitColumns',
      selectable: true,           // 启用多选模式
      selectableRangeMode: "click", // 点击选择模式
      selectableRollingSelection: false, // 禁用滚动选择
      layoutColumnsOnNewData: false,
      placeholder: defaultPlaceholder,
      /**
       * 兼容性增强：若 Tabulator 没有内置的 rowSelection formatter（不同打包/版本可能缺少 SelectRowModule），
       * 我们通过 rowFormatter 注入一个简易的 checkbox 到每一行的第一个单元格，class 为 pdf-table-row-select。
       * 这样可以在不依赖额外模块的情况下，保证多选交互的可见性与可用性。
       */
      rowFormatter: function(row) {
        try {
          const rowEl = row.getElement ? row.getElement() : null;
          if (!rowEl) return;
          // 找到第一个单元格（Tabulator 渲染后第一个 .tabulator-cell）
          const firstCell = rowEl.querySelector('.tabulator-cell');
          if (!firstCell) return;
          // 避免重复插入
          let cb = firstCell.querySelector('.pdf-table-row-select');
          if (!cb) {
            cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'pdf-table-row-select';
            // 尽量设置数据标识，便于回退检测读取
            const data = (typeof row.getData === 'function') ? row.getData() : null;
            if (data) {
              if (data.id !== undefined) cb.dataset.rowId = data.id;
              else if (data.filename) cb.dataset.filename = data.filename;
            }
            // 反映行选择状态
            // 不再依赖 Tabulator 的 isSelected（某些构建未包含选择模块）
            try { cb.checked = cb.checked || rowEl.classList.contains('tabulator-selected'); } catch(e) {}
            // 当 checkbox 改变时，切换 Tabulator 行的选择状态（若 RowComponent 可用）
            cb.addEventListener('change', (e) => {
              try {
                // 不再依赖 row.select/deselect，统一使用 DOM class 维护回退选择态
                if (e.target.checked) rowEl.classList.add('tabulator-selected');
                else rowEl.classList.remove('tabulator-selected');
              } catch (err) { /* ignore */ }
            });
            // 将 checkbox 插入到单元格最前面
            firstCell.insertBefore(cb, firstCell.firstChild);
          } else {
            // 同步选中状态
            // 同步为基于 DOM 的选中状态
            try { cb.checked = rowEl.classList.contains('tabulator-selected'); } catch(e) {}
          }
        } catch (e) {
          // silently ignore rowFormatter errors to avoid breaking rendering
        }
      }
    }, options);
    console.log('TableWrapper options:', JSON.stringify(this.#options));
    this.#tabulator = null;
    // local event listeners for wrapper-level events (data-loaded, etc.)
    this.#localListeners = Object.create(null);
    this._init();
  }

  /**
   * 查找或创建内部 tableWrapper 插槽。
   * 如果容器中已有 .pdf-table-wrapper，则复用；否则创建一个新的并附加到 container 中。
   * @returns {HTMLElement} tableWrapper 元素
   */
  _getOrCreateWrapper() {
    const existing = this.#container.querySelector('.pdf-table-wrapper');
    if (existing) return existing;
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-table-wrapper';
    // ensure wrapper has a minimum height so Tabulator can render
    wrapper.style.minHeight = '200px';
    this.#container.appendChild(wrapper);
    return wrapper;
  }

  /**
   * 初始化 Tabulator 实例并挂载到 tableWrapper 上。
   * 仅在构造时调用一次，且不得在每次渲染时重复创建实例。
   * @private
   */
  _init() {
    try {
      // 检查是否在测试环境中，并且是否有模拟的Tabulator失败
      const isTestEnvironment = typeof global !== 'undefined' && global._forceTabulatorFailure;
      
      if (isTestEnvironment) {
        throw new Error('Forced Tabulator failure for testing');
      }
      
      // Initialize Tabulator instance inside tableWrapper
      // Tabulator.registerModule([
      //   FormatModule,
      //   SelectRowModule,
      //   SortModule,
      //   ResizeTableModule
      // ]);
      this.#tabulator = new Tabulator(this.#tableWrapper, Object.assign({}, this.#options));
      logger.info('Tabulator initialized');
      this.#fallbackMode = false;
    } catch (error) {
      logger.warn('Tabulator initialization failed, falling back to HTML table:', error);
      this.#fallbackMode = true;
      this.#tabulator = null;
      this._createFallbackTable();
    }
  }

  /**
   * 创建回退HTML表格
   * @private
   */
  _createFallbackTable() {
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
   * @private
   */
  _updateFallbackTable(data) {
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
   * 设置表格数据（防御性拷贝）。
   * @param {Array<Object>} data - 要渲染的行对象数组，方法内部会拷贝每个对象以防外部修改影响内部状态。
   * @returns {void}
   */
  setData(data) {
    if (this.#fallbackMode) {
      // 回退模式下使用HTML表格
      this._updateFallbackTable(data);
      this._callLocalListeners('data-loaded', this.#prepareData(data));
      return Promise.resolve();
    }

    // 正常模式下使用Tabulator
    const rows = this.#prepareData(data);
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
   */
  #prepareData(data) {
    return Array.isArray(data) ? data.map(r => Object.assign({}, r)) : [];
  }

  /**
   * 处理数据加载完成后的逻辑
   * @param {Array<Object>} rows - 数据行
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
   */
  #handleSetDataError(err, rows) {
    logger.warn('Tabulator setData failed', err);
    this._callLocalListeners('data-loaded', rows);
  }

  /**
   * 确保Tabulator重绘
   */
  #ensureTabulatorRedraw() {
    if (this.#tabulator && typeof this.#tabulator.redraw === 'function') {
      try { this.#tabulator.redraw(true); } catch (e) { /* ignore */ }
    }
  }

  /**
   * 记录DOM诊断信息
   */
  #logDOMDiagnostics() {
    const childCount = this.#tableWrapper ? this.#tableWrapper.childElementCount : 0;
    const innerLen = this.#tableWrapper && this.#tableWrapper.innerHTML ? this.#tableWrapper.innerHTML.length : 0;
    
    // Detect Tabulator element: it may be the wrapper itself (Tabulator adds classes to the container)
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
   */
  #handleMissingDOMElements() {
    const wrapperIsTabulator = this.#tableWrapper ?
      this.#tableWrapper.classList && this.#tableWrapper.classList.contains('tabulator') : false;
    const tabEl = this.#tableWrapper ?
      (wrapperIsTabulator ? this.#tableWrapper :
        (this.#tableWrapper.querySelector('.tabulator') || this.#tableWrapper.querySelector('.tabulator-table'))) : null;
    const tabExists = !!tabEl;

    // If Tabulator did not create DOM (neither wrapper nor child), try forcing a height and redraw as fallback
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
   */
  #logTabulatorInstanceInfo() {
    try {
      const keys = Object.keys(this.#tabulator || {}).slice(0, 40);
      logger.info('Tabulator instance keys (sample):', keys);

      // Deeper introspection: DOM refs, internal data and columns
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
   * 获取当前被选中的行数据（统一返回 plain object 数组）。
   * 为了兼容不同版本/环境下 Tabulator 的差异（有时返回 RowComponent，有时返回 plain data），
   * 此方法会尽可能正规化输出为前端期待的 plain object 列表：[{id, filename, ...}, ...]
   * @returns {Array<Object>} 被选中的行对象数组（防御性拷贝）
   */
  getSelectedRows() {
    // 回退模式下从 HTML 回退表格获取选中行（类名为 pdf-table-row-select）
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
 
    // Tabulator 模式：尝试多种方式取得选中数据，最终正规化为 plain object 数组
    try {
      if (!this.#tabulator) return [];
      // 1) 优先使用 getSelectedData() -> 通常返回 plain object 列表
      if (typeof this.#tabulator.getSelectedData === 'function') {
        const data = this.#tabulator.getSelectedData();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(d => Object.assign({}, d));
        }
      }
      // 2) 某些版本提供 getSelectedRows() 返回 RowComponent 列表
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
      // 3) 最后尝试基于 DOM 查找 tabulator 选中行并映射到内部数据（依赖 table 的 data 能被读取）
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
   * 清空表格数据（保留 tableWrapper DOM 结构以避免破坏宿主容器）。
   * @returns {void}
   */
  clear() {
    if (this.#fallbackMode) {
      // 回退模式下清空HTML表格
      this._updateFallbackTable([]);
      return;
    }

    // 正常模式下使用Tabulator
    this.#tabulator.clearData();
  }

  /**
   * 销毁 Tabulator 实例并清空内部内容，但不移除 tableWrapper 元素本身（避免破坏宿主容器结构）。
   * @returns {void}
   */
  destroy() {
    if (this.#tabulator) {
      this.#tabulator.destroy();
      this.#tabulator = null;
    }
    
    // 销毁回退表格
    if (this.#fallbackTable) {
      this.#fallbackTable = null;
    }
    
    this.#fallbackData = [];
    
    // keep wrapper element to avoid detaching container
    while (this.#tableWrapper.firstChild) this.#tableWrapper.removeChild(this.#tableWrapper.firstChild);
  }

  // Additional helpers

  _callLocalListeners(event, payload) {
    const list = this.#localListeners[event];
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
    if (this.#fallbackMode) {
      // 回退模式下显示空状态
      this._updateFallbackTable([]);
      return;
    }

    // 清空数据，让Tabulator显示其内置的placeholder
    try {
      this.#tabulator.clearData();

      // 如果需要动态修改placeholder内容
      if (message) {
        const customPlaceholder = `
          <div style="text-align:center;padding:24px;color:#666;">
            <div style="font-size:32px;margin-bottom:8px">⏳</div>
            <div>${message}</div>
          </div>`;
        // Tabulator没有直接更新placeholder的API，但我们可以通过清空并重新设置数据来触发
        // 或者，更简单的方式是直接操作placeholder元素（如果能找到它）
        // 最安全的方式还是在初始化时就设置好。
        // 这里我们只做清空数据操作，让默认的placeholder显示出来。
      }

    } catch (e) {
      logger.warn('Failed to clear data for empty state', e);
    }
  }

  // Additional helpers
  /**
   * 绑定 Tabulator 事件代理，封装对外订阅接口。
   * @param {string} event - Tabulator 事件名
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

    // Also register with Tabulator if available (for Tabulator-specific events)
    try {
      if (this.#tabulator && typeof this.#tabulator.on === 'function') {
        this.#tabulator.on(event, handler);
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
