/**
 * @file PDF Sorter 功能域入口
 * 详细说明见：`docs/standards/pdf-sorter-feature.md`
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
 * PDFListFeature 已移除 - 现在使用 SearchResultsFeature
 * registry.register(new PDFSorterFeature()); // 依赖 search-results
 * await registry.installAll();
 */

import { PDFSorterFeatureConfig } from "./feature.config.js";
import { getLogger } from "../../../common/utils/logger.js";
import { SEARCH_EVENTS } from "../../../common/event/event-constants.js";
import { showError } from "../../../common/utils/notification.js";
import { SortManager } from "./services/sort-manager.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";
import { createSorterUIComponents } from "./pdf-sorter-ui.js";
import { bindSorterButton, registerEventListeners, subscribeToSearchResultsUpdated } from "./pdf-sorter-event-wiring.js";
import { handleApplySort } from "./pdf-sorter-event-handlers.js";
import {
  addSort,
  applyCurrentSort,
  clearSort,
  getDefaultSortFromConfig,
  loadSortScheme,
  saveSortScheme,
  setSort,
} from "./pdf-sorter-public-api.js";

/**
 * PDF Sorter 功能域类
 * @class PDFSorterFeature
 * @implements {IFeature}
 */
export class PDFSorterFeature {
  /** @type {import('../../../common/micro-service/feature-registry.js').FeatureContext|null} */
  #context = null;
  /** @type {import('../../common/event/scoped-event-bus.js').ScopedEventBus|null} */
  #scopedEventBus = null;
  /** @type {EventBus|null} */
  #globalEventBus = null;
  /** @type {import('../../common/utils/logger.js').Logger|null} */
  #logger = null;
  /** @type {import("./components/sorter-panel.js").SorterPanel|null} */
  #sorterPanel = null;
  /** @type {import("./components/mode-selector.js").ModeSelector|null} */
  #modeSelector = null;
  /** @type {import("./components/multi-sort-builder.js").MultiSortBuilder|null} */
  #multiSortBuilder = null;
  /** @type {import("./components/weighted-sort-editor.js").WeightedSortEditor|null} */
  #weightedSortEditor = null;
  /** @type {SortManager|null} */
  #sortManager = null;
  /** @type {Array<{field: string, direction: 'asc'|'desc'}>} */
  #currentSort = [];
  /** @type {{ add:(fn:Function)=>void, clear:()=>void, size:()=>number }|null} */
  #subscriptionBag = null;
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
    // 标记已使用，避免 no-unused-private-class-members
    void this.#context;

    // 初始化订阅袋（统一管理本 Feature 的所有取消订阅函数）
    this.#subscriptionBag = createSubscriptionBag({ loggerName: `Feature.${this.name}.Subscriptions` });

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    try {
      // 1. 初始化核心服务
      this.#sortManager = new SortManager(this.#logger, this.#globalEventBus);

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

      // 3. 清理排序配置
      this.#currentSort = [];
      this.#sortManager = null;

      // 4. 清理订阅袋（彻底卸载时释放）
      if (this.#subscriptionBag) {
        this.#subscriptionBag.clear();
        this.#subscriptionBag = null;
      }

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
    this.#currentSort = getDefaultSortFromConfig(PDFSorterFeatureConfig.config);
    this.#logger.debug("Default sort initialized:", this.#currentSort);
  }

  #getPublicApiContext() {
    return {
      enabled: this.#enabled,
      logger: this.#logger,
      config: PDFSorterFeatureConfig.config,
      sortManager: this.#sortManager,
      scopedEventBus: this.#scopedEventBus,
      getCurrentSort: () => this.#currentSort,
      setCurrentSort: (v) => { this.#currentSort = v; },
    };
  }

  /**
   * 创建UI组件
   * @private
   */
  #createUIComponents() {
    const ui = createSorterUIComponents({
      logger: this.#logger,
      scopedEventBus: this.#scopedEventBus,
      config: PDFSorterFeatureConfig.config,
    });
    this.#sorterPanel = ui.sorterPanel;
    this.#modeSelector = ui.modeSelector;
    this.#multiSortBuilder = ui.multiSortBuilder;
    this.#weightedSortEditor = ui.weightedSortEditor;
  }

  /**
   * 绑定排序按钮事件
   * @private
   */
  #bindSorterButton() {
    bindSorterButton({
      globalEventBus: this.#globalEventBus,
      sorterPanel: this.#sorterPanel,
      subscriptionBag: this.#subscriptionBag,
      logger: this.#logger,
    });
  }

  /**
   * 注册事件监听器
   * @private
   */
  #registerEventListeners() {
    registerEventListeners({
      scopedEventBus: this.#scopedEventBus,
      subscriptionBag: this.#subscriptionBag,
      logger: this.#logger,
      onModeChanged: (mode) => this.#handleModeChange(mode),
      onApplySort: (data) => this.#handleApplySort(data),
      onClearSort: () => this.#handleClearSort(),
    });
  }

  /**
   * 订阅PDF列表数据更新
   * @private
   */
  #subscribeToPdfList() {
    subscribeToSearchResultsUpdated({
      globalEventBus: this.#globalEventBus,
      subscriptionBag: this.#subscriptionBag,
      logger: this.#logger,
      sortManager: this.#sortManager,
      applySort: () => this.applySort(),
    });
  }

  /**
   * 处理模式变更
   * @param {number} mode - 新模式
   * @private
   */
  #handleModeChange(mode) {
    this.#logger.info(`[PDFSorterFeature] Handling mode change: ${mode}`);

    // 更新排序管理器模式
    if (this.#sortManager) {
      this.#sortManager.setMode(mode);
    }

    // 当切换到“默认排序”模式（模式0）时，应用默认排序：按标题字母升序（SQL层）
    if (mode === 0) {
      try {
        this.#initializeDefaultSort();
        // 触发一次后端搜索（携带 sort 规则，交由 SQL 排序）
        const sortRules = [{ field: "title", direction: "asc" }];
        this.#globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, {
          searchText: "", // 使用当前搜索词：由 SearchManager 读取内部状态
          sort: sortRules
        });
        // 前端仍同步一次（以便本地表格状态一致），但核心排序由 SQL 执行
        this.applySort();
      } catch (e) {
        this.#logger?.warn("[PDFSorterFeature] Failed to apply default sort on mode change", e);
      }
    }
  }

  /**
   * 处理应用排序
   * @param {Object} data - 排序数据
   * @private
   */
  async #handleApplySort(data) {
    await handleApplySort({
      data,
      sortManager: this.#sortManager,
      globalEventBus: this.#globalEventBus,
      logger: this.#logger,
      showError,
    });
  }

  /**
   * 处理清除排序
   * @private
   */
  #handleClearSort() {
    this.#logger.info("[PDFSorterFeature] Handling clear sort");

    try {
      void this.#sortManager.clearSort();
    } catch (error) {
      this.#logger.error("[PDFSorterFeature] Failed to clear sort", error);
    }
  }

  /**
   * 取消事件监听器
   * @private
   */
  #unregisterEventListeners() {
    if (!this.#subscriptionBag) {
      this.#logger.debug("No subscription bag to clear for PDFSorterFeature");
      return;
    }

    this.#subscriptionBag.clear();
    this.#logger.debug("All event listeners unregistered");
  }

  // ==================== 公开方法（供外部调用） ====================

  /**
   * 设置排序配置
   * @param {string} field - 排序字段
   * @param {'asc'|'desc'} direction - 排序方向
   */
  setSort(field, direction = "asc") {
    const updated = setSort(this.#getPublicApiContext(), field, direction);
    if (updated) { this.applySort(); }
  }

  /**
   * 添加排序字段（多字段排序）
   * @param {string} field - 排序字段
   * @param {'asc'|'desc'} direction - 排序方向
   */
  addSort(field, direction = "asc") {
    const updated = addSort(this.#getPublicApiContext(), field, direction);
    if (updated) { this.applySort(); }
  }

  /**
   * 应用当前排序
   */
  applySort() {
    applyCurrentSort(this.#getPublicApiContext());
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
    const updated = clearSort(this.#getPublicApiContext());
    if (updated) { this.applySort(); }
  }

  /**
   * 保存排序方案
   * @param {string} name - 排序方案名称
   */
  saveSortScheme(name) {
    saveSortScheme(this.#getPublicApiContext(), name);
  }

  /**
   * 加载排序方案
   * @param {string} name - 排序方案名称
   */
  loadSortScheme(name) {
    loadSortScheme(this.#getPublicApiContext(), name);
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

