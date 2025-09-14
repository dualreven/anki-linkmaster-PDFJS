/**
 * @file PDF页面传输管理器 - 前端按需分页加载实现
 * @module PageTransferManager
 * @description 负责PDF页面的按需加载、缓存管理和传输优化
 */

import Logger from "../common/utils/logger.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../common/event/event-constants.js";

/**
 * @class PageTransferManager
 * @description PDF页面传输管理器，处理按需分页加载和缓存优化
 */
export class PageTransferManager {
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
        this.#logger = new Logger("PageTransferManager");
        this.#wsClient = wsClient;
        
        this.#setupEventListeners();
    }

    /**
     * 设置事件监听器
     * @private
     */
    #setupEventListeners() {
        // WebSocket消息接收事件
        this.#eventBus.on(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, (message) => {
            this.#handleWebSocketMessage(message);
        });

        // 页面渲染请求事件
        this.#eventBus.on(PDF_VIEWER_EVENTS.RENDER.PAGE_REQUESTED, (data) => {
            this.#handlePageRenderRequest(data);
        });

        // 导航事件 - 预加载相邻页面
        this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, (data) => {
            this.#handleNavigationChange(data);
        });

        // 文件关闭事件 - 清理缓存
        this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.CLOSE, () => {
            this.#clearAllCache();
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
        const cachedPage = this.#getFromCache(fileId, pageNumber);
        if (cachedPage) {
            this.#logger.debug(`返回缓存页面: ${fileId}-${pageNumber}`);
            return cachedPage;
        }

        // 生成请求ID
        const requestId = this._generateRequestId();
        
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

            this.#sendWebSocketMessage(message);
            
            // 设置超时
            setTimeout(() => {
                if (this.#pendingRequests.has(requestId)) {
                    this.#handleRequestTimeout(requestId);
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
                request_id: this._generateRequestId(),
                timestamp: Date.now(),
                data: {
                    file_id: fileId,
                    start_page: startPage,
                    end_page: endPage,
                    priority: priority
                }
            };

            this.#sendWebSocketMessage(message);
            
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
            request_id: this._generateRequestId(),
            timestamp: Date.now(),
            data: {
                file_id: fileId,
                keep_pages: keepPages
            }
        };

        this.#sendWebSocketMessage(message);
    }

    /**
     * 处理WebSocket消息
     * @param {Object} message - WebSocket消息
     * @private
     */
    #handleWebSocketMessage(message) {
        const { type, request_id: requestId } = message;
        
        switch (type) {
            case 'pdf_page_response':
                this.#handlePageResponse(message, requestId);
                break;
                
            case 'pdf_page_error':
                this.#handlePageError(message, requestId);
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
     * @private
     */
    #handlePageResponse(message, requestId) {
        const pendingRequest = this.#pendingRequests.get(requestId);
        if (!pendingRequest) {
            this.#logger.warn(`收到未知请求的页面响应: ${requestId}`);
            return;
        }

        const { data } = message;
        const { file_id: fileId, page_number: pageNumber, page_data: pageData } = data;

        try {
            // 处理页面数据（解压缩等）
            const processedData = this.#processPageData(pageData);
            
            // 添加到缓存
            this.#addToCache(fileId, pageNumber, processedData);
            
            // 解析Promise
            pendingRequest.resolve(processedData);
            
            this.#logger.debug(`页面响应处理完成: ${fileId}-${pageNumber}`);
            
        } catch (error) {
            this.#logger.error(`页面数据处理失败: ${error.message}`);
            pendingRequest.reject(error);
        } finally {
            this.#pendingRequests.delete(requestId);
        }
    }

    /**
     * 处理页面错误
     * @param {Object} message - 错误消息
     * @param {string} requestId - 请求ID
     * @private
     */
    #handlePageError(message, requestId) {
        const pendingRequest = this.#pendingRequests.get(requestId);
        if (!pendingRequest) {
            return;
        }

        const { error } = message;
        const { retryable, message: errorMsg } = error;

        if (retryable && pendingRequest.retryCount < this.#maxRetries) {
            // 重试逻辑
            pendingRequest.retryCount++;
            this.#logger.warn(`页面请求失败，进行第 ${pendingRequest.retryCount} 次重试: ${errorMsg}`);
            
            setTimeout(() => {
                this.#retryRequest(requestId);
            }, this.#retryDelay * pendingRequest.retryCount);
            
        } else {
            // 最终失败
            const error = new Error(`页面加载失败: ${errorMsg}`);
            pendingRequest.reject(error);
            this.#pendingRequests.delete(requestId);
            
            this.#logger.error(`页面请求最终失败: ${errorMsg}`);
        }
    }

    /**
     * 处理页面渲染请求
     * @param {Object} data - 渲染请求数据
     * @private
     */
    async #handlePageRenderRequest(data) {
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
     * @private
     */
    #handleNavigationChange(data) {
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
     * 处理请求超时
     * @param {string} requestId - 请求ID
     * @private
     */
    #handleRequestTimeout(requestId) {
        const pendingRequest = this.#pendingRequests.get(requestId);
        if (!pendingRequest) {
            return;
        }

        if (pendingRequest.retryCount < this.#maxRetries) {
            // 重试
            pendingRequest.retryCount++;
            this.#logger.warn(`请求超时，进行第 ${pendingRequest.retryCount} 次重试`);
            
            setTimeout(() => {
                this.#retryRequest(requestId);
            }, this.#retryDelay * pendingRequest.retryCount);
            
        } else {
            // 最终失败
            const error = new Error('页面请求超时');
            pendingRequest.reject(error);
            this.#pendingRequests.delete(requestId);
            
            this.#logger.error('页面请求最终超时');
        }
    }

    /**
     * 重试请求
     * @param {string} requestId - 请求ID
     * @private
     */
    #retryRequest(requestId) {
        const pendingRequest = this.#pendingRequests.get(requestId);
        if (!pendingRequest) {
            return;
        }

        const { fileId, pageNumber, compression } = pendingRequest;
        
        const message = {
            type: 'pdf_page_request',
            request_id: this._generateRequestId(),
            timestamp: Date.now(),
            data: {
                file_id: fileId,
                page_number: pageNumber,
                compression: compression
            }
        };

        this.#sendWebSocketMessage(message);
    }

    /**
     * 处理页面数据（解压缩等）
     * @param {Object} pageData - 原始页面数据
     * @returns {Object} 处理后的页面数据
     * @private
     */
    #processPageData(pageData) {
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
     * @private
     */
    #sendWebSocketMessage(message) {
        if (this.#wsClient && this.#wsClient.readyState === WebSocket.OPEN) {
            this.#wsClient.send(JSON.stringify(message));
        } else {
            this.#logger.warn('WebSocket未连接，无法发送消息');
            throw new Error('WebSocket连接不可用');
        }
    }

    /**
     * 从缓存中获取页面
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @returns {Object|null} 页面数据或null
     * @private
     */
    #getFromCache(fileId, pageNumber) {
        if (!this.#pageCache.has(fileId)) {
            return null;
        }

        const fileCache = this.#pageCache.get(fileId);
        return fileCache.get(pageNumber) || null;
    }

    /**
     * 添加页面到缓存
     * @param {string} fileId - 文件ID
     * @param {number} pageNumber - 页面编号
     * @param {Object} pageData - 页面数据
     * @private
     */
    #addToCache(fileId, pageNumber, pageData) {
        if (!this.#pageCache.has(fileId)) {
            this.#pageCache.set(fileId, new Map());
        }

        const fileCache = this.#pageCache.get(fileId);
        fileCache.set(pageNumber, pageData);

        // 如果缓存超过限制，清理最旧的页面
        if (fileCache.size > this.#maxCacheSize) {
            this.#cleanupCache(fileId);
        }
    }

    /**
     * 清理文件缓存（保留最新的页面）
     * @param {string} fileId - 文件ID
     * @private
     */
    #cleanupCache(fileId) {
        const fileCache = this.#pageCache.get(fileId);
        if (!fileCache || fileCache.size <= this.#maxCacheSize) {
            return;
        }

        // 按时间排序并保留最新的页面
        const sortedPages = Array.from(fileCache.entries())
            .sort(([, a], [, b]) => b.processedAt - a.processedAt)
            .slice(0, this.#maxCacheSize);

        const newCache = new Map(sortedPages);
        this.#pageCache.set(fileId, newCache);
    }

    /**
     * 清理所有缓存
     * @private
     */
    #clearAllCache() {
        this.#pageCache.clear();
        this.#logger.debug('清理所有页面缓存');
    }

    /**
     * 生成唯一的请求ID
     * @returns {string} 请求ID
     * @private
     */
    _generateRequestId() {
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
        this.#clearAllCache();
        this.#pendingRequests.clear();
        this.#activePreloads.clear();
        this.#logger.info('PageTransferManager已销毁');
    }
}