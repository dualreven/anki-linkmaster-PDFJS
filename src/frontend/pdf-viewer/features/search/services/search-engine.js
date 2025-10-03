/**
 * PDF搜索引擎
 * @file features/search/services/search-engine.js
 * @description 封装PDF.js的PDFFindController，提供PDF全文搜索功能
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { PDF_VIEWER_EVENTS } from '../../../../common/event/pdf-viewer-constants.js';

/**
 * PDF搜索引擎类
 * 负责执行PDF文本搜索、管理搜索结果、控制高亮显示
 * @class SearchEngine
 */
export class SearchEngine {
  /** @type {import('../../../../common/utils/logger.js').Logger} */
  #logger = getLogger('SearchEngine');

  /** @type {import('../../../types/events').EventBus} */
  #eventBus = null;

  /** @type {any} PDFFindController实例 */
  #findController = null;

  /** @type {any} PDF.js EventBus实例 */
  #pdfEventBus = null;

  /** @type {any} PDFLinkService实例 */
  #pdfLinkService = null;

  /** @type {string} 当前搜索关键词 */
  #currentQuery = '';

  /** @type {import('../../../types/events').SearchOptions} 当前搜索选项 */
  #currentOptions = {
    caseSensitive: false,
    wholeWords: false,
    highlightAll: true,
    useRegex: false,
  };

  /** @type {number} 当前匹配索引（从1开始） */
  #currentMatchIndex = 0;

  /** @type {number} 总匹配数 */
  #totalMatches = 0;

  /** @type {boolean} 是否正在搜索 */
  #isSearching = false;

  /** @type {Array<import('../../../types/events').SearchMatch>} 匹配结果缓存 */
  #matchesCache = [];

  /**
   * 构造函数
   * @param {import('../../../types/events').EventBus} eventBus - 事件总线
   */
  constructor(eventBus) {
    if (!eventBus) {
      throw new Error('EventBus is required for SearchEngine');
    }

    this.#eventBus = eventBus;
    this.#logger.info('SearchEngine instance created');
  }

  /**
   * 初始化搜索引擎
   * @param {any} pdfViewer - PDF.js PDFViewer实例
   * @param {any} pdfEventBus - PDF.js EventBus实例
   * @param {any} pdfLinkService - PDF.js LinkService实例
   * @returns {Promise<void>}
   */
  async initialize(pdfViewer, pdfEventBus, pdfLinkService) {
    this.#logger.info('Initializing SearchEngine...');

    if (!pdfViewer) {
      throw new Error('PDFViewer is required for SearchEngine initialization');
    }

    if (!pdfEventBus) {
      throw new Error('PDF EventBus is required for SearchEngine initialization');
    }

    if (!pdfLinkService) {
      throw new Error('PDFLinkService is required for SearchEngine initialization');
    }

    this.#pdfEventBus = pdfEventBus;
    this.#pdfLinkService = pdfLinkService;

    // 动态导入PDFFindController（PDF.js提供）
    try {
      const { PDFFindController } = await import('pdfjs-dist/web/pdf_viewer.mjs');

      this.#findController = new PDFFindController({
        eventBus: pdfEventBus,
        linkService: pdfLinkService,
      });

      // 将findController绑定到PDFViewer（直接设置属性）
      pdfViewer.findController = this.#findController;

      // 设置可见性回调（PDFFindController需要知道哪些页面可见）
      this.#findController.onIsPageVisible = (pageNumber) => {
        // 从PDFViewer获取可见页面信息
        const visiblePages = pdfViewer._getVisiblePages();
        return visiblePages?.ids?.has(pageNumber) || false;
      };

      // 设置PDF文档到findController（因为SearchEngine初始化时PDF已经加载）
      const pdfDocument = pdfViewer.pdfDocument;
      this.#logger.info(`[SearchEngine] PDFViewer.pdfDocument exists: ${!!pdfDocument}, pages: ${pdfDocument?.numPages || 0}`);

      if (pdfDocument) {
        this.#findController.setDocument(pdfDocument);
        this.#logger.info('[SearchEngine] PDF document set to PDFFindController');
      } else {
        this.#logger.warn('[SearchEngine] ⚠️ PDFViewer has no document yet');
      }

      this.#logger.info('[SearchEngine] ✅ PDFFindController initialized and bound to PDFViewer');
    } catch (error) {
      this.#logger.error('Failed to initialize PDFFindController:', error);
      throw new Error(`SearchEngine initialization failed: ${error.message}`);
    }

    // 监听PDF.js的搜索结果事件
    this.#setupPDFJSEventListeners();

    // 发出初始化完成事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.STATE.INITIALIZED,
      { timestamp: Date.now() },
      { actorId: 'SearchEngine' }
    );

    this.#logger.info('SearchEngine initialized');
  }

  /**
   * 设置PDF.js事件监听器
   * @private
   */
  #setupPDFJSEventListeners() {
    // 监听搜索结果更新
    this.#pdfEventBus.on('updatefindmatchescount', (event) => {
      this.#handleFindMatchesCount(event);
    });

    // 监听当前匹配项变化
    this.#pdfEventBus.on('updatefindcontrolstate', (event) => {
      this.#handleFindControlState(event);
    });

    this.#logger.info('PDF.js event listeners attached');
  }

  /**
   * 处理PDF.js的匹配数更新事件
   * @private
   * @param {Object} event - PDF.js事件对象
   * @param {number} event.matchesCount.current - 当前匹配索引
   * @param {number} event.matchesCount.total - 总匹配数
   */
  #handleFindMatchesCount(event) {
    const { matchesCount } = event;

    if (!matchesCount) {
      this.#logger.warn('matchesCount is undefined in updatefindmatchescount event');
      return;
    }

    this.#totalMatches = matchesCount.total || 0;
    this.#currentMatchIndex = matchesCount.current || 0;

    this.#logger.info(`Search matches updated: ${this.#currentMatchIndex}/${this.#totalMatches}`);

    // 发出结果更新事件
    if (this.#totalMatches > 0) {
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED,
        {
          current: this.#currentMatchIndex,
          total: this.#totalMatches,
          query: this.#currentQuery,
        },
        { actorId: 'SearchEngine' }
      );
    }
  }

  /**
   * 处理PDF.js的搜索状态控制事件
   * @private
   * @param {Object} event - PDF.js事件对象
   * @param {number} event.state - 搜索状态（0: 找到, 1: 未找到, 2: 已包装, 3: 待定）
   * @param {boolean} event.matchesCount - 匹配计数对象
   */
  #handleFindControlState(event) {
    const { state, matchesCount } = event;

    this.#logger.info(`Find control state: ${state}, matchesCount:`, matchesCount);

    // state: 0 = FOUND, 1 = NOT_FOUND, 2 = WRAPPED, 3 = PENDING
    switch (state) {
      case 0: // FOUND
        this.#isSearching = false;
        this.#emitSearchResultFound();
        break;

      case 1: // NOT_FOUND
        this.#isSearching = false;
        this.#emitSearchResultNotFound();
        break;

      case 2: // WRAPPED
        this.#logger.info('Search wrapped around document');
        break;

      case 3: // PENDING
        this.#isSearching = true;
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.SEARCH.STATE.SEARCHING,
          { query: this.#currentQuery },
          { actorId: 'SearchEngine' }
        );
        break;

      default:
        this.#logger.warn(`Unknown find control state: ${state}`);
    }
  }

  /**
   * 发出"找到结果"事件
   * @private
   */
  #emitSearchResultFound() {
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.RESULT.FOUND,
      {
        query: this.#currentQuery,
        total: this.#totalMatches,
        current: this.#currentMatchIndex,
        matches: this.#matchesCache,
      },
      { actorId: 'SearchEngine' }
    );

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.STATE.IDLE,
      { timestamp: Date.now() },
      { actorId: 'SearchEngine' }
    );
  }

  /**
   * 发出"未找到结果"事件
   * @private
   */
  #emitSearchResultNotFound() {
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND,
      { query: this.#currentQuery },
      { actorId: 'SearchEngine' }
    );

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.STATE.IDLE,
      { timestamp: Date.now() },
      { actorId: 'SearchEngine' }
    );
  }

  /**
   * 执行搜索
   * @param {string} query - 搜索关键词
   * @param {import('../../../types/events').SearchOptions} options - 搜索选项
   * @returns {Promise<void>}
   */
  async executeSearch(query, options = {}) {
    this.#logger.info(`[SearchEngine] Executing search: "${query}"`, options);
    this.#logger.info(`[SearchEngine] findController exists: ${!!this.#findController}`);
    this.#logger.info(`[SearchEngine] pdfEventBus exists: ${!!this.#pdfEventBus}`);

    if (!this.#findController) {
      throw new Error('SearchEngine not initialized. Call initialize() first.');
    }

    if (!query || query.trim().length === 0) {
      this.#logger.warn('Empty search query');
      this.clearSearch();
      return;
    }

    // 更新当前搜索状态
    this.#currentQuery = query.trim();
    this.#currentOptions = { ...this.#currentOptions, ...options };
    this.#isSearching = true;

    // 清空之前的缓存
    this.#matchesCache = [];
    this.#currentMatchIndex = 0;
    this.#totalMatches = 0;

    // 发出搜索开始事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.STATE.SEARCHING,
      { query: this.#currentQuery },
      { actorId: 'SearchEngine' }
    );

    // 调用PDF.js的搜索API（通过EventBus dispatch）
    try {
      const searchParams = {
        type: null, // null表示新搜索，"again"表示查找下一个
        query: this.#currentQuery,
        caseSensitive: this.#currentOptions.caseSensitive,
        entireWord: this.#currentOptions.wholeWords,
        highlightAll: this.#currentOptions.highlightAll,
        findPrevious: false, // 总是从第一个开始
      };

      this.#logger.info('[SearchEngine] Dispatching find event with params:', searchParams);
      this.#pdfEventBus.dispatch('find', searchParams);

      this.#logger.info('[SearchEngine] Find event dispatched successfully');
    } catch (error) {
      this.#logger.error('[SearchEngine] Search execution failed:', error);
      this.#isSearching = false;

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.SEARCH.STATE.IDLE,
        { timestamp: Date.now() },
        { actorId: 'SearchEngine' }
      );

      throw error;
    }
  }

  /**
   * 高亮下一个匹配项
   * @returns {Promise<boolean>} 是否成功跳转
   */
  async highlightNextMatch() {
    this.#logger.info('Highlighting next match');

    if (!this.#findController) {
      throw new Error('SearchEngine not initialized');
    }

    if (this.#totalMatches === 0) {
      this.#logger.warn('No search results to navigate');
      return false;
    }

    try {
      this.#pdfEventBus.dispatch('find', {
        type: 'again', // "again"表示查找下一个
        query: this.#currentQuery,
        caseSensitive: this.#currentOptions.caseSensitive,
        entireWord: this.#currentOptions.wholeWords,
        highlightAll: this.#currentOptions.highlightAll,
        findPrevious: false, // 向后查找
      });

      this.#logger.info('Navigated to next match');
      return true;
    } catch (error) {
      this.#logger.error('Failed to highlight next match:', error);
      return false;
    }
  }

  /**
   * 高亮上一个匹配项
   * @returns {Promise<boolean>} 是否成功跳转
   */
  async highlightPreviousMatch() {
    this.#logger.info('Highlighting previous match');

    if (!this.#findController) {
      throw new Error('SearchEngine not initialized');
    }

    if (this.#totalMatches === 0) {
      this.#logger.warn('No search results to navigate');
      return false;
    }

    try {
      this.#pdfEventBus.dispatch('find', {
        type: 'again', // "again"表示查找下一个/上一个
        query: this.#currentQuery,
        caseSensitive: this.#currentOptions.caseSensitive,
        entireWord: this.#currentOptions.wholeWords,
        highlightAll: this.#currentOptions.highlightAll,
        findPrevious: true, // 向前查找
      });

      this.#logger.info('Navigated to previous match');
      return true;
    } catch (error) {
      this.#logger.error('Failed to highlight previous match:', error);
      return false;
    }
  }

  /**
   * 清空搜索
   */
  clearSearch() {
    this.#logger.info('Clearing search');

    if (this.#pdfEventBus) {
      // 使用dispatch发送清空搜索的事件
      this.#pdfEventBus.dispatch('find', {
        type: null,
        query: '',
        caseSensitive: false,
        entireWord: false,
        highlightAll: false,
        findPrevious: false,
      });
    }

    // 重置状态
    this.#currentQuery = '';
    this.#currentMatchIndex = 0;
    this.#totalMatches = 0;
    this.#matchesCache = [];
    this.#isSearching = false;

    // 发出搜索空闲事件
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.SEARCH.STATE.IDLE,
      { timestamp: Date.now() },
      { actorId: 'SearchEngine' }
    );

    this.#logger.info('Search cleared');
  }

  /**
   * 更新搜索选项
   * @param {import('../../../types/events').SearchOptions} options - 新的搜索选项
   */
  updateOptions(options) {
    this.#logger.info('Updating search options:', options);

    const oldOptions = { ...this.#currentOptions };
    this.#currentOptions = { ...this.#currentOptions, ...options };

    // 如果有活跃的搜索，重新执行
    if (this.#currentQuery && this.#totalMatches > 0) {
      this.#logger.info('Re-executing search with new options');
      this.executeSearch(this.#currentQuery, this.#currentOptions);
    }
  }

  /**
   * 获取当前搜索状态
   * @returns {Object} 当前搜索状态
   */
  getState() {
    return {
      query: this.#currentQuery,
      options: { ...this.#currentOptions },
      currentMatch: this.#currentMatchIndex,
      totalMatches: this.#totalMatches,
      isSearching: this.#isSearching,
    };
  }

  /**
   * 销毁搜索引擎
   */
  destroy() {
    this.#logger.info('Destroying SearchEngine');

    this.clearSearch();

    // 清空引用
    this.#findController = null;
    this.#pdfEventBus = null;
    this.#pdfLinkService = null;
    this.#eventBus = null;

    this.#logger.info('SearchEngine destroyed');
  }
}
