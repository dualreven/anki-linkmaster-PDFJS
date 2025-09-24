/**
 * @file PDF页面传输管理器 - 前端按需分页加载实现
 * @module PageTransferManager
 * @description 负责PDF页面的按需加载、缓存管理和传输优化
 */

import { PageTransferCore } from "./page-transfer-core.js";
import { WebSocketHandler } from "./websocket-handler.js";

/**
 * @class PageTransferManager
 * @description PDF页面传输管理器，处理按需分页加载和缓存优化
 */
export class PageTransferManager extends PageTransferCore {
  #websocketHandler;

  constructor(eventBus, wsClient) {
    super(eventBus, wsClient);
    this.#websocketHandler = new WebSocketHandler(this);
    this.setupEventListeners();
  }

  /**
   * 处理WebSocket消息
   * @param {Object} message - WebSocket消息
   */
  handleWebSocketMessage(message) {
    this.#websocketHandler.handleWebSocketMessage(message);
  }

  /**
   * 处理页面响应
   * @param {Object} message - 响应消息
   * @param {string} requestId - 请求ID
   */
  handlePageResponse(message, requestId) {
    this.#websocketHandler.handlePageResponse(message, requestId);
  }

  /**
   * 处理页面错误
   * @param {Object} message - 错误消息
   * @param {string} requestId - 请求ID
   */
  handlePageError(message, requestId) {
    this.#websocketHandler.handlePageError(message, requestId);
  }

  /**
   * 处理请求超时
   * @param {string} requestId - 请求ID
   */
  handleRequestTimeout(requestId) {
    this.#websocketHandler.handleRequestTimeout(requestId);
  }

  /**
   * 重试请求
   * @param {string} requestId - 请求ID
   */
  retryRequest(requestId) {
    this.#websocketHandler.retryRequest(requestId);
  }

  /**
   * 处理页面数据（解压缩等）
   * @param {Object} pageData - 原始页面数据
   * @returns {Object} 处理后的页面数据
   */
  processPageData(pageData) {
    return this.#websocketHandler.processPageData(pageData);
  }

  /**
   * 发送WebSocket消息
   * @param {Object} message - 消息对象
   */
  sendWebSocketMessage(message) {
    this.#websocketHandler.sendWebSocketMessage(message);
  }

  /**
   * 从缓存中获取页面
   * @param {string} fileId - 文件ID
   * @param {number} pageNumber - 页面编号
   * @returns {Object|null} 页面数据或null
   */
  getFromCache(fileId, pageNumber) {
    return this.#websocketHandler.getFromCache(fileId, pageNumber);
  }

  /**
   * 添加页面到缓存
   * @param {string} fileId - 文件ID
   * @param {number} pageNumber - 页面编号
   * @param {Object} pageData - 页面数据
   */
  addToCache(fileId, pageNumber, pageData) {
    this.#websocketHandler.addToCache(fileId, pageNumber, pageData);
  }

  /**
   * 清理文件缓存（保留最新的页面）
   * @param {string} fileId - 文件ID
   */
  cleanupCache(fileId) {
    this.#websocketHandler.cleanupCache(fileId);
  }

  /**
   * 清理所有缓存
   */
  clearAllCache() {
    this.#websocketHandler.clearAllCache();
  }
}