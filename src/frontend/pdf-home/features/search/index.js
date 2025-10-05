/**
 * Search Feature - PDF搜索功能插件
 * 面向用户的搜索起点，提供搜索框UI和基础搜索逻辑
 */

import { SearchBar } from './components/search-bar.js';

// 导入样式
import './styles/search-bar.css';
import './styles/search-panel.css';

export class SearchFeature {
  name = 'search';
  version = '1.0.0';
  dependencies = [];

  #context = null;
  #logger = null;
  #scopedEventBus = null;  // 内部事件总线（带@search/前缀）
  #globalEventBus = null;  // 全局事件总线（跨Feature通信）
  #searchBar = null;
  #searchPanel = null;
  #unsubscribers = [];

  /**
   * 安装插件
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SearchFeature] Installing...');

    try {
      // 1. 创建搜索面板DOM
      this.#createSearchPanel();

      // 2. 初始化SearchBar组件（使用scopedEventBus用于内部事件）
      this.#searchBar = new SearchBar(this.#logger, this.#scopedEventBus);
      this.#searchBar.render(this.#searchPanel.querySelector('.search-panel-content'));

      // 3. 监听内部事件，转发到全局EventBus
      this.#setupEventBridge();

      // 4. 监听全局事件（搜索结果更新）
      this.#setupGlobalEventListeners();

      this.#logger.info('[SearchFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SearchFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info('[SearchFeature] Uninstalling...');

    // 取消所有事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁组件
    if (this.#searchBar) {
      this.#searchBar.destroy();
      this.#searchBar = null;
    }

    // 移除DOM
    if (this.#searchPanel) {
      this.#searchPanel.remove();
      this.#searchPanel = null;
    }

    this.#logger.info('[SearchFeature] Uninstalled');
  }

  /**
   * 创建搜索面板DOM
   * @private
   */
  #createSearchPanel() {
    this.#searchPanel = document.createElement('div');
    this.#searchPanel.className = 'search-panel active';
    this.#searchPanel.innerHTML = `
      <div class="search-panel-content">
        <!-- SearchBar组件将在这里渲染 -->
      </div>
    `;

    // 插入到body顶部（fixed定位）
    document.body.insertBefore(this.#searchPanel, document.body.firstChild);

    this.#logger.debug('[SearchFeature] Search panel created');
  }

  /**
   * 设置事件桥接（内部事件 -> 全局事件）
   * @private
   */
  #setupEventBridge() {
    // 搜索请求 -> 转发到全局
    const unsubSearch = this.#scopedEventBus.on('search:query:requested', (data) => {
      this.#logger.info('[SearchFeature] Forwarding search query to global', data);
      this.#globalEventBus.emit('search:query:requested', data);
    });
    this.#unsubscribers.push(unsubSearch);

    // 清除请求 -> 转发到全局
    const unsubClear = this.#scopedEventBus.on('search:clear:requested', () => {
      this.#logger.info('[SearchFeature] Forwarding clear request to global');
      this.#globalEventBus.emit('search:clear:requested');
    });
    this.#unsubscribers.push(unsubClear);

    // 添加按钮点击 -> 转发到全局
    const unsubAdd = this.#scopedEventBus.on('search:add:clicked', () => {
      this.#logger.info('[SearchFeature] Forwarding add click to global');
      this.#globalEventBus.emit('search:add:clicked');
    });
    this.#unsubscribers.push(unsubAdd);

    // 排序按钮点击 -> 转发到全局
    const unsubSort = this.#scopedEventBus.on('search:sort:clicked', () => {
      this.#logger.info('[SearchFeature] Forwarding sort click to global');
      this.#globalEventBus.emit('search:sort:clicked');
    });
    this.#unsubscribers.push(unsubSort);

    // 高级筛选按钮点击 -> 转发到全局
    const unsubAdvanced = this.#scopedEventBus.on('search:advanced:clicked', () => {
      this.#logger.info('[SearchFeature] Forwarding advanced click to global');
      this.#globalEventBus.emit('filter:advanced:open');
    });
    this.#unsubscribers.push(unsubAdvanced);

    // 保存预设 -> 转发到全局
    const unsubPreset = this.#scopedEventBus.on('search:preset:save', (data) => {
      this.#logger.info('[SearchFeature] Forwarding preset save to global', data);
      this.#globalEventBus.emit('filter:preset:save', data);
    });
    this.#unsubscribers.push(unsubPreset);
  }

  /**
   * 监听全局事件
   * @private
   */
  #setupGlobalEventListeners() {
    // 监听搜索结果更新
    const unsubResults = this.#globalEventBus.on('search:results:updated', (data) => {
      this.#logger.debug('[SearchFeature] Search results updated', data);

      if (this.#searchBar) {
        this.#searchBar.updateStats({
          count: data.count || 0,
          hasResults: data.count > 0
        });
      }
    });
    this.#unsubscribers.push(unsubResults);
  }
}
