/**
 * 搜索功能Feature
 * @file features/search/index.js
 * @description PDF全文搜索功能的Feature入口，实现IFeature接口
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../common/event/pdf-viewer-constants.js';
import { SearchEngine } from './services/search-engine.js';
import { SearchStateManager } from './services/search-state-manager.js';
import { SearchBox } from './components/search-box.js';

// 导入样式
import './styles/search.css';

/**
 * 搜索功能Feature类
 * 负责协调搜索引擎、状态管理器和UI组件
 * @class SearchFeature
 * @implements {IFeature}
 */
export class SearchFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = getLogger('SearchFeature');

  /** @type {import('../../types/events').EventBus} */
  #eventBus = null;

  /** @type {SearchEngine} 搜索引擎实例 */
  #searchEngine = null;

  /** @type {SearchStateManager} 状态管理器实例 */
  #stateManager = null;

  /** @type {SearchBox} 搜索框UI实例 */
  #searchBox = null;

  /** @type {any} PDFViewer实例（从容器获取） */
  #pdfViewer = null;

  /** @type {boolean} 是否已安装 */
  #installed = false;

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return 'search';
  }

  /**
   * Feature版本
   * @returns {string}
   */
  get version() {
    return '1.0.0';
  }

  /**
   * 依赖的其他Features
   * @returns {string[]}
   */
  get dependencies() {
    return ['app-core', 'ui-manager'];
  }

  /**
   * Feature描述
   * @returns {string}
   */
  get description() {
    return 'PDF全文搜索功能，支持关键词搜索、结果高亮、导航和快捷键';
  }

  /**
   * 安装Feature
   * @param {import('../../container/simple-dependency-container').SimpleDependencyContainer} container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(container) {
    if (this.#installed) {
      this.#logger.warn('SearchFeature already installed');
      return;
    }

    this.#logger.info('Installing SearchFeature...');

    try {
      // 1. 从容器获取依赖
      this.#eventBus = container.resolve('eventBus');
      if (!this.#eventBus) {
        throw new Error('EventBus not found in container');
      }

      // 获取PDFViewerManager（来自ui-manager feature）
      const pdfViewerManager = container.resolve('pdfViewerManager');
      if (!pdfViewerManager) {
        throw new Error('PDFViewerManager not found in container. Ensure ui-manager is installed first.');
      }

      // 2. 创建状态管理器
      this.#stateManager = new SearchStateManager();
      this.#logger.info('SearchStateManager created');

      // 3. 创建搜索引擎
      this.#searchEngine = new SearchEngine(this.#eventBus);
      this.#logger.info('SearchEngine created');

      // 4. 创建搜索框UI
      this.#searchBox = new SearchBox(this.#eventBus);
      await this.#searchBox.initialize();
      this.#logger.info('SearchBox initialized');

      // 5. 设置事件监听器
      this.#setupEventListeners();

      // 6. 注册到容器（供其他Feature使用）
      container.register('searchEngine', this.#searchEngine);
      container.register('searchStateManager', this.#stateManager);
      container.register('searchBox', this.#searchBox);

      // 7. 监听PDF加载完成，初始化搜索引擎
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        async ({ pdfDocument }) => {
          await this.#initializeSearchEngine(pdfViewerManager);
        },
        { subscriberId: 'SearchFeature' }
      );

      // 8. 设置全局快捷键（Ctrl+F）
      this.#setupGlobalShortcuts();

      this.#installed = true;
      this.#logger.info('SearchFeature installed successfully');

    } catch (error) {
      this.#logger.error('Failed to install SearchFeature:', error);
      throw error;
    }
  }

  /**
   * 初始化搜索引擎（在PDF加载后）
   * @private
   * @param {any} pdfViewerManager - PDFViewerManager实例
   */
  async #initializeSearchEngine(pdfViewerManager) {
    try {
      // 获取PDF.js的viewer、eventBus和linkService
      const pdfViewer = pdfViewerManager.pdfViewer;
      const pdfEventBus = pdfViewerManager.eventBus;
      const pdfLinkService = pdfViewerManager.linkService;

      if (!pdfViewer || !pdfEventBus || !pdfLinkService) {
        throw new Error('PDF.js components not available from PDFViewerManager');
      }

      // 初始化搜索引擎
      await this.#searchEngine.initialize(pdfViewer, pdfEventBus, pdfLinkService);

      this.#logger.info('SearchEngine initialized with PDF document');
    } catch (error) {
      this.#logger.error('Failed to initialize SearchEngine:', error);
    }
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听搜索执行请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY,
      ({ query, options }) => {
        this.#handleSearchQuery(query, options);
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听搜索清空请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.CLEAR,
      () => {
        this.#handleSearchClear();
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听导航到下一个结果
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.NEXT,
      () => {
        this.#handleNavigateNext();
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听导航到上一个结果
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.NAVIGATE.PREV,
      () => {
        this.#handleNavigatePrev();
      },
      { subscriberId: 'SearchFeature' }
    );

    // 监听选项改变
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.SEARCH.OPTION.CHANGED,
      ({ option, value }) => {
        this.#handleOptionChange(option, value);
      },
      { subscriberId: 'SearchFeature' }
    );

    this.#logger.info('Event listeners attached');
  }

  /**
   * 设置全局快捷键
   * @private
   */
  #setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+F (Cmd+F on Mac) - 打开搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();

        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.SEARCH.UI.OPEN,
          {},
          { actorId: 'SearchFeature:GlobalShortcut' }
        );
      }
    });

    this.#logger.info('Global shortcuts registered (Ctrl+F)');
  }

  /**
   * 处理搜索查询
   * @private
   * @param {string} query - 搜索关键词
   * @param {import('../../types/events').SearchOptions} options - 搜索选项
   */
  async #handleSearchQuery(query, options) {
    this.#logger.info(`Handling search query: "${query}"`);

    try {
      // 更新状态
      this.#stateManager.updateQuery(query);
      this.#stateManager.updateOptions(options);
      this.#stateManager.setSearching(true);

      // 执行搜索
      await this.#searchEngine.executeSearch(query, options);

    } catch (error) {
      this.#logger.error('Search query failed:', error);
      this.#stateManager.setSearching(false);
    }
  }

  /**
   * 处理搜索清空
   * @private
   */
  #handleSearchClear() {
    this.#logger.info('Handling search clear');

    this.#searchEngine.clearSearch();
    this.#stateManager.reset();
  }

  /**
   * 处理导航到下一个结果
   * @private
   */
  async #handleNavigateNext() {
    this.#logger.info('Handling navigate to next match');

    if (!this.#stateManager.hasResults) {
      this.#logger.warn('No search results to navigate');
      return;
    }

    try {
      await this.#searchEngine.highlightNextMatch();
      this.#stateManager.nextMatch();
    } catch (error) {
      this.#logger.error('Navigate next failed:', error);
    }
  }

  /**
   * 处理导航到上一个结果
   * @private
   */
  async #handleNavigatePrev() {
    this.#logger.info('Handling navigate to previous match');

    if (!this.#stateManager.hasResults) {
      this.#logger.warn('No search results to navigate');
      return;
    }

    try {
      await this.#searchEngine.highlightPreviousMatch();
      this.#stateManager.previousMatch();
    } catch (error) {
      this.#logger.error('Navigate previous failed:', error);
    }
  }

  /**
   * 处理选项改变
   * @private
   * @param {string} option - 选项名称
   * @param {boolean} value - 选项值
   */
  #handleOptionChange(option, value) {
    this.#logger.info(`Handling option change: ${option} = ${value}`);

    // 更新状态管理器
    this.#stateManager.updateOptions({ [option]: value });

    // 更新搜索引擎选项
    this.#searchEngine.updateOptions({ [option]: value });
  }

  /**
   * 获取当前搜索状态
   * @returns {Object} 搜索状态快照
   */
  getState() {
    return {
      featureInfo: {
        name: this.name,
        version: this.version,
        installed: this.#installed,
      },
      stateManager: this.#stateManager?.getSnapshot(),
      searchEngine: this.#searchEngine?.getState(),
    };
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    if (!this.#installed) {
      this.#logger.warn('SearchFeature not installed');
      return;
    }

    this.#logger.info('Uninstalling SearchFeature...');

    try {
      // 销毁各个组件
      if (this.#searchBox) {
        this.#searchBox.destroy();
        this.#searchBox = null;
      }

      if (this.#searchEngine) {
        this.#searchEngine.destroy();
        this.#searchEngine = null;
      }

      if (this.#stateManager) {
        this.#stateManager.destroy();
        this.#stateManager = null;
      }

      // 清空引用
      this.#eventBus = null;
      this.#pdfViewer = null;
      this.#installed = false;

      this.#logger.info('SearchFeature uninstalled successfully');

    } catch (error) {
      this.#logger.error('Failed to uninstall SearchFeature:', error);
      throw error;
    }
  }
}

// 默认导出
export default SearchFeature;
