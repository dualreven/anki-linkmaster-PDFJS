/**
 * @file PDF查看器事件处理器模块
 * @module EventHandlers
 * @description 处理PDF查看器的所有事件监听和响应
 */

import PDF_VIEWER_EVENTS from "../common/event/pdf_viewer-constants.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../common/event/event-constants.js";

/**
 * @class EventHandlers
 * @description PDF查看器事件处理器，负责设置和管理所有事件监听器
 */
export class EventHandlers {
  #app;

  /**
   * 创建事件处理器实例
   * @param {PDFViewerAppCore} app - 应用核心实例
   */
  constructor(app) {
    this.#app = app;
  }

  /**
   * 设置所有事件监听器
   */
  setupEventListeners() {
    // 特定WebSocket消息接收事件
    this.#app.eventBus.on(WEBSOCKET_MESSAGE_EVENTS.LOAD_PDF_FILE, (message) => {
      this.#app.handleWebSocketMessage(message);
    });

    // 文件加载事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (fileData) => {
      this.handleFileLoadRequested(fileData);
    });

    // 页面导航事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => {
      this.handleNavigationGoto(data);
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => {
      this.handleNavigationPrevious();
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => {
      this.handleNavigationNext();
    });

    // 缩放控制事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, () => {
      this.handleZoomIn();
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, () => {
      this.handleZoomOut();
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
      this.handleZoomFitWidth();
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
      this.handleZoomFitHeight();
    });

    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
      this.handleZoomActualSize();
    });

    // 缩放改变事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
      this.handleZoomChanged(data);
    });

    // 文件关闭事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.FILE.CLOSE, () => {
      this.handleFileClose();
    });

    // 文件加载进度事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, (progressData) => {
      this.handleFileLoadProgress(progressData);
    });

    // 已初始化状态事件
    this.#app.eventBus.on(PDF_VIEWER_EVENTS.STATE.INITIALIZED, this.#app.onInitialized.bind(this.#app));
  }

  /**
   * 处理文件加载请求
   * @param {Object} fileData - 文件数据
   */
  async handleFileLoadRequested(fileData) {
    try {
      this.#app.logger.info("Handling file load request:", fileData);

      // 先关闭当前文件（如果有）
      if (this.#app.currentFile) {
        await this.handleFileClose();
      }

      // 显示加载状态
      this.#app.uiManager.showLoading(true);
      this.#app.uiManager.updateProgress(0, '开始加载');

      // 支持新消息格式 (file_path 优先)
      if (fileData.file_path) {
        this.#app.logger.info("Detected file_path in request, constructing proxy URL");
        fileData.url = `/pdfs/${encodeURIComponent(fileData.filename)}`;
      }

      // 加载PDF文档
      const pdfDocument = await this.#app.pdfManager.loadPDF(fileData);
      this.#app.currentFile = fileData;
      this.#app.totalPages = pdfDocument.numPages;

      // 隐藏进度条
      this.#app.uiManager.hideProgress();
      this.#app.uiManager.showLoading(false);

      // 更新状态并触发渲染
      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
        file: fileData,
        totalPages: this.#app.totalPages
      }, { actorId: 'PDFViewerApp' });

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
        this.#app.totalPages, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的页面信息
      this.#app.uiManager.updatePageInfo(1, this.#app.totalPages);

      // 渲染第一页
      await this.renderPage(1);

    } catch (error) {
      this.#app.logger.error("Failed to load PDF file:", error);
      this.#app.uiManager.hideProgress();
      this.#app.uiManager.showLoading(false);

      // 显示用户友好的错误信息
      this.#app.uiManager.showError(error);

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, {
        error: error.message,
        file: fileData
      }, { actorId: 'PDFViewerApp' });
      this.#app.errorHandler.handleError(error, "PDFLoad");
    }
  }

  /**
   * 处理页面跳转
   * @param {Object} data - 跳转数据
   */
  async handleNavigationGoto(data) {
    const pageNumber = parseInt(data.pageNumber);
    if (pageNumber >= 1 && pageNumber <= this.#app.totalPages) {
      this.#app.currentPage = pageNumber;
      await this.renderPage(pageNumber);

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#app.currentPage,
        totalPages: this.#app.totalPages
      }, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的页面信息
      this.#app.uiManager.updatePageInfo(this.#app.currentPage, this.#app.totalPages);
    }
  }

  /**
   * 处理上一页导航
   */
  async handleNavigationPrevious() {
    if (this.#app.currentPage > 1) {
      this.#app.currentPage--;
      await this.renderPage(this.#app.currentPage);

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#app.currentPage,
        totalPages: this.#app.totalPages
      }, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的页面信息
      this.#app.uiManager.updatePageInfo(this.#app.currentPage, this.#app.totalPages);
    }
  }

  /**
   * 处理下一页导航
   */
  async handleNavigationNext() {
    if (this.#app.currentPage < this.#app.totalPages) {
      this.#app.currentPage++;
      await this.renderPage(this.#app.currentPage);

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, {
        currentPage: this.#app.currentPage,
        totalPages: this.#app.totalPages
      }, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的页面信息
      this.#app.uiManager.updatePageInfo(this.#app.currentPage, this.#app.totalPages);
    }
  }

  /**
   * 渲染指定页面
   * @param {number} pageNumber - 页面编号
   */
  async renderPage(pageNumber) {
    try{
      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_REQUESTED, {
        pageNumber,
        totalPages: this.#app.totalPages
      }, { actorId: 'PDFViewerApp' });

      const page = await this.#app.pdfManager.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.#app.zoomLevel });

      await this.#app.uiManager.renderPage(page, viewport);

      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, {
        pageNumber,
        viewport
      }, { actorId: 'PDFViewerApp' });

    } catch (error) {
      this.#app.logger.error(`Failed to render page ${pageNumber}:`, error);
      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.RENDER.PAGE_FAILED, {
        pageNumber,
        error: error.message
      }, { actorId: 'PDFViewerApp' });
      this.#app.errorHandler.handleError(error, "PageRender");
    }
  }

  /**
   * 处理放大操作
   */
  handleZoomIn() {
    this.#app.zoomLevel = Math.min(this.#app.zoomLevel + 0.25, 3.0);
    this.applyZoom();
  }

  /**
   * 处理缩小操作
   */
  handleZoomOut() {
    this.#app.zoomLevel = Math.max(this.#app.zoomLevel - 0.25, 0.5);
    this.applyZoom();
  }

  /**
   * 处理适应宽度操作
   */
  async handleZoomFitWidth() {
    if (this.#app.currentFile && this.#app.currentPage > 0) {
      const page = await this.#app.pdfManager.getPage(this.#app.currentPage);
      const containerWidth = this.#app.uiManager.getContainerWidth();
      const viewport = page.getViewport({ scale: 1 });
      this.#app.zoomLevel = containerWidth / viewport.width;
      this.applyZoom();
    }
  }

  /**
   * 处理适应高度操作
   */
  async handleZoomFitHeight() {
    if (this.#app.currentFile && this.#app.currentPage > 0) {
      const page = await this.#app.pdfManager.getPage(this.#app.currentPage);
      const containerHeight = this.#app.uiManager.getContainerHeight();
      const viewport = page.getViewport({ scale: 1 });
      this.#app.zoomLevel = containerHeight / viewport.height;
      this.applyZoom();
    }
  }

  /**
   * 处理实际大小操作
   */
  handleZoomActualSize() {
    this.#app.zoomLevel = 1.0;
    this.applyZoom();
  }

  /**
   * 应用缩放设置
   */
  async applyZoom() {
    if (this.#app.currentFile && this.#app.currentPage > 0) {
      this.#app.eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.CHANGED, {
        zoomLevel: this.#app.zoomLevel
      }, { actorId: 'PDFViewerApp' });

      // 更新UI管理器中的缩放比例
      this.#app.uiManager.setScale(this.#app.zoomLevel);

      // 重新渲染当前页面
      await this.renderPage(this.#app.currentPage);
    }
  }

  /**
   * 处理缩放改变事件
   * @param {Object} data - 缩放数据
   */
  handleZoomChanged(data) {
    if (data && data.zoomLevel) {
      this.#app.zoomLevel = data.zoomLevel;
      // UI管理器已经通过setScale方法更新显示
      this.#app.logger.debug(`Zoom level changed to: ${this.#app.zoomLevel}`);
    }
  }

  /**
   * 处理文件加载进度
   * @param {Object} progressData - 进度数据
   */
  handleFileLoadProgress(progressData) {
    this.#app.logger.debug(`File load progress: ${progressData.percent}%`);
    this.#app.uiManager.updateProgress(progressData.percent, '加载中');
  }

  /**
   * 处理文件加载重试
   * @param {Object} fileData - 文件数据
   */
  async handleFileLoadRetry(fileData) {
    this.#app.logger.info("Retrying file load:", fileData);
    this.#app.uiManager.hideError();
    this.#app.eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, fileData, {
      actorId: 'PDFViewerApp'
    });
  }

  /**
   * 处理文件关闭
   */
  async handleFileClose() {
    this.#app.logger.info("Closing current PDF file");

    // 清理资源
    this.#app.pdfManager.cleanup();
    this.#app.uiManager.cleanup();

    this.#app.currentFile = null;
    this.#app.currentPage = 1;
    this.#app.totalPages = 0;
    this.#app.zoomLevel = 1.0;

    this.#app.eventBus.emit(PDF_VIEWER_EVENTS.STATE.LOADING, false, {
      actorId: 'PDFViewerApp'
    });
  }
}