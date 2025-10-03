/**
 * Filter Feature - PDF筛选和搜索功能插件
 */

import { FilterManager } from './services/filter-manager.js';
import { FilterSearchBar } from './components/filter-search-bar.js';
import { FilterBuilder } from './components/filter-builder-v2.js';

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

      // 3. 绑定搜索按钮事件
      this.#bindSearchButton();

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

    // 移除ESC键监听
    if (this.#escKeyHandler) {
      document.removeEventListener('keydown', this.#escKeyHandler);
    }

    // 销毁组件
    if (this.#searchBar) {
      this.#searchBar.destroy();
    }

    if (this.#filterBuilder) {
      this.#filterBuilder.destroy();
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
   * 创建搜索栏DOM（吸附在header下方）
   * @private
   */
  #createSearchDialog() {
    this.#searchDialog = document.createElement('div');
    this.#searchDialog.className = 'filter-search-panel';
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

    // ESC键关闭
    this.#escKeyHandler = (e) => {
      if (e.key === 'Escape' && this.#searchDialog.classList.contains('active')) {
        this.#hideSearchDialog();
      }
    };
    document.addEventListener('keydown', this.#escKeyHandler);

    this.#logger.info('[FilterFeature] Search panel created');
  }

  /**
   * 绑定搜索按钮
   * @private
   */
  #bindSearchButton() {
    const searchBtn = document.getElementById('search-filter-btn');
    if (!searchBtn) {
      this.#logger.warn('[FilterFeature] Search button not found');
      return;
    }

    searchBtn.addEventListener('click', () => {
      this.#logger.info('[FilterFeature] Search button clicked');
      this.#toggleSearchDialog();
    });

    this.#logger.info('[FilterFeature] Search button bound');
  }

  /**
   * 显示搜索栏
   * @private
   */
  #showSearchDialog() {
    this.#searchDialog.classList.add('active');

    // 首次显示时创建搜索栏
    if (!this.#searchBar) {
      const searchContainer = this.#searchDialog.querySelector('.filter-search-container');
      this.#searchBar = new FilterSearchBar(this.#logger, this.#scopedEventBus, {
        onAdvancedClick: () => this.#handleAdvancedFilter()
      });
      this.#searchBar.render(searchContainer);
    }

    // 首次显示时创建FilterBuilder
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

    // 聚焦搜索框
    setTimeout(() => {
      this.#searchBar.focus();
    }, 100);

    this.#logger.info('[FilterFeature] Search panel shown');
  }

  /**
   * 隐藏搜索栏
   * @private
   */
  #hideSearchDialog() {
    this.#searchDialog.classList.remove('active');

    // 隐藏FilterBuilder
    if (this.#filterBuilder) {
      this.#filterBuilder.hide();
    }

    // 恢复表格容器位置
    this.#adjustTablePosition(false);

    // 清除搜索内容和筛选
    if (this.#searchBar) {
      this.#searchBar.setSearchText('');
    }
    this.#handleClear();

    this.#logger.info('[FilterFeature] Search panel hidden');
  }

  /**
   * 调整表格位置避免被搜索栏遮挡
   * @param {boolean} show - true显示搜索栏，false隐藏搜索栏
   * @private
   */
  #adjustTablePosition(show) {
    const tableContainer = document.getElementById('pdf-table-container');
    if (!tableContainer) {
      this.#logger.warn('[FilterFeature] Table container not found');
      return;
    }

    if (show) {
      // 搜索栏高度约为100px，增加margin-top避免遮挡
      tableContainer.style.marginTop = '120px';
      tableContainer.style.transition = 'margin-top 0.3s ease';
    } else {
      // 恢复原始margin
      tableContainer.style.marginTop = '0';
    }
  }

  /**
   * 切换搜索栏显示/隐藏
   * @private
   */
  #toggleSearchDialog() {
    if (this.#searchDialog.classList.contains('active')) {
      this.#hideSearchDialog();
    } else {
      this.#showSearchDialog();
    }
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
