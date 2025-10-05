/**
 * SavedFilters Feature - 已存搜索条件插件
 * 提供保存和管理搜索条件的功能
 */

import { SavedFiltersFeatureConfig } from './feature.config.js';

// 导入样式
import './styles/saved-filters.css';

export class SavedFiltersFeature {
  name = SavedFiltersFeatureConfig.name;
  version = SavedFiltersFeatureConfig.version;
  dependencies = SavedFiltersFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #config = SavedFiltersFeatureConfig.config;
  #container = null;
  #unsubscribers = [];

  /**
   * 安装插件
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info(`[SavedFiltersFeature] Installing v${this.version}...`);

    try {
      // 1. 创建UI容器
      this.#createContainer();

      // 2. 设置事件监听（逻辑留空）
      this.#setupEventListeners();

      this.#logger.info('[SavedFiltersFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SavedFiltersFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info('[SavedFiltersFeature] Uninstalling...');

    // 取消所有事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 移除DOM
    if (this.#container) {
      this.#container.remove();
    }

    this.#logger.info('[SavedFiltersFeature] Uninstalled');
  }

  /**
   * 创建UI容器
   * @private
   */
  #createContainer() {
    this.#container = document.createElement('div');
    this.#container.className = 'saved-filters-section sidebar-section';
    this.#container.innerHTML = `
      <div class="saved-filters-header">
        <h3 class="saved-filters-title">📌 已存搜索条件</h3>
        <button class="saved-filters-add-btn" title="添加当前条件">+</button>
      </div>
      <div class="saved-filters-list">
        <!-- 搜索条件列表将在这里显示 -->
        <div class="saved-filters-empty">暂无保存的搜索条件</div>
      </div>
    `;

    // 插入到侧边栏面板的开头（在所有section之前）
    const sidebarPanel = document.querySelector('.sidebar-panel');
    if (sidebarPanel) {
      sidebarPanel.insertBefore(this.#container, sidebarPanel.firstChild);
      this.#logger.debug('[SavedFiltersFeature] Container inserted at top of sidebar');
    } else {
      this.#logger.warn('[SavedFiltersFeature] Sidebar panel not found');
    }
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // TODO: 逻辑留空，后续实现
    // - 监听添加按钮点击
    // - 监听条件项点击
    // - 监听删除按钮点击
    // - 监听全局保存条件事件

    this.#logger.debug('[SavedFiltersFeature] Event listeners setup (empty logic)');
  }

  /**
   * 获取保存的搜索条件列表
   * @returns {Array} 搜索条件列表
   * @private
   */
  #getSavedFilters() {
    // TODO: 从 LocalStorage 读取
    return [];
  }

  /**
   * 保存搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #saveFilter(filter) {
    // TODO: 保存到 LocalStorage
    this.#logger.debug('[SavedFiltersFeature] saveFilter called (empty logic)', filter);
  }

  /**
   * 删除搜索条件
   * @param {string} filterId - 条件ID
   * @private
   */
  #deleteFilter(filterId) {
    // TODO: 从 LocalStorage 删除
    this.#logger.debug('[SavedFiltersFeature] deleteFilter called (empty logic)', filterId);
  }

  /**
   * 应用搜索条件
   * @param {Object} filter - 搜索条件对象
   * @private
   */
  #applyFilter(filter) {
    // TODO: 发送全局事件通知其他Feature
    this.#logger.debug('[SavedFiltersFeature] applyFilter called (empty logic)', filter);
  }

  /**
   * 渲染搜索条件列表
   * @private
   */
  #renderFilterList() {
    // TODO: 渲染UI
    this.#logger.debug('[SavedFiltersFeature] renderFilterList called (empty logic)');
  }
}
