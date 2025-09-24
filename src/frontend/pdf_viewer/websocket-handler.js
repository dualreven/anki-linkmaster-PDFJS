/**
 * @file WebSocket消息处理器模块
 * @module WebSocketHandler
 * @description 处理PDF页面传输的WebSocket消息接收和处理
 */

/**
 * @class WebSocketHandler
 * @description WebSocket消息处理器，负责处理页面相关的WebSocket消息
 */
export class WebSocketHandler {
  #manager;

  /**
   * 创建WebSocket处理器实例
   * @param {PageTransferCore} manager - 页面传输管理器实例
   */
  constructor(manager) {
    this.#manager = manager;
  }

  /**
   * 处理WebSocket消息
   * @param {Object} message - WebSocket消息
   */
  handleWebSocketMessage(message) {
    const { type, request_id: requestId } = message;
    
    switch (type) {
      case 'pdf_page_response':
        this.handlePageResponse(message, requestId);
        break;
        
      case 'pdf_page_error':
        this.handlePageError(message, requestId);
        break;
        
      default:
        // 其他消息类型不处理
        break;
    }
  }

  /**
   * 处理页面响应
   * @param {Object} message - 响应消息
   * @param {string} requestId - 请求ID
   */
  handlePageResponse(message, requestId) {
    const pendingRequest = this.#manager.pendingRequests.get(requestId);
    if (!pendingRequest) {
      this.#manager.logger.warn(`收到未知请求的页面响应: ${requestId}`);
      return;
    }

    const { data } = message;
    const { file_id: fileId, page_number: pageNumber, page_data: pageData } = data;

    try {
      // 处理页面数据（解压缩等）
      const processedData = this.processPageData(pageData);
      
      // 添加到缓存
      this.addToCache(fileId, pageNumber, processedData);
      
      // 解析Promise
      pendingRequest.resolve(processedData);
      
      this.#manager.logger.debug(`页面响应处理完成: ${fileId}-${pageNumber}`);
      
    } catch (error) {
      this.#manager.logger.error(`页面数据处理失败: ${error.message}`);
      pendingRequest.reject(error);
    } finally {
      this.#manager.pendingRequests.delete(requestId);
    }
  }

  /**
   * 处理页面错误
   * @param {Object} message - 错误消息
   * @param {string} requestId - 请求ID
   */
  handlePageError(message, requestId) {
    const pendingRequest = this.#manager.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    const { error } = message;
    const { retryable, message: errorMsg } = error;

    if (retryable && pendingRequest.retryCount < this.#manager.maxRetries) {
      // 重试逻辑
      pendingRequest.retryCount++;
      this.#manager.logger.warn(`页面请求失败，进行第 ${pendingRequest.retryCount} 次重试: ${errorMsg}`);
      
      setTimeout(() => {
        this.retryRequest(requestId);
      }, this.#manager.retryDelay * pendingRequest.retryCount);
      
    } else {
      // 最终失败
      const error = new Error(`页面加载失败: ${errorMsg}`);
      pendingRequest.reject(error);
      this.#manager.pendingRequests.delete(requestId);
      
      this.#manager.logger.error(`页面请求最终失败: ${errorMsg}`);
    }
  }

  /**
   * 处理请求超时
   * @param {string} requestId - 请求ID
   */
  handleRequestTimeout(requestId) {
    const pendingRequest = this.#manager.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    if (pendingRequest.retryCount < this.#manager.maxRetries) {
      // 重试
      pendingRequest.retryCount++;
      this.#manager.logger.warn(`请求超时，进行第 ${pendingRequest.retryCount} 次重试`);
      
      setTimeout(() => {
        this.retryRequest(requestId);
      }, this.#manager.retryDelay * pendingRequest.retryCount);
      
    } else {
      // 最终失败
      const error = new Error('页面请求超时');
      pendingRequest.reject(error);
      this.#manager.pendingRequests.delete(requestId);
      
      this.#manager.logger.error('页面请求最终超时');
    }
  }

  /**
   * 重试请求
   * @param {string} requestId - 请求ID
   */
  retryRequest(requestId) {
    const pendingRequest = this.#manager.pendingRequests.get(requestId);
    if (!pendingRequest) {
      return;
    }

    const { fileId, pageNumber, compression } = pendingRequest;
    
    const message = {
      type: 'pdf_page_request',
      request_id: this.#manager.generateRequestId(),
      timestamp: Date.now(),
      data: {
        file_id: fileId,
        page_number: pageNumber,
        compression: compression
      }
    };

    this.sendWebSocketMessage(message);
  }

  /**
   * 处理页面数据（解压缩等）
   * @param {Object} pageData - 原始页面数据
   * @returns {Object} 处理后的页面数据
   */
  processPageData(pageData) {
    // 这里实现数据解压缩和处理逻辑
    // 实际实现应该根据压缩类型进行相应的解压缩操作
    return {
      ...pageData,
      processed: true,
      processedAt: Date.now()
    };
  }

  /**
   * 发送WebSocket消息
   * @param {Object} message - 消息对象
   */
  sendWebSocketMessage(message) {
    if (this.#manager.wsClient && this.#manager.wsClient.readyState === WebSocket.OPEN) {
      this.#manager.wsClient.send(JSON.stringify(message));
    } else {
      this.#manager.logger.warn('WebSocket未连接，无法发送消息');
      throw new Error('WebSocket连接不可用');
    }
  }

  /**
   * 从缓存中获取页面
   * @param {string} fileId - 文件ID
   * @param {number} pageNumber - 页面编号
   * @returns {Object|null} 页面数据或null
   */
  getFromCache(fileId, pageNumber) {
    if (!this.#manager.pageCache.has(fileId)) {
      return null;
    }

    const fileCache = this.#manager.pageCache.get(fileId);
    return fileCache.get(pageNumber) || null;
  }

  /**
   * 添加页面到缓存
   * @param {string} fileId - 文件ID
   * @param {number} pageNumber - 页面编号
   * @param {Object} pageData - 页面数据
   */
  addToCache(fileId, pageNumber, pageData) {
    if (!this.#manager.pageCache.has(fileId)) {
      this.#manager.pageCache.set(fileId, new Map());
    }

    const fileCache = this.#manager.pageCache.get(fileId);
    fileCache.set(pageNumber, pageData);

    // 如果缓存超过限制，清理最旧的页面
    if (fileCache.size > this.#manager.maxCacheSize) {
      this.cleanupCache(fileId);
    }
  }

  /**
   * 清理文件缓存（保留最新的页面）
   * @param {string} fileId - 文件ID
   */
  cleanupCache(fileId) {
    const fileCache = this.#manager.pageCache.get(fileId);
    if (!fileCache || fileCache.size <= this.#manager.maxCacheSize) {
      return;
    }

    // 按时间排序并保留最新的页面
    const sortedPages = Array.from(fileCache.entries())
      .sort(([, a], [, b]) => b.processedAt - a.processedAt)
      .slice(0, this.#manager.maxCacheSize);

    const newCache = new Map(sortedPages);
    this.#manager.pageCache.set(fileId, newCache);
  }

  /**
   * 清理所有缓存
   */
  clearAllCache() {
    this.#manager.pageCache.clear();
    this.#manager.logger.debug('清理所有页面缓存');
  }
}