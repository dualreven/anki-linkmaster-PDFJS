/**
 * @file 文件事件处理器
 * @module FileHandler
 * @description 处理PDF查看器的文件加载相关事件
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_EVENTS } from "../../common/event/event-constants.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * 文件处理器类
 * 负责处理所有文件加载相关的事件
 */
export class FileHandler {
  #app;
  #logger;
  #loadingState = {
    isLoading: false,
    currentFile: null,
    progress: 0
  };

  constructor(app) {
    this.#app = app;
    this.#logger = getLogger("FileHandler");
  }

  /**
   * 设置文件相关的事件监听器
   */
  setupEventListeners() {
    const eventBus = this.#app.eventBus;

    // WebSocket消息接收事件
    eventBus.on(WEBSOCKET_MESSAGE_EVENTS.LOAD_PDF_FILE, (message) => {
      this.handleWebSocketMessage(message);
    }, { subscriberId: 'FileHandler' });

    // 文件加载请求
    eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED, (fileData) => {
      this.handleLoadRequested(fileData);
    }, { subscriberId: 'FileHandler' });

    // 文件加载进度
    eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, (progressData) => {
      this.handleLoadProgress(progressData);
    }, { subscriberId: 'FileHandler' });

    // 注意: RETRY 事件在当前版本中未定义
    // 如果需要，可以通过其他方式实现重试功能

    // 文件关闭
    eventBus.on(PDF_VIEWER_EVENTS.FILE.CLOSE, () => {
      this.handleFileClose();
    }, { subscriberId: 'FileHandler' });

    // 注意: DOWNLOAD 事件在当前版本中未定义
    // 可通过其他方式触发下载功能

    this.#logger.info("File event listeners setup complete");
  }

  /**
   * 处理WebSocket消息
   * @param {Object} message - WebSocket消息
   */
  handleWebSocketMessage(message) {
    this.#logger.info("Received WebSocket message for PDF loading:", message);
    this.#app.handleWebSocketMessage(message);
  }

  /**
   * 处理文件加载请求
   * @param {Object} fileData - 文件数据
   */
  async handleLoadRequested(fileData) {
    // 防止重复加载
    if (this.#loadingState.isLoading) {
      this.#logger.warn("Another file is already loading");
      return;
    }

    try {
      this.#logger.info("Handling file load request:", fileData);
      this.#setLoadingState(true, fileData);

      // 先关闭当前文件（如果有）
      if (this.#app.currentFile) {
        await this.handleFileClose();
      }

      // 显示加载状态
      this.#showLoadingUI();

      // 处理文件路径
      const processedFileData = this.#processFileData(fileData);

      // 加载PDF文档
      const pdfDocument = await this.#loadPDFDocument(processedFileData);

      // 更新应用状态
      this.#updateAppState(processedFileData, pdfDocument);

      // 隐藏加载UI
      this.#hideLoadingUI();

      // 发送成功事件
      this.#emitLoadSuccess(processedFileData, pdfDocument);

      // 渲染第一页
      await this.#renderInitialPage();

      this.#logger.info(`PDF loaded successfully: ${processedFileData.filename}`);

    } catch (error) {
      this.#handleLoadError(error, fileData);
    } finally {
      this.#setLoadingState(false, null);
    }
  }

  /**
   * 处理文件加载进度
   * @param {Object} progressData - 进度数据
   */
  handleLoadProgress(progressData) {
    this.#loadingState.progress = progressData.percent || 0;

    this.#logger.debug(`File load progress: ${this.#loadingState.progress}%`);

    this.#app.uiManager.updateProgress(
      this.#loadingState.progress,
      progressData.message || '加载中'
    );
  }

  /**
   * 处理文件加载重试
   * @param {Object} fileData - 文件数据
   */
  async handleLoadRetry(fileData) {
    this.#logger.info("Retrying file load:", fileData);

    // 清除错误状态
    this.#app.uiManager.hideError();

    // 重新发送加载请求
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      fileData,
      { actorId: 'FileHandler.Retry' }
    );
  }

  /**
   * 处理文件关闭
   */
  async handleFileClose() {
    if (!this.#app.currentFile) {
      this.#logger.debug("No file to close");
      return;
    }

    this.#logger.info(`Closing file: ${this.#app.currentFile.filename}`);

    try {
      // 清理PDF管理器资源
      this.#app.pdfManager.cleanup();

      // 清理UI管理器
      this.#app.uiManager.cleanup();

      // 重置应用状态
      this.#resetAppState();

      // 发送状态改变事件
      this.#app.eventBus.emit(
        PDF_VIEWER_EVENTS.STATE.LOADING,
        false,
        { actorId: 'FileHandler' }
      );

      this.#logger.info("File closed successfully");

    } catch (error) {
      this.#logger.error("Error closing file:", error);
      this.#app.errorHandler.handleError(error, "FileClose");
    }
  }

  /**
   * 处理文件下载
   */
  async handleFileDownload() {
    if (!this.#app.currentFile) {
      this.#logger.warn("No file to download");
      return;
    }

    try {
      const fileUrl = this.#app.currentFile.url || this.#app.currentFile.file_path;
      const filename = this.#app.currentFile.filename;

      this.#logger.info(`Downloading file: ${filename}`);

      // 创建下载链接
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = filename;
      link.click();

      this.#logger.info("Download initiated");

    } catch (error) {
      this.#logger.error("Failed to download file:", error);
      this.#app.errorHandler.handleError(error, "FileDownload");
    }
  }

  /**
   * 处理文件数据
   * @param {Object} fileData - 原始文件数据
   * @returns {Object} 处理后的文件数据
   * @private
   */
  #processFileData(fileData) {
    const processed = { ...fileData };

    // 支持新消息格式 (file_path 优先)
    if (processed.file_path && !processed.url) {
      this.#logger.info("Detected file_path in request, constructing proxy URL");
      processed.url = `/pdfs/${encodeURIComponent(processed.filename)}`;
    }

    // 确保有文件名
    if (!processed.filename && processed.url) {
      processed.filename = this.#extractFilenameFromUrl(processed.url);
    }

    return processed;
  }

  /**
   * 从URL提取文件名
   * @param {string} url - 文件URL
   * @returns {string} 文件名
   * @private
   */
  #extractFilenameFromUrl(url) {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return decodeURIComponent(filename.split('?')[0]);
  }

  /**
   * 加载PDF文档
   * @param {Object} fileData - 文件数据
   * @returns {Promise<Object>} PDF文档对象
   * @private
   */
  async #loadPDFDocument(fileData) {
    try {
      const pdfDocument = await this.#app.pdfManager.loadPDF(fileData);

      if (!pdfDocument || !pdfDocument.numPages) {
        throw new Error("Invalid PDF document");
      }

      return pdfDocument;

    } catch (error) {
      this.#logger.error("Failed to load PDF document:", error);
      throw error;
    }
  }

  /**
   * 更新应用状态
   * @param {Object} fileData - 文件数据
   * @param {Object} pdfDocument - PDF文档
   * @private
   */
  #updateAppState(fileData, pdfDocument) {
    this.#app.currentFile = fileData;
    this.#app.totalPages = pdfDocument.numPages;
    this.#app.currentPage = 1;

    // 更新UI管理器中的页面信息
    this.#app.uiManager.updatePageInfo(1, this.#app.totalPages);
  }

  /**
   * 重置应用状态
   * @private
   */
  #resetAppState() {
    this.#app.currentFile = null;
    this.#app.currentPage = 1;
    this.#app.totalPages = 0;
    this.#app.zoomLevel = 1.0;
  }

  /**
   * 设置加载状态
   * @param {boolean} isLoading - 是否正在加载
   * @param {Object} fileData - 文件数据
   * @private
   */
  #setLoadingState(isLoading, fileData) {
    this.#loadingState.isLoading = isLoading;
    this.#loadingState.currentFile = fileData;
    this.#loadingState.progress = isLoading ? 0 : 100;
  }

  /**
   * 显示加载UI
   * @private
   */
  #showLoadingUI() {
    this.#app.uiManager.showLoading(true);
    this.#app.uiManager.updateProgress(0, '开始加载');
  }

  /**
   * 隐藏加载UI
   * @private
   */
  #hideLoadingUI() {
    this.#app.uiManager.hideProgress();
    this.#app.uiManager.showLoading(false);
  }

  /**
   * 发送加载成功事件
   * @param {Object} fileData - 文件数据
   * @param {Object} pdfDocument - PDF文档
   * @private
   */
  #emitLoadSuccess(fileData, pdfDocument) {
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      {
        file: fileData,
        totalPages: pdfDocument.numPages
      },
      { actorId: 'FileHandler' }
    );

    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.TOTAL_PAGES_UPDATED,
      pdfDocument.numPages,
      { actorId: 'FileHandler' }
    );
  }

  /**
   * 渲染初始页面
   * @private
   */
  async #renderInitialPage() {
    try {
      this.#logger.info("Rendering initial page...");
      this.#logger.debug("Getting page 1 from PDFManager...");
      const page = await this.#app.pdfManager.getPage(1);
      this.#logger.info("Got page 1 from PDFManager");

      this.#logger.debug(`Creating viewport with scale ${this.#app.zoomLevel}...`);
      const viewport = page.getViewport({ scale: this.#app.zoomLevel });
      this.#logger.info(`Created viewport: ${viewport.width}x${viewport.height}, scale=${this.#app.zoomLevel}`);

      this.#logger.debug("Calling uiManager.renderPage...");
      await this.#app.uiManager.renderPage(page, viewport);
      this.#logger.info("Initial page rendered successfully");
    } catch (error) {
      this.#logger.error("Failed to render initial page:", error);
      throw error;
    }
  }

  /**
   * 处理加载错误
   * @param {Error} error - 错误对象
   * @param {Object} fileData - 文件数据
   * @private
   */
  #handleLoadError(error, fileData) {
    this.#logger.error("Failed to load PDF file:", error);

    // 隐藏加载UI
    this.#hideLoadingUI();

    // 显示错误信息
    this.#app.uiManager.showError(error);

    // 发送失败事件
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      {
        error: error.message,
        file: fileData
      },
      { actorId: 'FileHandler' }
    );

    this.#app.errorHandler.handleError(error, "PDFLoad");
  }

  /**
   * 获取当前文件信息
   * @returns {Object|null} 文件信息
   */
  getCurrentFile() {
    return this.#app.currentFile;
  }

  /**
   * 是否正在加载
   * @returns {boolean} 加载状态
   */
  isLoading() {
    return this.#loadingState.isLoading;
  }

  /**
   * 获取加载进度
   * @returns {number} 进度百分比
   */
  getLoadProgress() {
    return this.#loadingState.progress;
  }

  /**
   * 销毁处理器
   */
  destroy() {
    this.#setLoadingState(false, null);
    this.#logger.info("File handler destroyed");
  }
}