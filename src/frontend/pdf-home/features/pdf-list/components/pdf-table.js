/**
 * @file PDF列表组件（原生HTML实现）
 * @module PDFList
 * @description PDF列表显示组件，使用原生HTML表格实现，不依赖第三方表格库
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { DOMUtils } from "../../../../common/utils/dom-utils.js";
import { PDF_LIST_EVENTS } from "../events.js";
import { PDF_MANAGEMENT_EVENTS } from "../../../../common/event/event-constants.js";

const logger = getLogger("PDFList.PDFList");

/**
 * PDF列表组件类
 * @class PDFList
 */
export class PDFList {
  #container;
  #state;
  #eventBus;
  #domEventUnsubscribers = [];
  #currentData = [];
  #tableElement;
  #tbodyElement;

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {HTMLElement|string} options.container - 容器元素或选择器
   * @param {Object} options.state - StateManager状态
   * @param {Object} options.eventBus - ScopedEventBus实例
   */
  constructor({ container, state, eventBus }) {
    this.#container = this._resolveContainer(container);
    this.#state = state;
    this.#eventBus = eventBus;

    logger.info("Initializing PDFList component");
    this._createTableStructure();
    this._setupDOMEvents();
    logger.info("PDFList component initialized successfully");
  }

  /**
   * 解析容器元素
   * @param {HTMLElement|string} container - 容器
   * @returns {HTMLElement} 容器元素
   * @private
   */
  _resolveContainer(container) {
    if (typeof container === "string") {
      const element = document.querySelector(container);
      if (!element) {
        throw new Error(`Container not found: ${container}`);
      }
      return element;
    } else if (container instanceof HTMLElement) {
      return container;
    } else {
      throw new Error("Container must be a valid DOM element or selector string");
    }
  }

  /**
   * 创建表格结构
   * @private
   */
  _createTableStructure() {
    this.#container.innerHTML = `
      <div class="pdf-list-container">
        <table class="pdf-list-table">
          <thead>
            <tr>
              <th class="col-select">
                <input type="checkbox" id="select-all-checkbox" title="全选/取消全选">
              </th>
              <th class="col-filename">文件名</th>
              <th class="col-path">路径</th>
              <th class="col-size">大小</th>
              <th class="col-modified">最后修改</th>
              <th class="col-tags">标签</th>
              <th class="col-rating">评分</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <!-- 数据行将动态插入这里 -->
          </tbody>
        </table>
        <div class="pdf-list-empty-state" style="display: none;">
          <div class="empty-icon">📄</div>
          <div class="empty-message">暂无PDF文件</div>
          <div class="empty-hint">请添加PDF文件到列表中</div>
        </div>
      </div>
    `;

    this.#tableElement = this.#container.querySelector('.pdf-list-table');
    this.#tbodyElement = this.#container.querySelector('.pdf-list-table tbody');
  }

  /**
   * 设置DOM事件监听器
   * @private
   */
  _setupDOMEvents() {
    try {
      // 处理表格点击事件
      const handleTableClick = async (event) => {
        const row = event.target.closest('tr');
        if (!row || row.tagName !== 'TR' || row.parentElement.tagName !== 'TBODY') {
          return;
        }

        const rowIndex = Array.from(this.#tbodyElement.children).indexOf(row);
        const rowData = this.#currentData[rowIndex];
        if (!rowData) return;

        // 处理checkbox点击
        if (event.target.type === 'checkbox') {
          this._handleSelectionChange(rowIndex, event.target.checked);
          return;
        }

        // 处理按钮点击
        const button = event.target.closest('button');
        if (button) {
          const action = button.getAttribute('data-action');
          event.preventDefault();
          event.stopPropagation();

          switch (action) {
            case 'open':
              this._handleOpenAction(rowData);
              break;
            case 'delete':
              await this._handleDeleteAction(rowData);
              break;
          }
          return;
        }

        // 处理行双击
        if (event.detail === 2) {
          this._handleRowDoubleClick(rowData, rowIndex);
          return;
        }

        // 处理行单击
        this._handleRowClick(rowData, rowIndex, event);
      };

      // 处理键盘快捷键
      const handleKeyDown = (event) => {
        this._handleKeyboardShortcuts(event);
      };

      // 处理全选checkbox
      const handleSelectAll = (event) => {
        this._handleSelectAll(event.target.checked);
      };

      // 绑定事件
      DOMUtils.addEventListener(this.#tableElement, "click", handleTableClick);
      this.#domEventUnsubscribers.push(() =>
        DOMUtils.removeEventListener(this.#tableElement, "click", handleTableClick)
      );

      const selectAllCheckbox = this.#container.querySelector('#select-all-checkbox');
      if (selectAllCheckbox) {
        DOMUtils.addEventListener(selectAllCheckbox, "change", handleSelectAll);
        this.#domEventUnsubscribers.push(() =>
          DOMUtils.removeEventListener(selectAllCheckbox, "change", handleSelectAll)
        );
      }

      DOMUtils.addEventListener(document, "keydown", handleKeyDown);
      this.#domEventUnsubscribers.push(() =>
        DOMUtils.removeEventListener(document, "keydown", handleKeyDown)
      );

      logger.debug("DOM event listeners set up");

    } catch (error) {
      logger.warn("Error setting up DOM events:", error);
    }
  }

  /**
   * 处理行点击
   * @param {Object} rowData - 行数据
   * @param {number} rowIndex - 行索引
   * @param {Event} event - 点击事件
   * @private
   */
  _handleRowClick(rowData, rowIndex, event) {
    // 发出行点击事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.ROW_CLICKED, {
      index: rowIndex,
      row: rowData,
      nativeEvent: {
        type: event.type,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      },
      timestamp: Date.now()
    });

    // 处理选中逻辑
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: 切换选中
      this._toggleSelection(rowIndex);
    } else if (event.shiftKey) {
      // Shift+Click: 范围选择
      this._rangeSelect(rowIndex);
    } else {
      // 普通点击: 仅设置聚焦
      this._setFocusOnly(rowIndex);
    }

    logger.debug("Row clicked:", rowData.filename || rowData.id);
  }

  /**
   * 处理行双击
   * @param {Object} rowData - 行数据
   * @param {number} rowIndex - 行索引
   * @private
   */
  _handleRowDoubleClick(rowData, rowIndex) {
    this.#eventBus?.emit(PDF_LIST_EVENTS.ROW_DOUBLE_CLICKED, {
      index: rowIndex,
      row: rowData,
      timestamp: Date.now()
    });

    // 触发PDF打开请求
    this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.filename || rowData.path, {
      actorId: "PDFList"
    });

    logger.debug("Row double-clicked, opening PDF:", rowData.filename || rowData.id);
  }

  /**
   * 处理选择变化
   * @param {number} rowIndex - 行索引
   * @param {boolean} selected - 是否选中
   * @private
   */
  _handleSelectionChange(rowIndex, selected) {
    if (!this.#state) return;

    let selectedIndices = [...(this.#state.selectedIndices || [])];

    if (selected) {
      if (!selectedIndices.includes(rowIndex)) {
        selectedIndices.push(rowIndex);
      }
    } else {
      selectedIndices = selectedIndices.filter(i => i !== rowIndex);
    }

    this.#state.selectedIndices = selectedIndices;
    this._updateSelectAllCheckbox();

    // 发出选择变化事件
    const selectedItems = selectedIndices.map(i => this.#currentData[i]);
    this.#eventBus?.emit(PDF_LIST_EVENTS.SELECTION_CHANGED, {
      selectedIndices,
      selectedItems,
      count: selectedIndices.length,
      timestamp: Date.now()
    });
  }

  /**
   * 处理全选
   * @param {boolean} selected - 是否全选
   * @private
   */
  _handleSelectAll(selected) {
    if (!this.#state) return;

    const allIndices = selected ? Array.from({ length: this.#currentData.length }, (_, i) => i) : [];
    this.#state.selectedIndices = allIndices;

    // 更新所有行的checkbox状态
    const checkboxes = this.#tbodyElement.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = selected;
    });

    // 发出选择变化事件
    const selectedItems = allIndices.map(i => this.#currentData[i]);
    this.#eventBus?.emit(PDF_LIST_EVENTS.SELECTION_CHANGED, {
      selectedIndices: allIndices,
      selectedItems,
      count: allIndices.length,
      timestamp: Date.now()
    });

    logger.info(`${selected ? 'Selected all' : 'Deselected all'} ${this.#currentData.length} rows`);
  }

  /**
   * 切换选中状态
   * @param {number} rowIndex - 行索引
   * @private
   */
  _toggleSelection(rowIndex) {
    const checkbox = this.#tbodyElement.children[rowIndex]?.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      this._handleSelectionChange(rowIndex, checkbox.checked);
    }
  }

  /**
   * 范围选择
   * @param {number} endIndex - 结束索引
   * @private
   */
  _rangeSelect(endIndex) {
    if (!this.#state) return;

    const focusedIndex = this.#state.focusedIndex;
    if (focusedIndex === null || focusedIndex === undefined) {
      this._toggleSelection(endIndex);
      return;
    }

    const startIndex = Math.min(focusedIndex, endIndex);
    const end = Math.max(focusedIndex, endIndex);

    for (let i = startIndex; i <= end; i++) {
      const checkbox = this.#tbodyElement.children[i]?.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
      }
    }

    // 更新状态
    const newSelected = Array.from({ length: end - startIndex + 1 }, (_, i) => startIndex + i);
    const existingSelected = this.#state.selectedIndices || [];
    const mergedSelected = [...new Set([...existingSelected, ...newSelected])];
    this.#state.selectedIndices = mergedSelected;
    this._updateSelectAllCheckbox();

    // 发出选择变化事件
    const selectedItems = mergedSelected.map(i => this.#currentData[i]);
    this.#eventBus?.emit(PDF_LIST_EVENTS.SELECTION_CHANGED, {
      selectedIndices: mergedSelected,
      selectedItems,
      count: mergedSelected.length,
      timestamp: Date.now()
    });
  }

  /**
   * 仅设置聚焦
   * @param {number} index - 行索引
   * @private
   */
  _setFocusOnly(index) {
    if (!this.#state) return;

    // 清除所有聚焦样式
    this._clearFocusStyles();

    // 设置当前聚焦
    if (index >= 0 && index < this.#currentData.length) {
      const row = this.#tbodyElement.children[index];
      if (row) {
        row.classList.add('row-focused');
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      this.#state.focusedIndex = index;
    }

    // 发出聚焦变化事件
    this.#eventBus?.emit(PDF_LIST_EVENTS.FOCUS_CHANGED, {
      focusedIndex: index,
      timestamp: Date.now()
    });
  }

  /**
   * 清除聚焦样式
   * @private
   */
  _clearFocusStyles() {
    const rows = this.#tbodyElement.querySelectorAll('tr');
    rows.forEach(row => row.classList.remove('row-focused'));
  }

  /**
   * 更新全选checkbox状态
   * @private
   */
  _updateSelectAllCheckbox() {
    const selectAllCheckbox = this.#container.querySelector('#select-all-checkbox');
    if (selectAllCheckbox && this.#state) {
      const selectedCount = (this.#state.selectedIndices || []).length;
      selectAllCheckbox.checked = selectedCount === this.#currentData.length && this.#currentData.length > 0;
      selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < this.#currentData.length;
    }
  }

  /**
   * 处理键盘快捷键
   * @param {KeyboardEvent} event - 键盘事件
   * @private
   */
  _handleKeyboardShortcuts(event) {
    // 忽略在输入框等元素上的键盘事件
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    if (!this.#state || this.#currentData.length === 0) return;

    switch (event.key) {
      case " ":
        event.preventDefault();
        if (this.#state.focusedIndex !== null && this.#state.focusedIndex !== undefined) {
          this._toggleSelection(this.#state.focusedIndex);
        }
        break;

      case "ArrowDown":
        event.preventDefault();
        this._moveFocus(1);
        break;

      case "ArrowUp":
        event.preventDefault();
        this._moveFocus(-1);
        break;

      case "a":
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this._handleSelectAll(true);
        }
        break;

      case "Enter":
        event.preventDefault();
        if (this.#state.focusedIndex !== null && this.#state.focusedIndex !== undefined) {
          const rowData = this.#currentData[this.#state.focusedIndex];
          if (rowData) {
            this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.filename || rowData.path, {
              actorId: "PDFList"
            });
          }
        }
        break;

      case "Escape":
        event.preventDefault();
        this._handleSelectAll(false);
        this._clearFocusStyles();
        this.#state.focusedIndex = null;
        break;
    }
  }

  /**
   * 移动聚焦
   * @param {number} direction - 方向（1为向下，-1为向上）
   * @private
   */
  _moveFocus(direction) {
    if (!this.#state) return;

    const currentFocus = this.#state.focusedIndex;
    const rowCount = this.#currentData.length;

    if (rowCount === 0) return;

    let newFocus;
    if (currentFocus === null || currentFocus === undefined) {
      newFocus = direction > 0 ? 0 : rowCount - 1;
    } else {
      newFocus = currentFocus + direction;
      if (newFocus < 0) newFocus = 0;
      if (newFocus >= rowCount) newFocus = rowCount - 1;
    }

    this._setFocusOnly(newFocus);
  }

  /**
   * 处理打开操作
   * @param {Object} rowData - 行数据
   * @private
   */
  _handleOpenAction(rowData) {
    this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowData.filename || rowData.path, {
      actorId: "PDFList"
    });
  }

  /**
   * 处理删除操作
   * @param {Object} rowData - 行数据
   * @private
   */
  async _handleDeleteAction(rowData) {
    try {
      let confirmed = false;
      if (window.dialogManager) {
        confirmed = await window.dialogManager.confirm("确定要删除这个PDF文件吗？");
      } else {
        confirmed = confirm("确定要删除这个PDF文件吗？");
      }

      if (!confirmed) return;

      this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, rowData.filename || rowData.path, {
        actorId: "PDFList"
      });

    } catch (error) {
      logger.error("Error handling delete action:", error);
    }
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   * @private
   */
  _formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 格式化日期
   * @param {string|Date} date - 日期
   * @returns {string} 格式化后的日期
   * @private
   */
  _formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ==================== 公开 API ====================

  /**
   * 设置数据
   * @param {Array<Object>} data - 数据数组
   * @returns {Promise<void>}
   */
  async setData(data) {
    if (!Array.isArray(data)) {
      logger.warn("setData expects an array, received:", typeof data);
      return;
    }

    this.#currentData = data;
    this._renderTable();
    logger.info(`Set ${data.length} items in PDF list`);
  }

  /**
   * 渲染表格
   * @private
   */
  _renderTable() {
    // 清空现有内容
    this.#tbodyElement.innerHTML = '';

    if (this.#currentData.length === 0) {
      // 显示空状态
      this.#tableElement.style.display = 'none';
      const emptyState = this.#container.querySelector('.pdf-list-empty-state');
      if (emptyState) {
        emptyState.style.display = 'flex';
      }
      return;
    }

    // 隐藏空状态
    this.#tableElement.style.display = 'table';
    const emptyState = this.#container.querySelector('.pdf-list-empty-state');
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // 渲染数据行
    this.#currentData.forEach((item, index) => {
      const row = this._createTableRow(item, index);
      this.#tbodyElement.appendChild(row);
    });

    // 更新全选checkbox状态
    this._updateSelectAllCheckbox();
  }

  /**
   * 创建表格行
   * @param {Object} item - 数据项
   * @param {number} index - 索引
   * @returns {HTMLTableRowElement} 表格行元素
   * @private
   */
  _createTableRow(item, index) {
    const row = document.createElement('tr');

    // 检查是否应该被选中
    const isSelected = this.#state?.selectedIndices?.includes(index) || false;

    row.innerHTML = `
      <td class="col-select">
        <input type="checkbox" data-index="${index}" ${isSelected ? 'checked' : ''}>
      </td>
      <td class="col-filename" title="${item.filename || item.id || ''}">
        <div class="filename-text">${this._escapeHtml(item.filename || item.id || '')}</div>
      </td>
      <td class="col-path" title="${item.path || ''}">
        <div class="path-text">${this._escapeHtml(item.path || '')}</div>
      </td>
      <td class="col-size">${this._formatFileSize(item.size)}</td>
      <td class="col-modified">${this._formatDate(item.lastModified)}</td>
      <td class="col-tags">
        <div class="tags-container">
          ${(item.tags || []).map(tag => `<span class="tag">${this._escapeHtml(tag)}</span>`).join('')}
        </div>
      </td>
      <td class="col-rating">
        <div class="rating-container">
          ${this._renderRating(item.rating || 0)}
        </div>
      </td>
      <td class="col-actions">
        <div class="action-buttons">
          <button type="button" class="btn-open" data-action="open" title="打开PDF">
            📖
          </button>
          <button type="button" class="btn-delete" data-action="delete" title="删除">
            🗑️
          </button>
        </div>
      </td>
    `;

    return row;
  }

  /**
   * 渲染评分
   * @param {number} rating - 评分
   * @returns {string} 评分HTML
   * @private
   */
  _renderRating(rating) {
    const maxRating = 5;
    let html = '';

    for (let i = 1; i <= maxRating; i++) {
      if (i <= rating) {
        html += '<span class="star filled">★</span>';
      } else {
        html += '<span class="star empty">☆</span>';
      }
    }

    return html;
  }

  /**
   * HTML转义
   * @param {string} text - 文本
   * @returns {string} 转义后的文本
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 添加行
   * @param {Object} rowData - 行数据
   * @param {boolean} addToTop - 是否添加到顶部
   * @returns {Promise<void>}
   */
  async addRow(rowData, addToTop = true) {
    if (addToTop) {
      this.#currentData.unshift(rowData);
    } else {
      this.#currentData.push(rowData);
    }

    this._renderTable();
    logger.info(`Added row: ${rowData.filename || rowData.id}`);
  }

  /**
   * 删除行
   * @param {string} rowId - 行ID
   * @returns {Promise<void>}
   */
  async deleteRow(rowId) {
    const index = this.#currentData.findIndex(item =>
      item.id === rowId || item.filename === rowId
    );

    if (index >= 0) {
      this.#currentData.splice(index, 1);
      this._renderTable();
      logger.info(`Deleted row: ${rowId}`);
    } else {
      logger.warn(`Row not found for deletion: ${rowId}`);
    }
  }

  /**
   * 更新行
   * @param {string} rowId - 行ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<void>}
   */
  async updateRow(rowId, updates) {
    const index = this.#currentData.findIndex(item =>
      item.id === rowId || item.filename === rowId
    );

    if (index >= 0) {
      this.#currentData[index] = { ...this.#currentData[index], ...updates };
      this._renderTable();
      logger.info(`Updated row: ${rowId}`);
    } else {
      logger.warn(`Row not found for update: ${rowId}`);
    }
  }

  /**
   * 清空数据
   * @returns {Promise<void>}
   */
  async clear() {
    this.#currentData = [];
    this._renderTable();
    logger.info("Cleared all data");
  }

  /**
   * 获取当前数据
   * @returns {Array<Object>} 当前数据
   */
  getData() {
    return [...this.#currentData];
  }

  /**
   * 获取选中的数据
   * @returns {Array<Object>} 选中的数据
   */
  getSelectedData() {
    if (!this.#state?.selectedIndices) return [];
    return this.#state.selectedIndices.map(i => this.#currentData[i]).filter(Boolean);
  }

  /**
   * 销毁组件
   * @returns {Promise<void>}
   */
  async destroy() {
    logger.info("Destroying PDFList component");

    try {
      // 清理事件监听器
      this.#domEventUnsubscribers.forEach(unsub => unsub());
      this.#domEventUnsubscribers = [];

      // 清理DOM
      this.#container.innerHTML = '';

      // 清理引用
      this.#tableElement = null;
      this.#tbodyElement = null;
      this.#currentData = [];

      logger.info("PDFList component destroyed successfully");

    } catch (error) {
      logger.error("Error destroying PDFList component:", error);
      throw error;
    }
  }

  // Getters
  get container() { return this.#container; }
  get tableElement() { return this.#tableElement; }
  get currentData() { return [...this.#currentData]; }
}