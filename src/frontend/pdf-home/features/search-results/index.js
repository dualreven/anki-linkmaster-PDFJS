/**
 * SearchResults Feature - 搜索结果展示功能
 * 显示和管理PDF搜索结果列表
 */

import { ResultsRenderer } from './components/results-renderer.js';
import './styles/search-results.css';

export class SearchResultsFeature {
  name = 'search-results';
  version = '1.0.0';
  dependencies = [];

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #unsubscribers = [];

  // 渲染器
  #resultsRenderer = null;
  #resultsContainer = null;
  #headerElement = null;

  // 当前结果
  #currentResults = [];

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SearchResultsFeature] Installing...');

    try {
      // 1. 创建结果容器
      this.#createResultsContainer();

      // 2. 初始化渲染器
      this.#resultsRenderer = new ResultsRenderer(this.#logger, this.#scopedEventBus);

      // 3. 监听筛选结果更新事件（来自filter插件）
      this.#subscribeToFilterEvents();

      // 4. 监听条目事件（转发到全局）
      this.#setupEventBridge();

      // 5. 渲染初始空状态
      this.#resultsRenderer.render(this.#resultsContainer, []);

      this.#logger.info('[SearchResultsFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SearchResultsFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[SearchResultsFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁渲染器
    if (this.#resultsRenderer) {
      this.#resultsRenderer.destroy();
      this.#resultsRenderer = null;
    }

    // 移除DOM
    if (this.#resultsContainer) {
      this.#resultsContainer.remove();
      this.#resultsContainer = null;
    }

    this.#logger.info('[SearchResultsFeature] Uninstalled');
  }

  /**
   * 创建结果容器
   * @private
   */
  #createResultsContainer() {
    // 查找现有容器
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) {
      throw new Error('Main content container not found');
    }

    // 获取或创建header
    this.#headerElement = mainContent.querySelector('.search-results-header');
    if (!this.#headerElement) {
      throw new Error('Search results header not found in index.html');
    }

    // 在header中添加批量操作按钮
    this.#createBatchActionButtons();

    // 获取或创建结果容器
    this.#resultsContainer = mainContent.querySelector('#pdf-table-container');
    if (!this.#resultsContainer) {
      // 创建新容器（如果index.html中没有）
      this.#resultsContainer = document.createElement('div');
      this.#resultsContainer.id = 'pdf-table-container';
      this.#resultsContainer.className = 'search-results-container';

      // 插入到header后面
      this.#headerElement.insertAdjacentElement('afterend', this.#resultsContainer);
    }

    this.#logger.debug('[SearchResultsFeature] Results container created');
  }

  /**
   * 创建批量操作按钮
   * @private
   */
  #createBatchActionButtons() {
    // 检查是否已存在
    if (this.#headerElement.querySelector('.batch-actions')) {
      return;
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'batch-actions';
    actionsDiv.innerHTML = `
      <button class="batch-action-btn batch-btn-review" title="批量复习选中项">
        🔁 复习
      </button>
      <button class="batch-action-btn batch-btn-read" title="批量阅读选中项">
        📖 阅读
      </button>
      <button class="batch-action-btn batch-btn-edit" title="批量编辑选中项">
        ✏️ 编辑
      </button>
      <button class="batch-action-btn batch-btn-delete" title="批量删除选中项">
        🗑️ 删除
      </button>
    `;

    this.#headerElement.appendChild(actionsDiv);
    this.#logger.debug('[SearchResultsFeature] Batch action buttons created');
  }

  /**
   * 订阅筛选事件
   * @private
   */
  #subscribeToFilterEvents() {
    // 监听搜索结果更新（来自search插件）
    const unsubSearchResults = this.#globalEventBus.on('search:results:updated', (data) => {
      this.#logger.info('[SearchResultsFeature] Search results received', {
        count: data.count,
        searchText: data.searchText
      });

      this.#handleResultsUpdate(data.records, data.count, data.searchText);
    });
    this.#unsubscribers.push(unsubSearchResults);

    // 监听筛选结果更新（来自filter插件）
    const unsubResults = this.#globalEventBus.on('filter:results:updated', (data) => {
      this.#logger.info('[SearchResultsFeature] Filter results received', {
        count: data.count,
        searchText: data.searchText
      });

      this.#handleResultsUpdate(data.results, data.count, data.searchText);
    });
    this.#unsubscribers.push(unsubResults);

    this.#logger.info('[SearchResultsFeature] Subscribed to search and filter events');
  }

  /**
   * 设置事件桥接（内部事件 -> 全局事件）
   * @private
   */
  #setupEventBridge() {
    // 条目选中事件 -> 转发到全局
    const unsubSelected = this.#scopedEventBus.on('results:item:selected', (data) => {
      this.#logger.debug('[SearchResultsFeature] Item selected', data);
      this.#globalEventBus.emit('search-results:item:selected', data);
    });
    this.#unsubscribers.push(unsubSelected);

    // 条目打开事件 -> 转发到全局
    const unsubOpen = this.#scopedEventBus.on('results:item:open', (data) => {
      this.#logger.info('[SearchResultsFeature] Item open requested', data);
      this.#globalEventBus.emit('search-results:item:open', data);
    });
    this.#unsubscribers.push(unsubOpen);

    this.#logger.info('[SearchResultsFeature] Event bridge setup');
  }

  /**
   * 处理结果更新
   * @private
   */
  #handleResultsUpdate(results, count, searchText) {
    this.#currentResults = results || [];

    this.#logger.info('[SearchResultsFeature] ===== 处理结果更新 =====', {
      count,
      searchText,
      resultsLength: this.#currentResults.length,
      hasContainer: !!this.#resultsContainer,
      firstItem: this.#currentResults[0]
    });

    // 更新header统计
    this.#updateHeaderStats(count, searchText);

    // 渲染结果
    this.#resultsRenderer.render(this.#resultsContainer, this.#currentResults);

    // 通知search插件更新统计
    this.#globalEventBus.emit('search:results:updated', {
      count,
      hasResults: count > 0
    });
  }

  /**
   * 更新header统计信息
   * @private
   */
  #updateHeaderStats(count, searchText) {
    const countBadge = this.#headerElement.querySelector('.result-count-badge');
    if (countBadge) {
      countBadge.textContent = `共 ${count} 条`;

      // 添加搜索文本提示
      if (searchText) {
        countBadge.setAttribute('title', `搜索: "${searchText}"`);
      } else {
        countBadge.removeAttribute('title');
      }
    }
  }
}

export default SearchResultsFeature;
