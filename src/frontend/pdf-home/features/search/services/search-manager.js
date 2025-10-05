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
import { WEBSOCKET_EVENTS } from '../../../../common/event/event-constants.js';

export class SearchManager {
  #logger = null;
  #eventBus = null;
  #currentSearchText = '';
  #isSearching = false;
  #unsubs = [];
  #pendingRequests = new Map();  // 存储待处理的请求

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
      this.#handleSearch(data.searchText);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubSearch);

    // 监听清除请求
    const unsubClear = this.#eventBus.on('search:clear:requested', () => {
      this.#handleClear();
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubClear);

    // 监听 WebSocket 响应消息
    const unsubWsMessage = this.#eventBus.on('websocket:message:received', (data) => {
      this.#handleWebSocketMessage(data);
    }, { subscriberId: 'SearchManager' });
    this.#unsubs.push(unsubWsMessage);

    this.#logger.debug('[SearchManager] Event listeners set up');
  }

  /**
   * 处理 WebSocket 消息
   * @private
   */
  #handleWebSocketMessage(data) {
    // 检查是否是搜索响应
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

      // 生成唯一请求ID
      const requestId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 记录待处理的请求
      this.#pendingRequests.set(requestId, {
        searchText,
        timestamp: Date.now()
      });

      // 构建 WebSocket 消息
      const message = {
        type: 'pdf/search',
        request_id: requestId,
        data: {
          search_text: searchText,
          search_fields: ['title', 'author', 'filename', 'tags', 'notes'],
          include_hidden: true,
          limit: 500  // 默认最多500条结果
        }
      };

      this.#logger.info('[SearchManager] Sending search request', message);

      // 通过 EventBus 发送 WebSocket 消息
      this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, {
        actorId: 'SearchManager'
      });

      // 设置超时（30秒）
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
