/**
 * @file PDF查看器事件处理器（重构版）
 * @module EventHandlersRefactored
 * @description 协调所有事件处理器子模块
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { NavigationHandler } from "./navigation-handler.js";
import { ZoomHandler } from "./zoom-handler.js";
import { FileHandler } from "./file-handler.js";

/**
 * 事件处理器协调器类
 * 整合所有事件处理子模块
 */
export class EventHandlers {
  #app;
  #logger;
  #navigationHandler;
  #zoomHandler;
  #fileHandler;
  #initialized = false;

  /**
   * 创建事件处理器实例
   * @param {PDFViewerAppCore} app - 应用核心实例
   */
  constructor(app) {
    this.#app = app;
    this.#logger = getLogger("EventHandlers");

    // 初始化子处理器
    this.#navigationHandler = new NavigationHandler(app);
    this.#zoomHandler = new ZoomHandler(app);
    this.#fileHandler = new FileHandler(app);
  }

  /**
   * 设置所有事件监听器
   */
  setupEventListeners() {
    if (this.#initialized) {
      this.#logger.warn("Event listeners already initialized");
      return;
    }

    try {
      this.#logger.info("Setting up event listeners...");

      // 设置各子模块的事件监听器
      this.#navigationHandler.setupEventListeners();
      this.#zoomHandler.setupEventListeners();
      this.#fileHandler.setupEventListeners();

      // 设置应用级别事件
      this.#setupAppEventListeners();

      this.#initialized = true;
      this.#logger.info("All event listeners setup complete");

    } catch (error) {
      this.#logger.error("Failed to setup event listeners:", error);
      throw error;
    }
  }

  /**
   * 设置应用级别的事件监听器
   * @private
   */
  #setupAppEventListeners() {
    // 已初始化状态事件
    this.#app.eventBus.on(
      PDF_VIEWER_EVENTS.STATE.INITIALIZED,
      this.#app.onInitialized.bind(this.#app),
      { subscriberId: 'EventHandlers.App' }
    );

    this.#logger.info("Application event listeners setup");
  }

  // ========== 代理方法 - 文件处理 ==========

  /**
   * 处理文件加载请求
   * @param {Object} fileData - 文件数据
   */
  async handleFileLoadRequested(fileData) {
    return this.#fileHandler.handleLoadRequested(fileData);
  }

  /**
   * 处理文件加载进度
   * @param {Object} progressData - 进度数据
   */
  handleFileLoadProgress(progressData) {
    return this.#fileHandler.handleLoadProgress(progressData);
  }

  /**
   * 处理文件加载重试
   * @param {Object} fileData - 文件数据
   */
  async handleFileLoadRetry(fileData) {
    return this.#fileHandler.handleLoadRetry(fileData);
  }

  /**
   * 处理文件关闭
   */
  async handleFileClose() {
    return this.#fileHandler.handleFileClose();
  }

  // ========== 代理方法 - 导航 ==========

  /**
   * 处理页面跳转
   * @param {Object} data - 跳转数据
   */
  async handleNavigationGoto(data) {
    return this.#navigationHandler.handleGoto(data);
  }

  /**
   * 处理上一页导航
   */
  async handleNavigationPrevious() {
    return this.#navigationHandler.handlePrevious();
  }

  /**
   * 处理下一页导航
   */
  async handleNavigationNext() {
    return this.#navigationHandler.handleNext();
  }

  /**
   * 渲染指定页面
   * @param {number} pageNumber - 页面编号
   */
  async renderPage(pageNumber) {
    // 使用导航处理器的内部渲染方法
    return this.#navigationHandler.handleGoto({ pageNumber });
  }

  // ========== 代理方法 - 缩放 ==========

  /**
   * 处理放大操作
   */
  handleZoomIn() {
    return this.#zoomHandler.handleZoomIn();
  }

  /**
   * 处理缩小操作
   */
  handleZoomOut() {
    return this.#zoomHandler.handleZoomOut();
  }

  /**
   * 处理适应宽度操作
   */
  async handleZoomFitWidth() {
    return this.#zoomHandler.handleFitWidth();
  }

  /**
   * 处理适应高度操作
   */
  async handleZoomFitHeight() {
    return this.#zoomHandler.handleFitHeight();
  }

  /**
   * 处理实际大小操作
   */
  handleZoomActualSize() {
    return this.#zoomHandler.handleActualSize();
  }

  /**
   * 处理缩放改变事件
   * @param {Object} data - 缩放数据
   */
  handleZoomChanged(data) {
    return this.#zoomHandler.handleZoomChanged(data);
  }

  /**
   * 应用缩放设置
   */
  async applyZoom() {
    // 直接调用缩放处理器的方法
    return this.#zoomHandler.handleSetScale({ scale: this.#app.zoomLevel });
  }

  // ========== 获取器方法 ==========

  /**
   * 获取导航处理器
   * @returns {NavigationHandler} 导航处理器实例
   */
  getNavigationHandler() {
    return this.#navigationHandler;
  }

  /**
   * 获取缩放处理器
   * @returns {ZoomHandler} 缩放处理器实例
   */
  getZoomHandler() {
    return this.#zoomHandler;
  }

  /**
   * 获取文件处理器
   * @returns {FileHandler} 文件处理器实例
   */
  getFileHandler() {
    return this.#fileHandler;
  }

  /**
   * 获取当前状态
   * @returns {Object} 当前状态信息
   */
  getState() {
    return {
      currentPage: this.#navigationHandler.getCurrentPage(),
      totalPages: this.#navigationHandler.getTotalPages(),
      zoomLevel: this.#zoomHandler.getCurrentScale(),
      zoomPercentage: this.#zoomHandler.getZoomPercentage(),
      currentFile: this.#fileHandler.getCurrentFile(),
      isLoading: this.#fileHandler.isLoading(),
      loadProgress: this.#fileHandler.getLoadProgress()
    };
  }

  /**
   * 重置所有处理器
   */
  reset() {
    this.#logger.info("Resetting all event handlers...");

    this.#zoomHandler.reset();
    // Navigation和File处理器的重置通过关闭文件实现
    if (this.#app.currentFile) {
      this.handleFileClose();
    }

    this.#logger.info("All event handlers reset");
  }

  /**
   * 销毁事件处理器
   */
  destroy() {
    this.#logger.info("Destroying event handlers...");

    // 销毁所有子处理器
    this.#navigationHandler.destroy();
    this.#zoomHandler.destroy();
    this.#fileHandler.destroy();

    this.#initialized = false;
    this.#logger.info("Event handlers destroyed");
  }
}