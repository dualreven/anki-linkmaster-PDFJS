/**
 * @file PDF List 功能域入口
 * @module features/pdf-list
 * @description
 * PDF 列表管理功能域，提供 PDF 记录的列表展示、增删改查、搜索过滤等功能。
 *
 * 实现了 IFeature 接口，可通过 FeatureRegistry 进行注册和管理。
 *
 * @example
 * import { PDFListFeature } from './features/pdf-list/index.js';
 * import { FeatureRegistry } from './core/feature-registry.js';
 *
 * const registry = new FeatureRegistry({ container });
 * registry.register(new PDFListFeature());
 * await registry.install('pdf-list');
 */

import { PDFListFeatureConfig } from './feature.config.js';
import { getLogger } from '../../../common/utils/logger.js';
import { createListState, ListStateHelpers } from './state/list-state.js';
import { PDF_LIST_EVENTS, EventDataFactory } from './events.js';

/**
 * PDF List 功能域类
 * @class PDFListFeature
 * @implements {IFeature}
 */
export class PDFListFeature {
  /**
   * 功能上下文（在 install 时注入）
   * @type {import('../../core/feature-registry.js').FeatureContext|null}
   * @private
   */
  #context = null;

  /**
   * 作用域事件总线
   * @type {import('../../common/event/scoped-event-bus.js').ScopedEventBus|null}
   * @private
   */
  #scopedEventBus = null;

  /**
   * 日志记录器
   * @type {import('../../common/utils/logger.js').Logger|null}
   * @private
   */
  #logger = null;

  /**
   * UI 管理器
   * @type {Object|null}
   * @private
   */
  #uiManager = null;

  /**
   * WebSocket 客户端
   * @type {Object|null}
   * @private
   */
  #wsClient = null;

  /**
   * 列表状态（由 StateManager 管理）
   * @type {Object|null}
   * @private
   */
  #state = null;

  /**
   * 事件取消订阅函数列表
   * @type {Function[]}
   * @private
   */
  #unsubscribers = [];

  /**
   * 功能是否已启用
   * @type {boolean}
   * @private
   */
  #enabled = false;

  // ==================== IFeature 接口实现 ====================

  /**
   * 功能名称（唯一标识）
   * @returns {string}
   */
  get name() {
    return PDFListFeatureConfig.name;
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    return PDFListFeatureConfig.version;
  }

  /**
   * 功能依赖列表
   * @returns {string[]}
   */
  get dependencies() {
    return PDFListFeatureConfig.dependencies;
  }

  /**
   * 安装功能（初始化逻辑）
   * @param {import('../../core/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 从容器中获取必要的服务
      await this.#setupServices(context);

      // 2. 注册事件监听器
      this.#registerEventListeners();

      // 3. 初始化 UI（如果需要）
      await this.#initializeUI();

      // 4. 标记为已启用
      this.#enabled = true;

      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 卸载功能（清理逻辑）
   * @param {import('../../core/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消所有事件监听
      this.#unregisterEventListeners();

      // 2. 清理 UI
      await this.#cleanupUI();

      // 3. 清理服务引用
      this.#wsClient = null;
      this.#uiManager = null;
      this.#state = null;

      // 4. 标记为未启用
      this.#enabled = false;

      this.#logger.info(`${this.name} uninstalled successfully`);
    } catch (error) {
      this.#logger.error(`Failed to uninstall ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 启用功能（可选）
   * @returns {Promise<void>}
   */
  async enable() {
    if (this.#enabled) {
      this.#logger.debug(`${this.name} is already enabled`);
      return;
    }

    this.#logger.info(`Enabling ${this.name}...`);

    // 重新注册事件监听器
    this.#registerEventListeners();

    this.#enabled = true;
    this.#logger.info(`${this.name} enabled`);
  }

  /**
   * 禁用功能（可选）
   * @returns {Promise<void>}
   */
  async disable() {
    if (!this.#enabled) {
      this.#logger.debug(`${this.name} is already disabled`);
      return;
    }

    this.#logger.info(`Disabling ${this.name}...`);

    // 取消事件监听
    this.#unregisterEventListeners();

    this.#enabled = false;
    this.#logger.info(`${this.name} disabled`);
  }

  // ==================== 私有方法 ====================

  /**
   * 设置服务依赖
   * @param {import('../../core/feature-registry.js').FeatureContext} context - 功能上下文
   * @private
   */
  async #setupServices(context) {
    // 从全局容器中获取服务
    const globalContainer = context.container;

    // 1. 获取 WebSocket 客户端（如果存在）
    if (globalContainer && globalContainer.has && globalContainer.has('wsClient')) {
      this.#wsClient = globalContainer.get('wsClient');
      this.#logger.debug('WSClient service acquired from container');
    }

    // 2. 获取 StateManager 并创建功能域状态
    if (globalContainer && globalContainer.has && globalContainer.has('stateManager')) {
      const stateManager = globalContainer.get('stateManager');
      this.#state = createListState(stateManager);
      this.#logger.debug('List state created via StateManager');

      // 3. 设置状态监听器
      this.#setupStateWatchers();
    } else {
      this.#logger.warn('StateManager not available, feature will run without state management');
    }

    // 注意：这里只是获取服务引用，实际的初始化逻辑应该在服务层处理
  }

  /**
   * 设置状态监听器
   * @private
   */
  #setupStateWatchers() {
    if (!this.#state) {
      this.#logger.warn('State not available, skipping state watchers setup');
      return;
    }

    // 监听列表数据变化
    this.#state.watch('items', (newItems, oldItems) => {
      this.#logger.debug(`List items changed: ${oldItems.length} -> ${newItems.length}`);
      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_CHANGED, {
        items: newItems,
        previousCount: oldItems.length,
        currentCount: newItems.length
      });
    });

    // 监听选中项变化
    this.#state.watch('selectedIndices', (newIndices, oldIndices) => {
      this.#logger.debug(`Selection changed: ${oldIndices.length} -> ${newIndices.length} items selected`);
      const items = this.#state.get().items;
      const selectedItems = newIndices.map(index => items[index]).filter(Boolean);

      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.SELECTION_CHANGED,
        EventDataFactory.createSelectionChangedData(newIndices, selectedItems)
      );
    });

    // 监听加载状态变化
    this.#state.watch('isLoading', (isLoading) => {
      this.#logger.debug(`Loading state changed: ${isLoading}`);
      if (isLoading) {
        this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_STARTED);
      }
    });

    // 监听排序变化
    this.#state.watch(['sortColumn', 'sortDirection'], (newState, oldState) => {
      if (newState.sortColumn !== oldState.sortColumn ||
          newState.sortDirection !== oldState.sortDirection) {
        this.#logger.debug(`Sort changed: ${newState.sortColumn} ${newState.sortDirection}`);
        this.#scopedEventBus?.emit(
          PDF_LIST_EVENTS.SORT_CHANGED,
          EventDataFactory.createSortChangedData(newState.sortColumn, newState.sortDirection)
        );
      }
    });

    // 监听过滤条件变化
    this.#state.watch('filters', (newFilters, oldFilters) => {
      this.#logger.debug('Filters changed:', newFilters);
      this.#scopedEventBus?.emit(
        PDF_LIST_EVENTS.FILTER_CHANGED,
        EventDataFactory.createFilterChangedData(newFilters)
      );
    });

    this.#logger.debug('State watchers configured');
  }

  /**
   * 注册事件监听器
   * @private
   */
  #registerEventListeners() {
    if (!this.#scopedEventBus) {
      this.#logger.warn('ScopedEventBus not available, skipping event registration');
      return;
    }

    const { local, global } = PDFListFeatureConfig.config.events;

    // 监听本地事件（功能域内部事件）
    // 示例：监听表格行选中事件
    const unsubRowSelected = this.#scopedEventBus.on(local.ROW_SELECTED, (data) => {
      this.#logger.debug('Row selected:', data);
      // TODO: 处理行选中逻辑
    });
    this.#unsubscribers.push(unsubRowSelected);

    // 监听表格行双击事件
    const unsubRowDblClick = this.#scopedEventBus.on(local.ROW_DOUBLE_CLICK, (data) => {
      this.#logger.debug('Row double-clicked:', data);

      // 触发全局事件：PDF 打开请求
      this.#scopedEventBus.emitGlobal(global.OPEN_REQUESTED, {
        filename: data.filename,
        path: data.path
      });
    });
    this.#unsubscribers.push(unsubRowDblClick);

    // 监听全局事件（如果需要响应其他功能域的事件）
    // 示例：监听 PDF 编辑器的更新事件
    const unsubGlobalUpdate = this.#scopedEventBus.onGlobal('pdf:editor:record:updated', (data) => {
      this.#logger.debug('PDF record updated by editor:', data);
      // TODO: 刷新列表中的对应行
    });
    this.#unsubscribers.push(unsubGlobalUpdate);

    this.#logger.debug(`Registered ${this.#unsubscribers.length} event listeners`);
  }

  /**
   * 取消事件监听器
   * @private
   */
  #unregisterEventListeners() {
    this.#unsubscribers.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        this.#logger.warn('Failed to unsubscribe event listener:', error);
      }
    });

    this.#unsubscribers = [];
    this.#logger.debug('All event listeners unregistered');
  }

  /**
   * 初始化 UI
   * @private
   */
  async #initializeUI() {
    try {
      this.#logger.debug('Initializing PDF list UI');

      // 1. 获取表格容器
      const tableContainer = document.querySelector('#pdf-table-container');
      if (!tableContainer) {
        this.#logger.warn('PDF table container not found, skipping UI initialization');
        return;
      }

      // 2. 动态导入 PDFTable 组件
      const { PDFTable } = await import('./components/pdf-table.js');

      // 3. 创建 PDFTable 实例
      this.#uiManager = new PDFTable({
        container: tableContainer,
        state: this.#state,
        eventBus: this.#scopedEventBus,
        tabulatorOptions: {
          // 可以在这里添加自定义的 Tabulator 选项
        }
      });

      // 4. 初始化组件
      await this.#uiManager.initialize();

      this.#logger.debug('PDF list UI initialized successfully');

    } catch (error) {
      this.#logger.error('Failed to initialize PDF list UI:', error);
      throw error;
    }
  }

  /**
   * 清理 UI
   * @private
   */
  async #cleanupUI() {
    if (this.#uiManager) {
      try {
        if (typeof this.#uiManager.destroy === 'function') {
          await this.#uiManager.destroy();
        }
        this.#uiManager = null;
        this.#logger.debug('UI cleaned up successfully');
      } catch (error) {
        this.#logger.warn('Error cleaning up UI:', error);
        this.#uiManager = null;
      }
    }
  }

  // ==================== 公开方法（供外部调用） ====================

  /**
   * 刷新 PDF 列表
   * @returns {Promise<void>}
   */
  async refreshList() {
    if (!this.#enabled) {
      this.#logger.warn('Cannot refresh list: feature is disabled');
      return;
    }

    this.#logger.info('Refreshing PDF list...');

    try {
      // 1. 设置加载状态
      if (this.#state) {
        ListStateHelpers.setLoading(this.#state, true);
      }

      // 2. 触发数据加载请求事件
      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_REQUESTED);

      // TODO: 实际的列表刷新逻辑（将在后续迁移中实现）
      // 1. 通过 WebSocket 请求后端数据
      // 2. 接收数据后更新状态
      // 3. 状态变化会自动触发 DATA_CHANGED 事件

      this.#logger.info('PDF list refresh initiated');
    } catch (error) {
      this.#logger.error('Failed to refresh PDF list:', error);

      if (this.#state) {
        ListStateHelpers.setError(this.#state, error);
        ListStateHelpers.setLoading(this.#state, false);
      }

      this.#scopedEventBus?.emit(PDF_LIST_EVENTS.DATA_LOAD_FAILED, {
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * 获取选中的记录
   * @returns {Object[]} 选中的记录数组
   */
  getSelectedRecords() {
    if (!this.#state) {
      this.#logger.warn('State not available, returning empty array');
      return [];
    }

    const { items, selectedIndices } = this.#state.get();
    const selectedRecords = selectedIndices.map(index => items[index]).filter(Boolean);

    this.#logger.debug(`Retrieved ${selectedRecords.length} selected records`);
    return selectedRecords;
  }

  /**
   * 设置过滤条件
   * @param {Object} filters - 过滤条件
   */
  setFilters(filters) {
    if (!this.#enabled) {
      this.#logger.warn('Cannot set filters: feature is disabled');
      return;
    }

    if (!this.#state) {
      this.#logger.warn('State not available, cannot set filters');
      return;
    }

    this.#logger.debug('Setting filters:', filters);

    // 使用 ListStateHelpers 更新过滤条件
    ListStateHelpers.setFilters(this.#state, filters);

    // 状态变化会自动触发 FILTER_CHANGED 事件
    // 实际的过滤逻辑将在表格组件中实现
  }
}

/**
 * 创建 PDF List 功能域实例的工厂函数
 * @returns {PDFListFeature}
 */
export function createPDFListFeature() {
  return new PDFListFeature();
}

export default PDFListFeature;
