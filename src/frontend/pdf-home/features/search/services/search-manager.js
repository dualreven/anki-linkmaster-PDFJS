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
  #backendMode = 'v1'; // 'v1' | 'v2'，默认兼容旧后端
  #MODE_STORAGE_KEY = 'pdf-home:search:backend-mode';

  /**
   * 创建 SearchManager 实例
   *
   * @param {Object} eventBus - 全局事件总线
   */
  constructor(eventBus) {
    this.#logger = getLogger('SearchManager');
    this.#eventBus = eventBus;
    this.#loadBackendMode();
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
      this.#handleSearch(data.searchText);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubSearch);

    // 监听清除请求
    const unsubClear = this.#eventBus.on('search:clear:requested', () => {
      this.#handleClear();
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubClear);

    // 监听 WebSocket 原始消息（新协议直接响应类型）
    const unsubWsMessage = this.#eventBus.on('websocket:message:received', (data) => {
      this.#handleWebSocketMessage(data);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubWsMessage);

    // 监听 WebSocket 标准响应消息（旧pdfTable_server统一type=response）
    const unsubWsResponse = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (data) => {
      this.#handleWebSocketResponse(data);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubWsResponse);

    this.#logger.debug('[SearchManager] Event listeners set up');
  }

  /**
   * 处理 WebSocket 消息
   * @private
   */
  #handleWebSocketMessage(data) {
    // 检查是否是新协议的搜索响应
    if (data.type === 'pdf/search' && data.request_id) {
      const requestInfo = this.#pendingRequests.get(data.request_id);
      if (!requestInfo) {
        return;  // 不是我们的请求，忽略
      }

      this.#pendingRequests.delete(data.request_id);
      this.#isSearching = false;

      if (data.status === 'success' && data.data) {
        const { records, count, search_text } = data.data;

        // 发布搜索结果事件
        this.#eventBus.emit('search:results:updated', {
          records: records || [],
          count: count || 0,
          searchText: search_text || requestInfo.searchText
        });

        this.#logger.info('[SearchManager] Search completed successfully', {
          count: count || 0
        });

        // 识别并持久化为 v2
        this.#backendMode = 'v2';
        this.#saveBackendMode('v2');
      } else {
        const errorMsg = data.message || '搜索失败';
        this.#logger.error('[SearchManager] Search failed', errorMsg);

        // 发布搜索失败事件
        this.#eventBus.emit('search:results:failed', {
          error: errorMsg,
          searchText: requestInfo.searchText
        });
      }
    }
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

      // 识别并持久化为 v1
      this.#backendMode = 'v1';
      this.#saveBackendMode('v1');
      this.#isSearching = false;
    } else {
      const errorMsg = message?.message || message?.error?.message || '搜索失败';
      this.#logger.error('[SearchManager] Search (legacy response) failed', errorMsg);

      // 如果是“未知的消息类型”，尝试协议回退
      const isUnknownType = /未知的消息类型|Unknown message type/i.test(errorMsg || '');
      if (isUnknownType) {
        const retries = requestInfo.retries || 0;
        if (retries < 1) {
          const fallbackMode = requestInfo.mode === 'v2' ? 'v1' : 'v2';
          this.#logger.warn('[SearchManager] Unknown type, fallback once', { from: requestInfo.mode, to: fallbackMode });
          this.#sendSearchRequest(requestInfo.searchText, fallbackMode, retries + 1);
          return;
        }
        this.#logger.warn('[SearchManager] Unknown type after fallback, stop retry');
      }

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
  #handleSearch(searchText) {
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

      // 使用已知模式（默认 v1，可由成功响应锁定并持久化）
      this.#sendSearchRequest(searchText, this.#backendMode);

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
   */
  #sendSearchRequest(searchText, mode, retries = 0) {
    // 生成唯一请求ID
    const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 记录待处理的请求
    this.#pendingRequests.set(requestId, {
      searchText,
      timestamp: Date.now(),
      mode,
      retries
    });

    // 构建消息
    const message = this.#buildMessage(searchText, requestId, mode);
    this.#logger.info('[SearchManager] Sending search request', { type: message.type, mode, request_id: requestId });

    // 发送
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: 'SearchManager' });

    // 超时
    setTimeout(() => {
      if (this.#pendingRequests.has(requestId)) {
        this.#pendingRequests.delete(requestId);
        this.#isSearching = false;

        this.#logger.error('[SearchManager] Search request timeout', { mode });
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
  #buildMessage(searchText, requestId, mode) {
    if (mode === 'v1') {
      return {
        type: WEBSOCKET_MESSAGE_TYPES.SEARCH_PDF,
        request_id: requestId,
        search_text: searchText
      };
    }
    // v2（默认）
    return {
      type: 'pdf/search',
      request_id: requestId,
      data: {
        search_text: searchText,
        // 默认包含主题与关键词，便于更全面的初版检索
        search_fields: ['title', 'author', 'filename', 'tags', 'notes', 'subject', 'keywords'],
        include_hidden: true,
        limit: 500
      }
    };
  }

  // 加载/保存后端模式
  #loadBackendMode() {
    try {
      const m = localStorage.getItem(this.#MODE_STORAGE_KEY);
      if (m === 'v1' || m === 'v2') {
        this.#backendMode = m;
      }
      this.#logger.info('[SearchManager] Backend mode loaded', { mode: this.#backendMode });
    } catch {}
  }

  #saveBackendMode(mode) {
    try {
      localStorage.setItem(this.#MODE_STORAGE_KEY, mode);
      this.#logger.info('[SearchManager] Backend mode saved', { mode });
    } catch {}
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
