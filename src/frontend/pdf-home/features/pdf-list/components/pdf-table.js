/**
 * @file PDF表格组件
 * @module PDFTable
 * @description PDF列表表格组件，整合表格初始化、数据管理、生命周期和事件处理
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { DOMUtils } from '../../../../common/utils/dom-utils.js';
import { TableInitializer } from '../services/table-initializer.js';
import { ListDataService } from '../services/list-data-service.js';
import { ListLifecycleService } from '../services/list-lifecycle-service.js';
import { PDF_LIST_EVENTS } from '../events.js';
import { PDF_MANAGEMENT_EVENTS } from '../../../../common/event/event-constants.js';
const logger = getLogger('PDFList.PDFTable');


/**
 * PDF表格组件类
 * @class PDFTable
 */
export class PDFTable {
  #container;
  #initializer;
  #dataService;
  #lifecycleService;
  #state;
  #eventBus;
  #tabulatorEventUnsubscribers = [];
  #domEventUnsubscribers = [];

  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {HTMLElement|string} options.container - 容器元素或选择器
   * @param {Object} options.state - StateManager状态
   * @param {Object} options.eventBus - ScopedEventBus实例
   * @param {Object} [options.tabulatorOptions] - Tabulator配置选项
   */
  constructor({ container, state, eventBus, tabulatorOptions = {} }) {
    this.#container = this._resolveContainer(container);
    this.#state = state;
    this.#eventBus = eventBus;

    logger.info('Initializing PDFTable component');

    // 准备Tabulator选项（添加事件处理器）
    const options = this._prepareTabulatorOptions(tabulatorOptions);

    // 1. 创建表格初始化器
    this.#initializer = new TableInitializer(this.#container, options);

    // 2. 同步初始化Tabulator
    const tabulator = this.#initializer.initializeSync();

    // 3. 创建数据服务
    this.#dataService = new ListDataService({
      tabulator: tabulator,
      tableWrapper: this.#initializer.tableWrapper,
      fallbackMode: this.#initializer.fallbackMode,
      state: this.#state,
      eventBus: this.#eventBus
    });

    // 4. 创建生命周期服务
    this.#lifecycleService = new ListLifecycleService({
      tabulator: tabulator,
      tableWrapper: this.#initializer.tableWrapper,
      container: this.#container,
      state: this.#state,
      eventBus: this.#eventBus
    });

    // 5. 设置Tabulator事件监听器
    if (tabulator) {
      this._setupTabulatorEvents(tabulator);
    }

    // 6. 设置DOM事件监听器
    this._setupDOMEvents();

    logger.info('PDFTable component initialized successfully');
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
   * 准备Tabulator配置选项
   * @param {Object} userOptions - 用户提供的选项
   * @returns {Object} 合并后的选项
   * @private
   */
  _prepareTabulatorOptions(userOptions) {
    // 合并默认选项和用户选项
    return {
      ...userOptions,
      // 保留用户提供的列定义
      columns: userOptions.columns || this._getDefaultColumns(),
    };
  }

  /**
   * 获取默认列定义
   * @returns {Array} 列定义数组
   * @private
   */
  _getDefaultColumns() {
    return [
      { title: '文件名', field: 'filename', width: 300 },
      { title: '路径', field: 'path', width: 400 },
      { title: '大小', field: 'size', width: 100 },
      { title: '最后修改', field: 'lastModified', width: 150 },
      { title: '标签', field: 'tags', width: 200 },
      { title: '评分', field: 'rating', width: 100 }
    ];
  }

  /**
   * 设置Tabulator事件监听器
   * @param {Tabulator} tabulator - Tabulator实例
   * @private
   */
  _setupTabulatorEvents(tabulator) {
    try {
      // 行选中事件
      tabulator.on('rowSelectionChanged', (data, rows) => {
        const indices = rows.map(row => row.getPosition(true) - 1); // 0-based index
        this.#eventBus?.emit(PDF_LIST_EVENTS.SELECTION_CHANGED, {
          selectedIndices: indices,
          selectedItems: data,
          count: indices.length,
          timestamp: Date.now()
        });
        logger.debug(`Row selection changed: ${indices.length} rows selected`);
      });

      // 行点击事件
      tabulator.on('rowClick', (e, row) => {
        const data = row.getData();
        this.#eventBus?.emit(PDF_LIST_EVENTS.ROW_CLICKED, {
          index: row.getPosition(true) - 1,
          row: data,
          nativeEvent: {
            type: e.type,
            button: e.button,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey
          },
          timestamp: Date.now()
        });
        logger.debug('Row clicked:', data.filename || data.id);
      });

      // 行双击事件
      tabulator.on('rowDblClick', (e, row) => {
        const data = row.getData();
        this.#eventBus?.emit(PDF_LIST_EVENTS.ROW_DOUBLE_CLICKED, {
          index: row.getPosition(true) - 1,
          row: data,
          nativeEvent: {
            type: e.type,
            button: e.button,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey
          },
          timestamp: Date.now()
        });

        // 同时触发全局PDF打开请求事件
        this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, data.filename || data.path, {
          actorId: 'PDFTable'
        });

        logger.debug('Row double-clicked, opening PDF:', data.filename || data.id);
      });

      // 行上下文菜单事件
      tabulator.on('rowContext', (e, row) => {
        const data = row.getData();
        this.#eventBus?.emit(PDF_LIST_EVENTS.ROW_CONTEXT_MENU, {
          index: row.getPosition(true) - 1,
          row: data,
          nativeEvent: {
            type: e.type,
            clientX: e.clientX,
            clientY: e.clientY
          },
          timestamp: Date.now()
        });
        logger.debug('Row context menu:', data.filename || data.id);
      });

      // 数据排序事件
      tabulator.on('dataSorting', (sorters) => {
        if (sorters.length > 0) {
          const sorter = sorters[0];
          this.#eventBus?.emit(PDF_LIST_EVENTS.SORT_CHANGED, {
            column: sorter.field,
            direction: sorter.dir,
            timestamp: Date.now()
          });
          logger.debug(`Data sorting: ${sorter.field} ${sorter.dir}`);
        }
      });

      logger.debug('Tabulator event listeners set up');

    } catch (error) {
      logger.warn('Error setting up Tabulator events:', error);
    }
  }

  /**
   * 设置DOM事件监听器
   * @private
   */
  _setupDOMEvents() {
    try {
      // 处理表格内的按钮点击（打开、删除等操作）
      const handleTableAction = async (event) => {
        const btn = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const rowId = btn.getAttribute('data-row-id') || btn.getAttribute('data-rowid');
        const filename = btn.getAttribute('data-filename') || btn.getAttribute('data-filepath') || null;

        logger.info(`Table action triggered: action=${action}, rowId=${rowId}, filename=${filename}`);

        if (action) {
          event.preventDefault();
          event.stopPropagation();

          switch (action) {
            case 'open':
              this._handleOpenAction(rowId, filename);
              break;
            case 'delete':
            case 'remove':
              await this._handleDeleteAction(rowId, filename);
              break;
          }
        }
      };

      if (this.#container) {
        DOMUtils.addEventListener(this.#container, 'click', handleTableAction);
        this.#domEventUnsubscribers.push(() =>
          DOMUtils.removeEventListener(this.#container, 'click', handleTableAction)
        );
      }

      logger.debug('DOM event listeners set up');

    } catch (error) {
      logger.warn('Error setting up DOM events:', error);
    }
  }

  /**
   * 处理打开操作
   * @param {string} rowId - 行ID
   * @param {string} filename - 文件名
   * @private
   */
  _handleOpenAction(rowId, filename) {
    this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.OPEN.REQUESTED, rowId || filename, {
      actorId: 'PDFTable'
    });
  }

  /**
   * 处理删除操作
   * @param {string} rowId - 行ID
   * @param {string} filename - 文件名
   * @private
   */
  async _handleDeleteAction(rowId, filename) {
    try {
      // 使用对话框管理器确认
      let confirmed = false;
      if (window.dialogManager) {
        confirmed = await window.dialogManager.confirm("确定要删除这个PDF文件吗？");
      } else {
        // 降级到原生confirm
        confirmed = confirm("确定要删除这个PDF文件吗？");
      }

      if (!confirmed) return;

      const payload = rowId || filename;
      this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.REMOVE.REQUESTED, payload, {
        actorId: 'PDFTable'
      });

    } catch (error) {
      logger.error('Error handling delete action:', error);
    }
  }

  /**
   * 处理编辑操作
   * @param {string} rowId - 行ID
   * @param {string} filename - 文件名
   * @private
   */
  _handleEditAction(rowId, filename) {
    try {
      // 从Tabulator获取完整的行数据
      const tabulator = this.#initializer?.tabulator;
      if (!tabulator) {
        logger.warn('Tabulator not available for edit action');
        return;
      }

      // 根据rowId或filename查找行数据
      let rowData = null;
      const allData = tabulator.getData();

      if (rowId) {
        rowData = allData.find(row => row.id === rowId || row.filename === rowId);
      } else if (filename) {
        rowData = allData.find(row => row.filename === filename);
      }

      if (!rowData) {
        logger.warn('Row data not found for edit action:', { rowId, filename });
        return;
      }

      // 发出全局编辑请求事件（供pdf-edit功能域监听）
      this.#eventBus?.emitGlobal(PDF_MANAGEMENT_EVENTS.EDIT.REQUESTED, rowData, {
        actorId: 'PDFTable'
      });

      logger.info('Edit action triggered for record:', rowData.filename || rowData.id);

    } catch (error) {
      logger.error('Error handling edit action:', error);
    }
  }

  // ==================== 公开 API ====================

  /**
   * 初始化组件
   * @returns {Promise<void>}
   */
  async initialize() {
    return await this.#lifecycleService.initialize();
  }

  /**
   * 刷新列表
   * @returns {Promise<void>}
   */
  async refresh() {
    return await this.#lifecycleService.refresh();
  }

  /**
   * 设置表格数据
   * @param {Array<Object>} data - 数据数组
   * @returns {Promise<void>}
   */
  async setData(data) {
    return await this.#dataService.setData(data);
  }

  /**
   * 加载数据（兼容性API）
   * @param {Array<Object>} data - 数据数组
   * @returns {Promise<void>}
   */
  async loadData(data) {
    return await this.#dataService.loadData(data);
  }

  /**
   * 添加单行数据
   * @param {Object} rowData - 行数据
   * @param {boolean} addToTop - 是否添加到顶部
   * @returns {Promise<void>}
   */
  async addRow(rowData, addToTop = true) {
    return await this.#dataService.addRow(rowData, addToTop);
  }

  /**
   * 删除指定行
   * @param {string} rowId - 行ID
   * @returns {Promise<void>}
   */
  async deleteRow(rowId) {
    return await this.#dataService.deleteRow(rowId);
  }

  /**
   * 更新指定行
   * @param {string} rowId - 行ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<void>}
   */
  async updateRow(rowId, updates) {
    return await this.#dataService.updateRow(rowId, updates);
  }

  /**
   * 清空表格数据
   * @returns {Promise<void>}
   */
  async clear() {
    return await this.#dataService.clear();
  }

  /**
   * 获取当前数据
   * @returns {Array<Object>} 当前数据
   */
  getData() {
    return this.#dataService.getData();
  }

  /**
   * 显示空状态
   * @param {string} message - 空状态消息
   * @returns {Promise<void>}
   */
  async displayEmptyState(message = '暂无数据') {
    return await this.#dataService.displayEmptyState(message);
  }

  /**
   * 销毁组件
   * @returns {Promise<void>}
   */
  async destroy() {
    logger.info('Destroying PDFTable component');

    try {
      // 1. 清理DOM事件监听器
      this.#domEventUnsubscribers.forEach(unsub => unsub());
      this.#domEventUnsubscribers = [];

      // 2. 清理Tabulator事件监听器
      this.#tabulatorEventUnsubscribers.forEach(unsub => unsub());
      this.#tabulatorEventUnsubscribers = [];

      // 3. 销毁生命周期服务（会销毁Tabulator实例）
      await this.#lifecycleService.destroy();

      // 4. 清理服务引用
      this.#initializer.destroy();
      this.#initializer = null;
      this.#dataService = null;
      this.#lifecycleService = null;

      logger.info('PDFTable component destroyed successfully');

    } catch (error) {
      logger.error('Error destroying PDFTable component:', error);
      throw error;
    }
  }

  /**
   * 软重置 - 清理内容但不销毁结构
   * @returns {Promise<void>}
   */
  async softReset() {
    return await this.#lifecycleService.softReset();
  }

  /**
   * 获取组件状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      initialization: this.#initializer.getInitializationStatus(),
      dataService: this.#dataService.getStatus(),
      lifecycle: this.#lifecycleService.getLifecycleStatus(),
      domEventListeners: this.#domEventUnsubscribers.length,
      tabulatorEventListeners: this.#tabulatorEventUnsubscribers.length
    };
  }

  /**
   * 重新初始化表格
   * @param {Object} newOptions - 新的配置选项
   * @returns {Promise<void>}
   */
  async reinitialize(newOptions = {}) {
    logger.info('Reinitializing PDFTable component');

    try {
      // 1. 销毁现有实例
      await this.destroy();

      // 2. 重新创建组件（需要在外部重新创建PDFTable实例）
      logger.warn('Reinitialize requires creating a new PDFTable instance');

    } catch (error) {
      logger.error('Error reinitializing PDFTable component:', error);
      throw error;
    }
  }

  // Getters
  get tabulator() { return this.#initializer?.tabulator; }
  get tableWrapper() { return this.#initializer?.tableWrapper; }
  get container() { return this.#container; }
  get fallbackMode() { return this.#dataService?.fallbackMode || false; }
}
