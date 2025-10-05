/**
 * @file PDF Sorter 功能域入口
 * @module features/pdf-sorter
 * @description
 * PDF 排序功能域，提供 PDF 列表的多字段排序、自定义排序、保存排序方案等功能。
 *
 * 实现了 IFeature 接口，可通过 FeatureRegistry 进行注册和管理。
 *
 * @example
 * import { PDFSorterFeature } from './features/pdf-sorter/index.js';
 * import { FeatureRegistry } from './core/feature-registry.js';
 *
 * const registry = new FeatureRegistry({ container });
 * registry.register(new PDFListFeature());
 * registry.register(new PDFSorterFeature()); // 依赖 pdf-list
 * await registry.installAll();
 */

import { PDFSorterFeatureConfig } from './feature.config.js';
import { getLogger } from '../../../common/utils/logger.js';
import { SorterPanel } from './components/sorter-panel.js';
import { ModeSelector } from './components/mode-selector.js';
import { MultiSortBuilder } from './components/multi-sort-builder.js';
import { WeightedSortEditor } from './components/weighted-sort-editor.js';
import { SortManager } from './services/sort-manager.js';
import { TabulatorAdapter } from './services/tabulator-adapter.js';

/**
 * PDF Sorter 功能域类
 * @class PDFSorterFeature
 * @implements {IFeature}
 */
export class PDFSorterFeature {
  /**
   * 功能上下文（在 install 时注入）
   * @type {import('../../../common/micro-service/feature-registry.js').FeatureContext|null}
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
   * 全局事件总线
   * @type {EventBus|null}
   * @private
   */
  #globalEventBus = null;

  /**
   * 日志记录器
   * @type {import('../../common/utils/logger.js').Logger|null}
   * @private
   */
  #logger = null;

  /**
   * 排序面板组件
   * @type {SorterPanel|null}
   * @private
   */
  #sorterPanel = null;

  /**
   * 模式选择器组件
   * @type {ModeSelector|null}
   * @private
   */
  #modeSelector = null;

  /**
   * 多级排序构建器
   * @type {MultiSortBuilder|null}
   * @private
   */
  #multiSortBuilder = null;

  /**
   * 加权排序编辑器
   * @type {WeightedSortEditor|null}
   * @private
   */
  #weightedSortEditor = null;

  /**
   * 排序管理器
   * @type {SortManager|null}
   * @private
   */
  #sortManager = null;

  /**
   * Tabulator适配器
   * @type {TabulatorAdapter|null}
   * @private
   */
  #tabulatorAdapter = null;

  /**
   * 当前排序配置
   * @type {Array<{field: string, direction: 'asc'|'desc'}>}
   * @private
   */
  #currentSort = [];

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
    return PDFSorterFeatureConfig.name;
  }

  /**
   * 功能版本
   * @returns {string}
   */
  get version() {
    return PDFSorterFeatureConfig.version;
  }

  /**
   * 功能依赖列表
   * @returns {string[]}
   */
  get dependencies() {
    return PDFSorterFeatureConfig.dependencies;
  }

  /**
   * 安装功能（初始化逻辑）
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#context = context;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;
    this.#logger = context.logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 初始化核心服务
      this.#sortManager = new SortManager(this.#logger, this.#globalEventBus);
      this.#tabulatorAdapter = new TabulatorAdapter(this.#logger);

      // 2. 创建UI组件
      this.#createUIComponents();

      // 3. 绑定排序按钮事件
      this.#bindSorterButton();

      // 4. 注册事件监听器
      this.#registerEventListeners();

      // 5. 订阅PDF列表数据更新
      this.#subscribeToPdfList();

      // 6. 初始化默认排序
      this.#initializeDefaultSort();

      this.#enabled = true;
      this.#logger.info(`${this.name} installed successfully`);
    } catch (error) {
      this.#logger.error(`Failed to install ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * 卸载功能（清理逻辑）
   * @param {import('../../../common/micro-service/feature-registry.js').FeatureContext} context - 功能上下文
   * @returns {Promise<void>}
   */
  async uninstall(context) {
    this.#logger.info(`Uninstalling ${this.name}...`);

    try {
      // 1. 取消所有事件监听
      this.#unregisterEventListeners();

      // 2. 销毁UI组件
      if (this.#sorterPanel) {
        this.#sorterPanel.destroy();
        this.#sorterPanel = null;
      }
      if (this.#modeSelector) {
        this.#modeSelector.destroy();
        this.#modeSelector = null;
      }
      if (this.#multiSortBuilder) {
        this.#multiSortBuilder.destroy();
        this.#multiSortBuilder = null;
      }
      if (this.#weightedSortEditor) {
        this.#weightedSortEditor.destroy();
        this.#weightedSortEditor = null;
      }

      // 3. 恢复Tabulator原始状态
      if (this.#tabulatorAdapter) {
        this.#tabulatorAdapter.restore();
        this.#tabulatorAdapter = null;
      }

      // 4. 清理排序配置
      this.#currentSort = [];
      this.#sortManager = null;

      // 5. 标记为未启用
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
   * 初始化默认排序配置
   * @private
   */
  #initializeDefaultSort() {
    const { defaultSortField, defaultSortDirection } = PDFSorterFeatureConfig.config.sorter;

    this.#currentSort = [
      {
        field: defaultSortField,
        direction: defaultSortDirection
      }
    ];

    this.#logger.debug('Default sort initialized:', this.#currentSort);
  }

  /**
   * 创建UI组件
   * @private
   */
  #createUIComponents() {
    console.log('[DEBUG PDFSorterFeature] Creating UI components...');

    // 1. 创建排序面板
    this.#sorterPanel = new SorterPanel(this.#logger, this.#scopedEventBus);
    console.log('[DEBUG PDFSorterFeature] SorterPanel created:', this.#sorterPanel);

    this.#sorterPanel.render();
    console.log('[DEBUG PDFSorterFeature] SorterPanel rendered');

    // 2. 创建模式选择器
    this.#modeSelector = new ModeSelector(this.#logger, this.#scopedEventBus, {
      defaultMode: 2 // 默认多级排序
    });
    this.#modeSelector.render(this.#sorterPanel.getModeSelectorContainer());

    // 3. 创建多级排序构建器
    this.#multiSortBuilder = new MultiSortBuilder(this.#logger, this.#scopedEventBus, {
      availableFields: PDFSorterFeatureConfig.config.sorter.sortableFields,
      maxFields: PDFSorterFeatureConfig.config.sorter.maxSortFields
    });
    this.#multiSortBuilder.render(this.#sorterPanel.getMultiSortContainer());

    // 4. 创建加权排序编辑器
    this.#weightedSortEditor = new WeightedSortEditor(this.#logger, this.#scopedEventBus, {
      availableFields: PDFSorterFeatureConfig.config.sorter.sortableFields
    });
    this.#weightedSortEditor.render(this.#sorterPanel.getWeightedSortContainer());

    this.#logger.info('[PDFSorterFeature] UI components created');
  }

  /**
   * 绑定排序按钮事件
   * @private
   */
  #bindSorterButton() {
    if (!this.#globalEventBus) {
      this.#logger.warn('[PDFSorterFeature] Global event bus not available; falling back to DOM binding');

      const sortBtn = document.getElementById('sort-btn');
      if (!sortBtn) {
        this.#logger.warn('[PDFSorterFeature] Sort button not found for DOM fallback');
        return;
      }

      const handleSortClick = () => {
        this.#logger.info('[PDFSorterFeature] Sort button clicked (DOM fallback)');
        this.#sorterPanel.toggle();
      };

      sortBtn.addEventListener('click', handleSortClick);
      this.#unsubscribers.push(() => {
        sortBtn.removeEventListener('click', handleSortClick);
      });
      return;
    }

    const togglePanel = (source = 'unknown') => {
      if (!this.#sorterPanel) {
        this.#logger.warn('[PDFSorterFeature] Sort panel is not ready');
        return;
      }

      this.#logger.info(`[PDFSorterFeature] Sort toggle requested via ${source}`);
      this.#sorterPanel.toggle();
    };

    const unsubSearchSort = this.#globalEventBus.on('search:sort:clicked', (payload = {}) => {
      togglePanel(payload.source || 'search:sort:clicked');
    });

    const unsubHeaderSort = this.#globalEventBus.on('header:sort:clicked', (payload = {}) => {
      togglePanel(payload.source || 'header:sort:clicked');
    });

    this.#unsubscribers.push(unsubSearchSort, unsubHeaderSort);
    this.#logger.info('[PDFSorterFeature] Listening global sort toggle events (search/header)');
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

    // 监听模式变更事件（三段式格式）
    const unsubModeChanged = this.#scopedEventBus.on('sorter:mode:changed', (data) => {
      this.#handleModeChange(data.mode);
    });
    this.#unsubscribers.push(unsubModeChanged);

    // 监听排序应用请求（三段式格式）
    const unsubApplySort = this.#scopedEventBus.on('sorter:sort:requested', (data) => {
      this.#handleApplySort(data);
    });
    this.#unsubscribers.push(unsubApplySort);

    // 监听排序清除请求（三段式格式）
    const unsubClearSort = this.#scopedEventBus.on('sorter:sort:cleared', () => {
      this.#handleClearSort();
    });
    this.#unsubscribers.push(unsubClearSort);

    this.#logger.debug(`Registered ${this.#unsubscribers.length} event listeners`);
  }

  /**
   * 订阅PDF列表数据更新
   * @private
   */
  #subscribeToPdfList() {
    // 监听PDF列表数据加载完成
    const unsubListLoaded = this.#globalEventBus.on('@pdf-list/data:load:completed', (data) => {
      this.#logger.info('[PDFSorterFeature] PDF list loaded', { count: data.items?.length });
      if (data.items) {
        this.#sortManager.setDataSource(data.items);
      }
    });
    this.#unsubscribers.push(unsubListLoaded);

    // 监听表格就绪(用于获取table实例)
    const unsubTableReady = this.#globalEventBus.on('@pdf-list/table:readiness:completed', (data) => {
      this.#logger.info('[PDFSorterFeature] PDF table is ready');
      if (data.table) {
        this.#tabulatorAdapter.setTable(data.table);
      }
    });
    this.#unsubscribers.push(unsubTableReady);
  }

  /**
   * 处理模式变更
   * @param {number} mode - 新模式
   * @private
   */
  #handleModeChange(mode) {
    this.#logger.info(`[PDFSorterFeature] Handling mode change: ${mode}`);

    // 更新Tabulator适配器
    if (this.#tabulatorAdapter) {
      this.#tabulatorAdapter.switchMode(mode);
    }

    // 更新排序管理器模式
    if (this.#sortManager) {
      this.#sortManager.setMode(mode);
    }
  }

  /**
   * 处理应用排序
   * @param {Object} data - 排序数据
   * @private
   */
  #handleApplySort(data) {
    this.#logger.info('[PDFSorterFeature] Handling apply sort', data);

    try {
      if (data.type === 'multi') {
        // 多级排序
        const sortedData = this.#sortManager.applyMultiSort(data.configs);
        this.#tabulatorAdapter.applyMultiSort(data.configs);
      } else if (data.type === 'weighted') {
        // 加权排序
        const sortedData = this.#sortManager.applyWeightedSort(data.formula);
        this.#tabulatorAdapter.applyWeightedSort(sortedData);
      }
    } catch (error) {
      this.#logger.error('[PDFSorterFeature] Failed to apply sort', error);
      alert(`排序失败: ${error.message}`);
    }
  }

  /**
   * 处理清除排序
   * @private
   */
  #handleClearSort() {
    this.#logger.info('[PDFSorterFeature] Handling clear sort');

    try {
      const originalData = this.#sortManager.clearSort();
      this.#tabulatorAdapter.clearSort();
    } catch (error) {
      this.#logger.error('[PDFSorterFeature] Failed to clear sort', error);
    }
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

  // ==================== 公开方法（供外部调用） ====================

  /**
   * 设置排序配置
   * @param {string} field - 排序字段
   * @param {'asc'|'desc'} direction - 排序方向
   */
  setSort(field, direction = 'asc') {
    if (!this.#enabled) {
      this.#logger.warn('Cannot set sort: feature is disabled');
      return;
    }

    // 验证字段是否可排序
    const sortableFields = PDFSorterFeatureConfig.config.sorter.sortableFields;
    const fieldConfig = sortableFields.find(f => f.field === field);

    if (!fieldConfig) {
      this.#logger.error(`Field "${field}" is not sortable`);
      return;
    }

    this.#logger.info(`Setting sort: ${field} ${direction}`);

    this.#currentSort = [{ field, direction }];

    // 触发排序改变事件
    this.#scopedEventBus?.emit(
      PDFSorterFeatureConfig.config.events.local.SORT_CHANGED,
      this.#currentSort
    );

    // 应用排序
    this.applySort();
  }

  /**
   * 添加排序字段（多字段排序）
   * @param {string} field - 排序字段
   * @param {'asc'|'desc'} direction - 排序方向
   */
  addSort(field, direction = 'asc') {
    if (!this.#enabled) {
      this.#logger.warn('Cannot add sort: feature is disabled');
      return;
    }

    const { multiSort, maxSortFields } = PDFSorterFeatureConfig.config.sorter;

    if (!multiSort) {
      this.#logger.warn('Multi-sort is not enabled');
      return;
    }

    if (this.#currentSort.length >= maxSortFields) {
      this.#logger.warn(`Maximum sort fields (${maxSortFields}) reached`);
      return;
    }

    // 检查字段是否已存在
    const existingIndex = this.#currentSort.findIndex(s => s.field === field);
    if (existingIndex !== -1) {
      // 更新方向
      this.#currentSort[existingIndex].direction = direction;
    } else {
      // 添加新字段
      this.#currentSort.push({ field, direction });
    }

    this.#logger.info(`Sort configuration updated:`, this.#currentSort);

    // 触发排序改变事件
    this.#scopedEventBus?.emit(
      PDFSorterFeatureConfig.config.events.local.SORT_CHANGED,
      this.#currentSort
    );

    // 应用排序
    this.applySort();
  }

  /**
   * 应用当前排序
   */
  applySort() {
    if (!this.#enabled) {
      this.#logger.warn('Cannot apply sort: feature is disabled');
      return;
    }

    this.#logger.info('Applying sort:', this.#currentSort);

    // TODO: 实际的排序逻辑
    // 1. 获取当前列表数据
    // 2. 按照排序配置进行排序
    // 3. 更新表格显示

    // 触发全局事件（通知其他功能域）
    this.#scopedEventBus?.emitGlobal(
      PDFSorterFeatureConfig.config.events.global.SORT_APPLIED,
      this.#currentSort
    );
  }

  /**
   * 获取当前排序配置
   * @returns {Array<{field: string, direction: 'asc'|'desc'}>}
   */
  getCurrentSort() {
    return [...this.#currentSort];
  }

  /**
   * 清除排序
   */
  clearSort() {
    if (!this.#enabled) {
      this.#logger.warn('Cannot clear sort: feature is disabled');
      return;
    }

    this.#logger.info('Clearing sort');

    // 重置为默认排序
    this.#initializeDefaultSort();

    // 触发排序改变事件
    this.#scopedEventBus?.emit(
      PDFSorterFeatureConfig.config.events.local.SORT_CHANGED,
      this.#currentSort
    );

    // 应用排序
    this.applySort();
  }

  /**
   * 保存排序方案
   * @param {string} name - 排序方案名称
   */
  saveSortScheme(name) {
    if (!this.#enabled) {
      this.#logger.warn('Cannot save sort scheme: feature is disabled');
      return;
    }

    const scheme = {
      name,
      sort: [...this.#currentSort],
      createdAt: new Date().toISOString()
    };

    this.#logger.info('Saving sort scheme:', scheme);

    // TODO: 将排序方案保存到本地存储或后端

    // 触发保存事件
    this.#scopedEventBus?.emit(
      PDFSorterFeatureConfig.config.events.local.SORT_SAVED,
      scheme
    );
  }

  /**
   * 加载排序方案
   * @param {string} name - 排序方案名称
   */
  loadSortScheme(name) {
    if (!this.#enabled) {
      this.#logger.warn('Cannot load sort scheme: feature is disabled');
      return;
    }

    this.#logger.info('Loading sort scheme:', name);

    // TODO: 从本地存储或后端加载排序方案

    // 触发加载事件
    this.#scopedEventBus?.emit(
      PDFSorterFeatureConfig.config.events.local.SORT_LOADED,
      { name }
    );
  }
}

/**
 * 创建 PDF Sorter 功能域实例的工厂函数
 * @returns {PDFSorterFeature}
 */
export function createPDFSorterFeature() {
  return new PDFSorterFeature();
}

export default PDFSorterFeature;
