/**
 * Filter Feature - PDF高级筛选功能插件
 * 提供高级筛选条件构建和筛选管理
 */

import { FilterManager } from './services/filter-manager.js';
import { FilterPanel } from './components/filter-panel.js';
import { FilterBuilder } from './components/filter-builder-v2.js';
import { PresetDropdown } from './components/preset-dropdown.js';

// 导入样式
import './styles/filter-panel.css';
import './styles/preset-dropdown.css';

export class FilterFeature {
  name = 'filter';
  version = '2.0.0';
  dependencies = [];

  #context = null;
  #logger = null;
  #scopedEventBus = null;  // 内部事件总线（带@filter/前缀）
  #globalEventBus = null;  // 全局事件总线（跨Feature通信）
  #filterManager = null;
  #filterPanel = null;
  #filterPanelContainer = null;
  #filterBuilder = null;
  #presetDropdown = null;
  #unsubscribers = [];

  /**
   * 安装插件
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[FilterFeature] Installing v2.0.0 (advanced filters only)...');

    try {
      // 1. 初始化FilterManager (使用globalEventBus发送跨Feature事件)
      this.#filterManager = new FilterManager(this.#logger, this.#globalEventBus);

      // 2. 创建筛选面板DOM
      this.#createFilterPanel();

      // 3. 初始化筛选面板组件
      this.#initializeFilterComponents();

      // 4. 监听事件
      this.#setupEventListeners();

      // 5. 订阅搜索事件（监听search插件的搜索请求）
      this.#subscribeToSearchEvents();

      // 6. 订阅PDF列表数据更新
      this.#subscribeToPdfList();

      this.#logger.info('[FilterFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[FilterFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info('[FilterFeature] Uninstalling...');

    // 取消所有事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁组件
    if (this.#filterPanel) {
      this.#filterPanel.destroy();
    }

    if (this.#filterBuilder) {
      this.#filterBuilder.destroy();
    }

    if (this.#presetDropdown) {
      this.#presetDropdown.destroy();
    }

    // 移除DOM
    if (this.#filterPanelContainer) {
      this.#filterPanelContainer.remove();
    }

    // 重置管理器
    if (this.#filterManager) {
      this.#filterManager.reset();
    }

    this.#logger.info('[FilterFeature] Uninstalled');
  }

  /**
   * 创建筛选面板DOM
   * @private
   */
  #createFilterPanel() {
    this.#filterPanelContainer = document.createElement('div');
    this.#filterPanelContainer.className = 'filter-container';
    this.#filterPanelContainer.innerHTML = `
      <div class="filter-builder-wrapper"></div>
    `;

    // 插入到搜索面板下方
    const searchPanel = document.querySelector('.search-panel');
    if (searchPanel) {
      searchPanel.insertAdjacentElement('afterend', this.#filterPanelContainer);
    } else {
      // 如果没有搜索面板，插入到body前面
      document.body.insertBefore(this.#filterPanelContainer, document.body.firstChild);
    }

    this.#logger.debug('[FilterFeature] Filter panel container created (no buttons, only builder)');
  }

  /**
   * 初始化筛选面板组件
   * @private
   */
  #initializeFilterComponents() {
    // 不再创建FilterPanel，按钮已移到SearchBar
    // 只创建FilterBuilder（高级筛选构建器）
    if (!this.#filterBuilder) {
      const builderWrapper = this.#filterPanelContainer.querySelector('.filter-builder-wrapper');
      this.#filterBuilder = new FilterBuilder(
        this.#logger,
        this.#scopedEventBus,
        this.#filterManager
      );
      this.#filterBuilder.render(builderWrapper);
    }

    this.#logger.info('[FilterFeature] Filter components initialized (no panel buttons)');
  }

  /**
   * 设置事件监听（内部事件）
   * @private
   */
  #setupEventListeners() {
    // 监听全局打开高级筛选事件（来自SearchBar）
    const unsubOpen = this.#globalEventBus.on('filter:advanced:open', () => {
      this.#handleAdvancedFilter();
    });
    this.#unsubscribers.push(unsubOpen);

    // 监听全局保存预设事件（来自SearchBar）
    const unsubSave = this.#globalEventBus.on('filter:preset:save', (data) => {
      this.#handlePresetSave(data.presetName);
    });
    this.#unsubscribers.push(unsubSave);

    this.#logger.info('[FilterFeature] Event listeners setup (listening to global events)');
  }

  /**
   * 订阅搜索事件（监听search插件）
   * @private
   */
  #subscribeToSearchEvents() {
    // 监听搜索请求（来自search插件）
    const unsubSearch = this.#globalEventBus.on('search:query:requested', (data) => {
      this.#logger.info('[FilterFeature] Search query received', data);
      this.#handleSearchQuery(data.searchText);
    });
    this.#unsubscribers.push(unsubSearch);

    // 监听清除请求
    const unsubClear = this.#globalEventBus.on('search:clear:requested', () => {
      this.#logger.info('[FilterFeature] Clear request received');
      this.#handleClearFilter();
    });
    this.#unsubscribers.push(unsubClear);

    this.#logger.info('[FilterFeature] Subscribed to search events (local mode)');
  }

  /**
   * 订阅PDF列表数据更新
   * @private
   */
  #subscribeToPdfList() {
    // 监听PDF列表加载完成事件
    const unsubListLoaded = this.#globalEventBus.on('@pdf-list/data:load:completed', (data) => {
      this.#logger.info('[FilterFeature] PDF list data received', {
        count: data.items?.length || 0
      });

      // 将数据存储到FilterManager供本地筛选使用
      if (data.items) {
        this.#filterManager.setDataSource(data.items);
        this.#logger.info('[FilterFeature] Data cached for local filtering');
      }
    });
    this.#unsubscribers.push(unsubListLoaded);

    this.#logger.info('[FilterFeature] Subscribed to PDF list events (local caching mode)');
  }

  /**
   * 处理搜索查询（本地筛选）
   * @private
   */
  #handleSearchQuery(searchText) {
    try {
      const query = searchText?.trim() || '';

      this.#logger.info('[FilterFeature] Processing search query (local filtering)', {
        searchText: query || '(empty - will show all)'
      });

      // 使用本地FilterManager进行筛选
      let filteredData;
      if (!query) {
        // 空搜索显示全部数据
        filteredData = this.#filterManager.clearFilter();
      } else {
        // 执行关键词搜索（在filename, tags, notes字段中搜索）
        filteredData = this.#filterManager.quickSearch(query);
      }

      this.#logger.info('[FilterFeature] Search completed', {
        resultCount: filteredData.length,
        searchText: query
      });

      // 发出筛选结果事件
      this.#globalEventBus.emit('filter:results:updated', {
        results: filteredData,
        count: filteredData.length,
        searchText: query
      });

    } catch (error) {
      this.#logger.error('[FilterFeature] Search failed', error);
      // 发出空结果
      this.#globalEventBus.emit('filter:results:updated', {
        results: [],
        count: 0,
        searchText: searchText || ''
      });
    }
  }

  /**
   * 处理清除筛选
   * @private
   */
  #handleClearFilter() {
    try {
      this.#logger.info('[FilterFeature] Filter cleared, showing all data');

      // 清除筛选，显示全部数据
      const allData = this.#filterManager.clearFilter();

      // 发出筛选结果事件
      this.#globalEventBus.emit('filter:results:updated', {
        results: allData,
        count: allData.length,
        searchText: ''
      });

      this.#logger.info('[FilterFeature] All data displayed', { count: allData.length });
    } catch (error) {
      this.#logger.error('[FilterFeature] Clear failed', error);
      // 发出空结果
      this.#globalEventBus.emit('filter:results:updated', {
        results: [],
        count: 0,
        searchText: ''
      });
    }
  }

  /**
   * 处理高级筛选（切换显示/隐藏）
   * @private
   */
  #handleAdvancedFilter() {
    this.#logger.info('[FilterFeature] Advanced filter button clicked');

    // 切换FilterBuilder显示/隐藏
    if (this.#filterBuilder) {
      if (this.#filterBuilder.isVisible()) {
        this.#filterBuilder.hide();
        this.#logger.info('[FilterFeature] FilterBuilder hidden');
      } else {
        this.#filterBuilder.show();
        this.#logger.info('[FilterFeature] FilterBuilder shown');
      }
    } else {
      this.#logger.error('[FilterFeature] FilterBuilder not initialized');
    }
  }

  /**
   * 处理保存预设
   * @private
   */
  #handlePresetSave(presetName) {
    this.#logger.info('[FilterFeature] Saving preset', { presetName });

    // TODO: 实现保存逻辑
    this.#globalEventBus.emit('filter:preset:saved', { presetName });
  }
}
