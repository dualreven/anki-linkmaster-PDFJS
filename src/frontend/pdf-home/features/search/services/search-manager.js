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
  #currentSort = null;           // 最近一次应用的排序规则（由 Sorter 触发或搜索显式携带）
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
      const filters = data && typeof data === 'object' ? data.filters : undefined;
      const sort = data && typeof data === 'object' ? data.sort : undefined;
      try {
        // 记忆最近一次显式传入的排序规则（为空数组视为清除）
        if (typeof sort !== 'undefined') {
          if (Array.isArray(sort) && sort.length > 0) {
            this.#currentSort = sort.map(r => ({
              field: String(r.field || ''),
              direction: String(r.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
              formula: (typeof r.formula === 'string' && r.formula.trim() !== '') ? r.formula : undefined
            }));
          } else {
            this.#currentSort = null;
          }
        }
      } catch {}
      this.#handleSearch(data.searchText, filters, sort);
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

      this.#eventBus.emit('search:results:updated', {
        records,
        count,
        searchText
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
   */
  #handleSearch(searchText, filters, sort) {
    // 防止重复搜索
    if (this.#isSearching) {
      this.#logger.warn('[SearchManager] Search already in progress, ignoring new request');
      return;
    }

    this.#isSearching = true;
    const effectiveText = (typeof searchText === 'string') ? searchText : (this.#currentSearchText || '');
    this.#currentSearchText = effectiveText;

    try {
      this.#logger.info('[SearchManager] Starting search', { searchText: effectiveText });

      // 发布搜索开始事件
      this.#eventBus.emit('search:query:started', {
        searchText: effectiveText
      });

      // 仅发送 v1 协议
      this.#sendSearchRequest(effectiveText, filters, sort);

    } catch (error) {
      this.#logger.error('[SearchManager] Search failed', error);
      this.#isSearching = false;

      // 发布搜索失败事件
      this.#eventBus.emit('search:results:failed', {
        error: error.message || '搜索请求失败',
        searchText: effectiveText
      });
    }
  }

  /**
   * 发送具体模式的搜索请求，并设置超时与pending跟踪
   * @private
   */
  #sendSearchRequest(searchText, filters, sort) {
    // 生成唯一请求ID
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 记录待处理的请求
    this.#pendingRequests.set(requestId, {
      searchText,
      timestamp: Date.now(),
      retries: 0
    });

    // 构建消息
    const message = this.#buildMessage(searchText, requestId, filters, sort);
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
   */
  #buildMessage(searchText, requestId, filters, sort) {
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
    // 若调用方未提供 filters，自动带上当前激活的筛选条件
    const effectiveFilters = (typeof filters !== 'undefined') ? filters : this.#currentFilters;
    if (effectiveFilters && typeof effectiveFilters === 'object') {
      payload.data.filters = effectiveFilters;
    }
    // 传递排序规则：优先使用调用方提供；否则回退到最近一次排序（#currentSort）
    const normalize = (rules) => rules.map(rule => ({
      field: String(rule.field || ''),
      direction: String(rule.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
    }));
    const normalizeWithFormula = (rules) => rules.map(rule => {
      const obj = {
        field: String(rule.field || ''),
        direction: String(rule.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
      };
      if (typeof rule.formula === 'string' && rule.formula.trim() !== '') {
        obj.formula = rule.formula;
      }
      return obj;
    });
    if (Array.isArray(sort) && sort.length > 0) {
      payload.data.sort = normalizeWithFormula(sort);
    } else if (Array.isArray(this.#currentSort) && this.#currentSort.length > 0) {
      payload.data.sort = normalizeWithFormula(this.#currentSort);
    }
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
