/**
 * Filter Feature - PDF筛选和搜索功能插件
 */

import { FilterManager } from './services/filter-manager.js';
import { FilterSearchBar } from './components/filter-search-bar.js';
import { FilterBuilder } from './components/filter-builder-v2.js';
import { PresetDropdown } from './components/preset-dropdown.js';

// 导入样式
import './styles/preset-dropdown.css';

export class FilterFeature {
  name = 'filter';
  version = '1.0.0';
  dependencies = [];

  #context = null;
  #logger = null;
  #scopedEventBus = null;  // 内部事件总线（带@filter/前缀）
  #globalEventBus = null;  // 全局事件总线（跨Feature通信）
  #filterManager = null;
  #searchBar = null;
  #searchDialog = null;
  #filterBuilder = null;
  #presetDropdown = null;
  #pdfTable = null;
  #unsubscribers = [];
  #escKeyHandler = null;

  /**
   * 安装插件
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[FilterFeature] Installing...');

    try {
      // 1. 初始化FilterManager (使用globalEventBus发送跨Feature事件)
      this.#filterManager = new FilterManager(this.#logger, this.#globalEventBus);

      // 2. 创建搜索对话框DOM
      this.#createSearchDialog();

      // 3. 绑定搜索按钮事件（已废弃）
      this.#bindSearchButton();

      // 3.5. 绑定预设按钮事件
      this.#bindPresetButton();

      // 3.6. 初始化搜索栏组件（始终显示）
      this.#initializeSearchComponents();

      // 4. 监听事件
      this.#setupEventListeners();

      // 5. 订阅PDF列表数据更新
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
    if (this.#searchBar) {
      this.#searchBar.destroy();
    }

    if (this.#filterBuilder) {
      this.#filterBuilder.destroy();
    }

    if (this.#presetDropdown) {
      this.#presetDropdown.destroy();
    }

    // 移除搜索栏
    if (this.#searchDialog) {
      this.#searchDialog.remove();
    }

    // 重置管理器
    if (this.#filterManager) {
      this.#filterManager.reset();
    }

    this.#logger.info('[FilterFeature] Uninstalled');
  }

  /**
   * 创建搜索栏DOM（吸附在header下方，始终显示）
   * @private
   */
  #createSearchDialog() {
    this.#searchDialog = document.createElement('div');
    this.#searchDialog.className = 'filter-search-panel active';  // 直接添加active类
    this.#searchDialog.innerHTML = `
      <div class="filter-search-panel-content">
        <div class="filter-search-container"></div>
        <div class="filter-builder-container"></div>
      </div>
    `;

    // 插入到header之后
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(this.#searchDialog, header.nextSibling);
    } else if (header) {
      header.parentNode.appendChild(this.#searchDialog);
    } else {
      document.body.insertBefore(this.#searchDialog, document.body.firstChild);
    }

    // 不再需要ESC键关闭功能

    this.#logger.info('[FilterFeature] Search panel created (always visible)');
  }

  /**
   * 绑定搜索按钮（已废弃，搜索面板始终显示）
   * @private
   */
  #bindSearchButton() {
    // 搜索面板现在始终显示，不需要切换按钮
    this.#logger.info('[FilterFeature] Search panel is always visible, no toggle needed');
  }

  /**
   * 绑定预设按钮
   * @private
   */
  #bindPresetButton() {
    // 创建预设下拉菜单组件
    this.#presetDropdown = new PresetDropdown(this.#logger, this.#scopedEventBus);
    this.#presetDropdown.render('preset-filter-btn');

    this.#logger.info('[FilterFeature] Preset button bound');
  }

  /**
   * 初始化搜索栏组件（搜索栏始终显示）
   * @private
   */
  #initializeSearchComponents() {
    // 创建搜索栏
    if (!this.#searchBar) {
      const searchContainer = this.#searchDialog.querySelector('.filter-search-container');
      this.#searchBar = new FilterSearchBar(this.#logger, this.#scopedEventBus, {
        onAdvancedClick: () => this.#handleAdvancedFilter()
      });
      this.#searchBar.render(searchContainer);
    }

    // 创建FilterBuilder
    if (!this.#filterBuilder) {
      const builderContainer = this.#searchDialog.querySelector('.filter-builder-container');
      this.#filterBuilder = new FilterBuilder(
        this.#logger,
        this.#scopedEventBus,
        this.#filterManager
      );
      this.#filterBuilder.render(builderContainer);
    }

    // 调整表格容器位置，避免被遮挡
    this.#adjustTablePosition(true);

    this.#logger.info('[FilterFeature] Search components initialized');
  }

  /**
   * 调整表格位置避免被搜索栏遮挡
   * @private
   */
  #adjustTablePosition() {
    const tableContainer = document.getElementById('pdf-table-container');
    if (!tableContainer) {
      this.#logger.warn('[FilterFeature] Table container not found');
      return;
    }

    // 搜索栏高度约为100px，增加margin-top避免遮挡
    tableContainer.style.marginTop = '120px';
    tableContainer.style.transition = 'margin-top 0.3s ease';
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 监听搜索事件（三段式命名：module:action:status）
    // 使用scopedEventBus监听内部事件
    const unsubSearch = this.#scopedEventBus.on('filter:search:requested', (data) => {
      this.#handleSearch(data.searchText);
    });
    this.#unsubscribers.push(unsubSearch);

    // 监听清除事件
    const unsubClear = this.#scopedEventBus.on('filter:clear:requested', () => {
      this.#handleClear();
    });
    this.#unsubscribers.push(unsubClear);

    this.#logger.info('[FilterFeature] Event listeners setup');
  }

  /**
   * 订阅PDF列表数据更新
   * @private
   */
  #subscribeToPdfList() {
    // 使用globalEventBus监听跨Feature事件（pdf-list通过scopedEventBus发出，带@pdf-list/前缀）

    // 监听PDF列表加载完成
    const unsubListLoaded = this.#globalEventBus.on('@pdf-list/data:load:completed', (data) => {
      this.#logger.info('[FilterFeature] PDF list loaded', { count: data.items?.length });
      if (data.items) {
        this.#filterManager.setDataSource(data.items);
      }
    });
    this.#unsubscribers.push(unsubListLoaded);

    // 监听PDF列表数据变更
    const unsubDataChanged = this.#globalEventBus.on('@pdf-list/data:change:completed', (data) => {
      this.#logger.info('[FilterFeature] PDF list changed', { count: data.items?.length });
      if (data.items) {
        this.#filterManager.setDataSource(data.items);
      }
    });
    this.#unsubscribers.push(unsubDataChanged);

    // 监听表格就绪(用于获取table实例)
    const unsubTableReady = this.#globalEventBus.on('@pdf-list/table:readiness:completed', () => {
      this.#logger.info('[FilterFeature] PDF table is ready');
      // TODO: 获取table实例引用
    });
    this.#unsubscribers.push(unsubTableReady);
  }

  /**
   * 处理搜索
   * @private
   */
  #handleSearch(searchText) {
    try {
      const filteredData = this.#filterManager.quickSearch(searchText);
      this.#logger.info('[FilterFeature] Search executed', {
        searchText,
        resultCount: filteredData.length
      });

      // 更新表格显示(如果有table实例)
      if (this.#pdfTable) {
        this.#pdfTable.setData(filteredData);
      }

      // 更新统计信息
      if (this.#searchBar) {
        const stats = this.#filterManager.getStats();
        this.#searchBar.updateStats(stats);
      }
    } catch (error) {
      this.#logger.error('[FilterFeature] Search failed', error);
    }
  }

  /**
   * 处理清除
   * @private
   */
  #handleClear() {
    try {
      const allData = this.#filterManager.clearFilter();
      this.#logger.info('[FilterFeature] Filter cleared');

      // 恢复表格显示(如果有table实例)
      if (this.#pdfTable) {
        this.#pdfTable.setData(allData);
      }

      // 更新统计信息
      if (this.#searchBar) {
        this.#searchBar.updateStats(null);
      }
    } catch (error) {
      this.#logger.error('[FilterFeature] Clear failed', error);
    }
  }

  /**
   * 处理高级筛选
   * @private
   */
  #handleAdvancedFilter() {
    this.#logger.info('[FilterFeature] Advanced filter button clicked');

    // 显示FilterBuilder对话框
    if (this.#filterBuilder) {
      this.#filterBuilder.show();
    } else {
      this.#logger.error('[FilterFeature] FilterBuilder not initialized');
    }
  }

  /**
   * 处理筛选应用完成
   * @private
   */
  #handleFilterApplied(data) {
    this.#logger.info('[FilterFeature] Filter applied', {
      resultCount: data.resultCount
    });
  }
}
