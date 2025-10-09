/**
 * SearchManager - 负责处理PDF搜索逻辑
 *
 * 职责：
 * - 监听搜索请求事件
 * - 通过 EventBus 发送搜索消息到后端
 * - 接收后端响应并发布搜索结果事件
 * - 管理搜索状态和错误处理
 */

import { getLogger } from '../../../../common/utils/logger.js';
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_EVENTS, WEBSOCKET_MESSAGE_TYPES } from '../../../../common/event/event-constants.js';

export class SearchManager {
  #logger = null;
  #eventBus = null;
  #currentSearchText = '';
  #isSearching = false;
  #unsubs = [];
  #pendingRequests = new Map();  // 存储待处理的请求
  #currentFilters = null;        // 当前激活的筛选条件（由 FilterFeature 管理）
  #nextSort = null;
  #nextPagination = null;
  // 仅保留 v1 协议

  /**
   * 创建 SearchManager 实例
   *
   * @param {Object} eventBus - 全局事件总线
   */
  constructor(eventBus) {
    this.#logger = getLogger('SearchManager');
    this.#eventBus = eventBus;
    this.#setupEventListeners();

    this.#logger.info('[SearchManager] Initialized');
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 监听搜索请求
    const unsubSearch = this.#eventBus.on('search:query:requested', (data) => {
      // 兼容扩展参数：允许透传 filters/sort/pagination/focusId
      // 同时预读取一次性参数以便在构建消息时补充顶层 limit/offset 等兼容字段
      try {
        this.#nextSort = (data && Array.isArray(data.sort)) ? data.sort : null;
        this.#nextPagination = (data && typeof data.pagination === 'object') ? data.pagination : null;
      } catch (_) {
        this.#nextSort = null;
        this.#nextPagination = null;
      }
      this.#handleSearch(data?.searchText, data);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubSearch);

    // 监听清除请求
    const unsubClear = this.#eventBus.on('search:clear:requested', () => {
      this.#handleClear();
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubClear);

    // 监听 WebSocket 标准响应消息（v1: type='response'）
    const unsubWsResponse = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (data) => {
      this.#handleWebSocketResponse(data);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubWsResponse);

    // 监听 WebSocket 错误消息（包括 pdf-library:search:failed 或通用 error）
    const unsubWsError = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.ERROR, (message) => {
      try {
        const reqId = message?.request_id;
        if (!reqId || !this.#pendingRequests.has(reqId)) return;

        const requestInfo = this.#pendingRequests.get(reqId);
        this.#pendingRequests.delete(reqId);
        this.#isSearching = false;

        const errorMsg = message?.message || message?.error?.message || '搜索失败';
        this.#logger.error('[SearchManager] Search failed (WS ERROR)', errorMsg);
        this.#eventBus.emit('search:results:failed', {
          error: errorMsg,
          searchText: requestInfo?.searchText
        });
      } catch (e) {
        // 忽略错误，避免影响全局错误处理
      }
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubWsError);

    // 监听筛选状态更新（持久化当前筛选条件）
    const unsubFilterState = this.#eventBus.on('filter:state:updated', (data) => {
      try {
        this.#currentFilters = (data && typeof data === 'object') ? (data.filters ?? null) : null;
        this.#logger.info('[SearchManager] Filter state updated', { hasFilters: !!this.#currentFilters });
      } catch (e) {
        this.#currentFilters = null;
      }
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubFilterState);

    this.#logger.debug('[SearchManager] Event listeners set up');
  }

  /**
   * 处理 WebSocket 标准响应（旧pdfTable_server: type='response'）
   * @private
   */
  #handleWebSocketResponse(message) {
    const reqId = message?.request_id;
    if (!reqId || !this.#pendingRequests.has(reqId)) return;

    const requestInfo = this.#pendingRequests.get(reqId);
    this.#pendingRequests.delete(reqId);

    if (message?.status === 'success') {
      const data = message?.data || {};
      const records = data?.files || [];
      const count = (typeof data?.total_count === 'number') ? data.total_count : records.length;
      const searchText = data?.search_text ?? requestInfo.searchText;
      // 从响应或请求缓存中推断分页信息
      let page = null;
      try { page = (data && typeof data.page === 'object') ? data.page : null; } catch (_) { page = null; }
      if (!page && requestInfo && requestInfo.pagination) {
        const p = requestInfo.pagination;
        const limit = (p && typeof p.limit !== 'undefined') ? p.limit : undefined;
        const offset = (p && typeof p.offset !== 'undefined') ? p.offset : undefined;
        if (typeof limit !== 'undefined' || typeof offset !== 'undefined') page = { limit, offset };
      }

      this.#eventBus.emit('search:results:updated', {
        records,
        count,
        searchText,
        focusId: requestInfo?.focusId,
        page
      });
      this.#logger.info('[SearchManager] Search (legacy response) completed successfully', { count });
      this.#isSearching = false;
    } else {
      const errorMsg = message?.message || message?.error?.message || '搜索失败';
      this.#logger.error('[SearchManager] Search (legacy response) failed', errorMsg);

      this.#isSearching = false;
      this.#eventBus.emit('search:results:failed', {
        error: errorMsg,
        searchText: requestInfo.searchText
      });
    }
  }

  /**
   * 处理搜索请求
   * @private
   * @param {string} searchText - 搜索文本
   * @param {Object} extraParams - 扩展参数（filters/sort/pagination）
   */
  #handleSearch(searchText, extraParams = {}) {
    // 防止重复搜索
    if (this.#isSearching) {
      this.#logger.warn('[SearchManager] Search already in progress, ignoring new request');
      return;
    }

    this.#isSearching = true;
    this.#currentSearchText = searchText;

    try {
      this.#logger.info('[SearchManager] Starting search', { searchText });

      // 发布搜索开始事件
      this.#eventBus.emit('search:query:started', {
        searchText: searchText
      });

      // 仅发送 v1 协议
      this.#sendSearchRequest(searchText, extraParams);

    } catch (error) {
      this.#logger.error('[SearchManager] Search failed', error);
      this.#isSearching = false;

      // 发布搜索失败事件
      this.#eventBus.emit('search:results:failed', {
        error: error.message || '搜索请求失败',
        searchText: searchText
      });
    }
  }

  /**
   * 发送具体模式的搜索请求，并设置超时与pending跟踪
   * @private
   * @param {string} searchText - 搜索文本
   * @param {Object} extraParams - 扩展参数（filters/sort/pagination）
   */
  #sendSearchRequest(searchText, extraParams = {}) {
    // 生成唯一请求ID
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 记录待处理的请求（附带分页信息，便于结果事件回传）
    let usedPagination = null;
    try {
      if (extraParams && typeof extraParams === 'object' && extraParams.pagination) {
        usedPagination = { ...extraParams.pagination };
      } else if (this.#nextPagination && typeof this.#nextPagination === 'object') {
        usedPagination = { ...this.#nextPagination };
      }
    } catch (_) { usedPagination = null; }

    this.#pendingRequests.set(requestId, {
      searchText,
      timestamp: Date.now(),
      retries: 0,
      focusId: (extraParams && typeof extraParams === 'object') ? extraParams.focusId : undefined,
      pagination: usedPagination || null
    });

    // 构建消息
    const message = this.#buildMessage(searchText, requestId, extraParams);
    this.#logger.info('[SearchManager] Sending search request', { type: message.type, request_id: requestId });

    // 发送
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: 'SearchManager' });

    // 超时
    setTimeout(() => {
      if (this.#pendingRequests.has(requestId)) {
        this.#pendingRequests.delete(requestId);
        this.#isSearching = false;

      this.#logger.error('[SearchManager] Search request timeout');
      this.#eventBus.emit('search:results:failed', {
        error: '搜索超时，请重试',
        searchText
      });
    }
    }, 30000);
  }

  /**
   * 构建不同协议的消息
   * @private
   * @param {string} searchText - 搜索文本
   * @param {string} requestId - 请求ID
   * @param {Object} extraParams - 扩展参数（filters/sort/pagination）
   */
  #buildMessage(searchText, requestId, extraParams = {}) {
    // 标准协议：载荷放入 data，包含 query 与 tokens（按空格切分，AND 语义）
    const tokens = (searchText || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const payload = {
      type: WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF,
      request_id: requestId,
      data: {
        query: searchText || '',
        tokens
      }
    };

    try {
      if (extraParams && typeof extraParams === 'object') {
        // 1. 处理 filters：若调用方未提供，自动带上当前激活的筛选条件
        const filters = extraParams.filters !== undefined
          ? extraParams.filters
          : this.#currentFilters;
        if (filters && typeof filters === 'object') {
          payload.data.filters = filters;
        }

        // 2. 透传排序（可选）
        if (Array.isArray(extraParams.sort) && extraParams.sort.length > 0) {
          payload.data.sort = extraParams.sort;
        }

        // 3. 透传分页（可选）
        if (extraParams.pagination && typeof extraParams.pagination === 'object') {
          const p = extraParams.pagination;
          const pg = {};
          if (p.limit !== undefined) pg.limit = p.limit;
          if (p.offset !== undefined) pg.offset = p.offset;
          if (p.need_total !== undefined) pg.need_total = !!p.need_total;
          if (Object.keys(pg).length > 0) payload.data.pagination = pg;
        }
      }
    } catch (_) {
      // 安全兜底：忽略非法扩展参数
    }
    // 空白搜索（来自搜索框）时，显式移除分页截断
    try {
      const src = (extraParams && typeof extraParams.source === 'string') ? extraParams.source : null;
      const isBlank = (searchText || '').trim().length === 0;
      if (src === 'search-box' && isBlank) {
        if (payload.data.pagination) delete payload.data.pagination;
        if ('limit' in payload.data) delete payload.data.limit;
        if ('offset' in payload.data) delete payload.data.offset;
        this.#logger.info('[SearchManager] Blank search from search-box: cleared pagination limit');
      }
    } catch (_) {}

    // 附加 sort/pagination（由调用方决定传入）
    try {
      if (this.#nextSort && Array.isArray(this.#nextSort)) {
        payload.data.sort = this.#nextSort;
      }
      if (this.#nextPagination && typeof this.#nextPagination === 'object') {
        const limit = Number(this.#nextPagination.limit ?? 0);
        const offset = Number(this.#nextPagination.offset ?? 0);
        payload.data.pagination = { ...this.#nextPagination };
        // 兼容后端标准服务器读取顶层 limit/offset 的逻辑
        if (!Number.isNaN(limit)) payload.data.limit = limit;
        if (!Number.isNaN(offset)) payload.data.offset = offset;
      }
    } catch (_) {}
    // 清理一次性参数
    this.#nextSort = null;
    this.#nextPagination = null;
    return payload;
  }

  /**
   * 处理清除搜索
   * @private
   */
  #handleClear() {
    this.#logger.info('[SearchManager] Clearing search');

    this.#currentSearchText = '';

    // 清除搜索 = 显示所有记录（发送空搜索文本）
    this.#handleSearch('');
  }

  /**
   * 获取当前搜索文本
   * @returns {string}
   */
  getCurrentSearchText() {
    return this.#currentSearchText;
  }

  /**
   * 检查是否正在搜索
   * @returns {boolean}
   */
  isSearching() {
    return this.#isSearching;
  }

  /**
   * 销毁 SearchManager 实例
   */
  destroy() {
    this.#logger.info('[SearchManager] Destroying');

    // 取消所有事件订阅
    this.#unsubs.forEach(unsub => unsub());
    this.#unsubs = [];

    this.#currentSearchText = '';
    this.#isSearching = false;

    this.#logger.info('[SearchManager] Destroyed');
  }
}
