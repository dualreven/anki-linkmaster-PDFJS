/**
 * @file PDF页面传输核心管理器
 * @module PageTransferCore
 * @description PDF页面传输的核心功能，包括基础管理和配置
 */

import { getLogger } from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../common/event/event-constants.js";

/**
 * @class PageTransferCore
 * @description PDF页面传输核心管理器，处理基础配置和生命周期
 */
export class PageTransferCore {
  #eventBus;
  #logger;
  #wsClient;
  #pageCache = new Map(); // file_id -> Map(page_number -> page_data)
  #pendingRequests = new Map(); // request_id -> { resolve, reject, retryCount }
  #activePreloads = new Set();
  #maxCacheSize = 20; // 最大缓存页面数
  #maxRetries = 3;
  #retryDelay = 1000;

  constructor(eventBus, wsClient) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewer");
    this.#wsClient = wsClient;
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // WebSocket消息接收事件
    this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
      this.handleWebSocketMessage(message);
    });

    // 页面渲染请求事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.RENDER.PAGE_REQUESTED, (data) => {
      this.handlePageRenderRequest(data);
    });

    // 导航事件 - 预加载相邻页面
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, (data) => {
      this.handleNavigationChange(data);
    });

    // 文件关闭事件 - 清理缓存
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.CLOSE, () => {
      this.clearAllCache();
    });
  }

  /**
   * 请求特定PDF页面
   * @param {string} fileId - 文件ID
   * @param {number} pageNumber - 页面编号
   * @param {string} [compression='zlib_base64'] - 压缩类型
   * @returns {Promise<Object>} 页面数据
   */
  async requestPage(fileId, pageNumber, compression = 'zlib_base64') {
    // 检查缓存
    const cachedPage = this.getFromCache(fileId, pageNumber);
    if (cachedPage) {
      this.#logger.debug(`返回缓存页面: ${fileId}-${pageNumber}`);
      return cachedPage;
    }

    // 生成请求ID
    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      // 存储请求信息
      this.#pendingRequests.set(requestId, {
        resolve,
        reject,
        retryCount: 0,
        fileId,
        pageNumber,
        compression
      });

      // 发送页面请求
      const message = {
        type: 'pdf_page_request',
        request_id: requestId,
        timestamp: Date.now(),
        data: {
          file_id: fileId,
          page_number: pageNumber,
          compression: compression
        }
      };

      this.sendWebSocketMessage(message);
      
      // 设置超时
      setTimeout(() => {
        if (this.#pendingRequests.has(requestId)) {
          this.handleRequestTimeout(requestId);
        }
      }, 10000); // 10秒超时
    });
  }

  /**
   * 预加载页面范围
   * @param {string} fileId - 文件ID
   * @param {number} startPage - 起始页面
   * @param {number} endPage - 结束页面
   * @param {string} [priority='low'] - 优先级
   */
  async preloadPages(fileId, startPage, endPage, priority = 'low') {
    const preloadKey = `${fileId}-${startPage}-${endPage}`;
    
    if (this.#activePreloads.has(preloadKey)) {
      return;
    }

    this.#activePreloads.add(preloadKey);

    try {
      const message = {
        type: 'pdf_page_preload',
        request_id: this.generateRequestId(),
        timestamp: Date.now(),
        data: {
          file_id: fileId,
          start_page: startPage,
          end_page: endPage,
          priority: priority
        }
      };

      this.sendWebSocketMessage(message);
      
      this.#logger.debug(`预加载页面范围: ${fileId} ${startPage}-${endPage}`);
      
    } catch (error) {
      this.#logger.warn(`预加载失败: ${error.message}`);
    } finally {
      // 延迟移除预加载标记，避免频繁重复预加载
      setTimeout(() => {
        this.#activePreloads.delete(preloadKey);
      }, 5000);
    }
  }

  /**
   * 清理页面缓存
   * @param {string} fileId - 文件ID
   * @param {number[]} [keepPages] - 需要保留的页面列表
   */
  clearCache(fileId, keepPages = null) {
    if (!this.#pageCache.has(fileId)) {
      return;
    }

    if (keepPages) {
      // 只保留指定的页面
      const pagesToRemove = [];
      const fileCache = this.#pageCache.get(fileId);
      
      for (const [pageNumber] of fileCache.entries()) {
        if (!keepPages.includes(pageNumber)) {
          pagesToRemove.push(pageNumber);
        }
      }
      
      pagesToRemove.forEach(pageNumber => {
        fileCache.delete(pageNumber);
      });
      
      this.#logger.debug(`清理缓存: 保留 ${keepPages.length} 个页面，清理 ${pagesToRemove.length} 个页面`);
    } else {
      // 清理所有页面
      this.#pageCache.delete(fileId);
      this.#logger.debug(`清理所有缓存页面: ${fileId}`);
    }

    // 发送缓存清理请求到后端
    const message = {
      type: 'pdf_page_cache_clear',
      request_id: this.generateRequestId(),
      timestamp: Date.now(),
      data: {
        file_id: fileId,
        keep_pages: keepPages
      }
    };

    this.sendWebSocketMessage(message);
  }

  /**
   * 处理页面渲染请求
   * @param {Object} data - 渲染请求数据
   */
  async handlePageRenderRequest(data) {
    const { pageNumber, fileId } = data;
    
    if (!fileId) {
      this.#logger.warn('页面渲染请求缺少fileId');
      return;
    }

    try {
      // 请求页面数据
      const pageData = await this.requestPage(fileId, pageNumber);
      
      // 触发页面渲染完成事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, {
        pageNumber,
        pageData,
        fileId
      }, { actorId: 'PageTransferManager' });
      
    } catch (error) {
      this.#logger.error(`页面渲染请求失败: ${error.message}`);
      
      // 触发页面渲染失败事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_FAILED, {
        pageNumber,
        error: error.message,
        fileId
      }, { actorId: 'PageTransferManager' });
    }
  }

  /**
   * 处理导航变化 - 预加载相邻页面
   * @param {Object} data - 导航数据
   */
  handleNavigationChange(data) {
    const { currentPage, totalPages, fileId } = data;
    
    if (!fileId || !totalPages) {
      return;
    }

    // 预加载当前页前后2页
    const preloadStart = Math.max(1, currentPage - 2);
    const preloadEnd = Math.min(totalPages, currentPage + 2);
    
    if (preloadStart <= preloadEnd) {
      this.preloadPages(fileId, preloadStart, preloadEnd, 'medium');
    }
  }

  /**
   * 生成唯一的请求ID
   * @returns {string} 请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const stats = {
      totalFiles: this.#pageCache.size,
      totalPages: 0,
      fileStats: {}
    };

    for (const [fileId, fileCache] of this.#pageCache.entries()) {
      stats.totalPages += fileCache.size;
      stats.fileStats[fileId] = {
        cachedPages: fileCache.size,
        pageNumbers: Array.from(fileCache.keys())
      };
    }

    return stats;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.clearAllCache();
    this.#pendingRequests.clear();
    this.#activePreloads.clear();
    this.#logger.info('PageTransferManager已销毁');
  }

  // 受保护的getter方法，供子类访问私有字段
  get eventBus() { return this.#eventBus; }
  get logger() { return this.#logger; }
  get wsClient() { return this.#wsClient; }
  get pageCache() { return this.#pageCache; }
  get pendingRequests() { return this.#pendingRequests; }
  get activePreloads() { return this.#activePreloads; }
  get maxCacheSize() { return this.#maxCacheSize; }
  get maxRetries() { return this.#maxRetries; }
  get retryDelay() { return this.#retryDelay; }
}