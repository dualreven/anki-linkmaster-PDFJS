/**
 * Sidebar Feature - 侧边栏功能
 * 显示最近搜索、最近阅读、最近添加
 */

import { SidebarFeatureConfig } from './feature.config.js';
import { SidebarPanel } from './components/sidebar-panel.js';
import './styles/sidebar.css';

export class SidebarFeature {
  name = SidebarFeatureConfig.name;
  version = SidebarFeatureConfig.version;
  dependencies = SidebarFeatureConfig.dependencies;

  #context = null;
  #logger = null;
  #scopedEventBus = null;
  #globalEventBus = null;
  #sidebarPanel = null;
  #unsubscribers = [];

  // 历史记录数据
  #recentSearches = [];
  #recentOpened = [];
  #recentAdded = [];

  // 显示条数限制
  #displayLimits = {
    searches: 5,
    opened: 5,
    added: 5
  };

  /**
   * 安装Feature
   */
  async install(context) {
    this.#context = context;
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;

    this.#logger.info('[SidebarFeature] Installing...');

    try {
      // 1. 加载历史记录
      this.#loadHistory();

      // 2. 渲染侧边栏
      this.#renderSidebar();

      // 3. 监听事件
      this.#setupEventListeners();

      this.#logger.info('[SidebarFeature] Installed successfully');
    } catch (error) {
      this.#logger.error('[SidebarFeature] Installation failed', error);
      throw error;
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info('[SidebarFeature] Uninstalling...');

    // 取消事件订阅
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    // 销毁组件
    if (this.#sidebarPanel) {
      this.#sidebarPanel.destroy();
    }

    this.#logger.info('[SidebarFeature] Uninstalled');
  }

  /**
   * 渲染侧边栏
   * @private
   */
  #renderSidebar() {
    const container = document.getElementById('sidebar');
    if (!container) {
      this.#logger.warn('[SidebarFeature] Sidebar container not found');
      return;
    }

    this.#sidebarPanel = new SidebarPanel(this.#logger, this.#scopedEventBus, this.#displayLimits);
    this.#sidebarPanel.render(container);

    // 初始化数据
    this.#sidebarPanel.updateSearches(this.#recentSearches);
    this.#sidebarPanel.updateOpened(this.#recentOpened);
    this.#sidebarPanel.updateAdded(this.#recentAdded);

    this.#logger.info('[SidebarFeature] Sidebar rendered');
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    const { local, global } = SidebarFeatureConfig.config.events;

    // 监听内部事件：搜索项点击
    const unsubSearchClicked = this.#scopedEventBus.on(local.SEARCH_CLICKED, (data) => {
      this.#logger.info('[SidebarFeature] Search clicked from sidebar:', data.searchText);
      // 触发全局搜索事件
      this.#globalEventBus.emit(global.SEARCH_REQUESTED, { searchText: data.searchText });
    });
    this.#unsubscribers.push(unsubSearchClicked);

    // 监听内部事件：PDF点击
    const unsubPdfClicked = this.#scopedEventBus.on(local.PDF_CLICKED, (data) => {
      this.#logger.info('[SidebarFeature] PDF clicked from sidebar:', data.filename);
      // 触发全局打开事件
      this.#globalEventBus.emit(global.PDF_OPENED, {
        filename: data.filename,
        path: data.path
      });
    });
    this.#unsubscribers.push(unsubPdfClicked);

    // 监听全局事件：搜索请求
    const unsubSearchRequested = this.#globalEventBus.on(global.SEARCH_REQUESTED, (data) => {
      if (data.searchText) {
        this.#addRecentSearch(data.searchText);
      }
    });
    this.#unsubscribers.push(unsubSearchRequested);

    // 监听全局事件：PDF打开
    const unsubPdfOpened = this.#globalEventBus.on(global.PDF_OPENED, (data) => {
      if (data.filename) {
        this.#addRecentOpened({
          filename: data.filename,
          path: data.path || ''
        });
      }
    });
    this.#unsubscribers.push(unsubPdfOpened);

    // 监听全局事件：PDF列表数据变更（用于检测添加）
    const unsubDataChanged = this.#globalEventBus.on(global.PDF_ADDED, (data) => {
      // 这里可以通过比较新旧数据来检测新添加的PDF
      // 简化处理：暂时不实现，等待后端提供明确的添加事件
      this.#logger.debug('[SidebarFeature] PDF list changed');
    });
    this.#unsubscribers.push(unsubDataChanged);

    // 监听内部事件：显示条数变化
    const unsubLimitChanged = this.#scopedEventBus.on('limit:changed', (data) => {
      this.#logger.info('[SidebarFeature] Display limit changed:', data);
      this.#displayLimits[data.type] = data.limit;
      this.#saveDisplayLimits();
    });
    this.#unsubscribers.push(unsubLimitChanged);

    this.#logger.info('[SidebarFeature] Event listeners setup');
  }

  /**
   * 添加最近搜索记录
   * @private
   */
  #addRecentSearch(searchText) {
    // 去重：移除已存在的相同搜索
    this.#recentSearches = this.#recentSearches.filter(s => s.text !== searchText);

    // 添加到开头
    this.#recentSearches.unshift({
      text: searchText,
      timestamp: Date.now()
    });

    // 限制数量
    const maxItems = SidebarFeatureConfig.config.maxRecentItems.searches;
    if (this.#recentSearches.length > maxItems) {
      this.#recentSearches = this.#recentSearches.slice(0, maxItems);
    }

    // 保存到localStorage
    this.#saveHistory('searches');

    // 更新UI
    if (this.#sidebarPanel) {
      this.#sidebarPanel.updateSearches(this.#recentSearches);
    }

    this.#logger.debug('[SidebarFeature] Recent search added:', searchText);
  }

  /**
   * 添加最近阅读记录
   * @private
   */
  #addRecentOpened(pdf) {
    // 去重：移除已存在的相同PDF
    this.#recentOpened = this.#recentOpened.filter(p => p.filename !== pdf.filename);

    // 添加到开头
    this.#recentOpened.unshift({
      filename: pdf.filename,
      path: pdf.path || '',
      timestamp: Date.now()
    });

    // 限制数量
    const maxItems = SidebarFeatureConfig.config.maxRecentItems.opened;
    if (this.#recentOpened.length > maxItems) {
      this.#recentOpened = this.#recentOpened.slice(0, maxItems);
    }

    // 保存到localStorage
    this.#saveHistory('opened');

    // 更新UI
    if (this.#sidebarPanel) {
      this.#sidebarPanel.updateOpened(this.#recentOpened);
    }

    this.#logger.debug('[SidebarFeature] Recent opened added:', pdf.filename);
  }

  /**
   * 添加最近添加记录
   * @param {Object} pdf - PDF信息
   */
  addRecentAdded(pdf) {
    // 去重：移除已存在的相同PDF
    this.#recentAdded = this.#recentAdded.filter(p => p.filename !== pdf.filename);

    // 添加到开头
    this.#recentAdded.unshift({
      filename: pdf.filename,
      path: pdf.path || '',
      timestamp: Date.now()
    });

    // 限制数量
    const maxItems = SidebarFeatureConfig.config.maxRecentItems.added;
    if (this.#recentAdded.length > maxItems) {
      this.#recentAdded = this.#recentAdded.slice(0, maxItems);
    }

    // 保存到localStorage
    this.#saveHistory('added');

    // 更新UI
    if (this.#sidebarPanel) {
      this.#sidebarPanel.updateAdded(this.#recentAdded);
    }

    this.#logger.debug('[SidebarFeature] Recent added:', pdf.filename);
  }

  /**
   * 从localStorage加载历史记录
   * @private
   */
  #loadHistory() {
    const { storageKeys } = SidebarFeatureConfig.config;

    try {
      const searchesData = localStorage.getItem(storageKeys.searches);
      if (searchesData) {
        this.#recentSearches = JSON.parse(searchesData);
      }

      const openedData = localStorage.getItem(storageKeys.opened);
      if (openedData) {
        this.#recentOpened = JSON.parse(openedData);
      }

      const addedData = localStorage.getItem(storageKeys.added);
      if (addedData) {
        this.#recentAdded = JSON.parse(addedData);
      }

      // 加载显示条数设置
      this.#loadDisplayLimits();

      this.#logger.info('[SidebarFeature] History loaded', {
        searches: this.#recentSearches.length,
        opened: this.#recentOpened.length,
        added: this.#recentAdded.length
      });
    } catch (error) {
      this.#logger.error('[SidebarFeature] Failed to load history', error);
    }
  }

  /**
   * 从localStorage加载显示条数设置
   * @private
   */
  #loadDisplayLimits() {
    try {
      const limitsData = localStorage.getItem('pdf-home:sidebar-display-limits');
      if (limitsData) {
        const limits = JSON.parse(limitsData);
        this.#displayLimits = {
          searches: limits.searches || 5,
          opened: limits.opened || 5,
          added: limits.added || 5
        };
        this.#logger.info('[SidebarFeature] Display limits loaded:', this.#displayLimits);
      }
    } catch (error) {
      this.#logger.error('[SidebarFeature] Failed to load display limits', error);
    }
  }

  /**
   * 保存显示条数设置到localStorage
   * @private
   */
  #saveDisplayLimits() {
    try {
      localStorage.setItem('pdf-home:sidebar-display-limits', JSON.stringify(this.#displayLimits));
      this.#logger.debug('[SidebarFeature] Display limits saved:', this.#displayLimits);
    } catch (error) {
      this.#logger.error('[SidebarFeature] Failed to save display limits', error);
    }
  }

  /**
   * 保存历史记录到localStorage
   * @private
   * @param {string} type - 类型：'searches' | 'opened' | 'added'
   */
  #saveHistory(type) {
    const { storageKeys } = SidebarFeatureConfig.config;

    try {
      let key, data;
      switch (type) {
        case 'searches':
          key = storageKeys.searches;
          data = this.#recentSearches;
          break;
        case 'opened':
          key = storageKeys.opened;
          data = this.#recentOpened;
          break;
        case 'added':
          key = storageKeys.added;
          data = this.#recentAdded;
          break;
        default:
          this.#logger.warn('[SidebarFeature] Unknown history type:', type);
          return;
      }

      localStorage.setItem(key, JSON.stringify(data));
      this.#logger.debug(`[SidebarFeature] ${type} history saved`);
    } catch (error) {
      this.#logger.error(`[SidebarFeature] Failed to save ${type} history`, error);
    }
  }
}

export default SidebarFeature;
