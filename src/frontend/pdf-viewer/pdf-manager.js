/**
 * @file PDF管理器，负责PDF文档的加载、页面获取和资源管理
 * @module PDFManager
 * @description 基于PDF.js的PDF文档管理模块
 */

import Logger from "../common/utils/logger.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf-viewer-constants.js";
import { WebGLStateManager } from "../common/utils/webgl-detector.js";
import ERROR_CODES from "../common/constants/error-codes.js";

// PDF.js 配置
const PDFJS_CONFIG = {
  workerSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
  // CMap配置 - 禁用CMap支持以优化性能和兼容性
  cMapUrl: null,
  cMapPacked: false,
  // 跨域资源加载配置
  withCredentials: false,
  // 内存优化配置
  maxImageSize: -1, // 无限制
  disableAutoFetch: false,
  disableStream: false,
  disableRange: false,
  // QtWebEngine兼容性配置
  isEvalSupported: true,
  useSystemFonts: false
};

/**
 * @class PDFManager
 * @description PDF文档管理器，处理PDF加载、页面获取和资源清理
 */
export class PDFManager {
  #eventBus;
  #logger;
  #pdfjsLib = null;
  #currentDocument = null;
  #pagesCache = new Map();

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = new Logger("PDFManager");
  }

  /**
   * 初始化PDF管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing PDF Manager...");
      // 检测WebGL状态并配置PDF.js
      const webglState = WebGLStateManager.getWebGLState();
      this.#logger.info("WebGL State:", webglState);
      
      
      // 动态导入PDF.js库
      this.#pdfjsLib = await import('pdfjs-dist/build/pdf');
      // 如果WebGL被禁用或需要回退到Canvas，配置PDF.js使用Canvas渲染
      if (WebGLStateManager.shouldUseCanvasFallback()) {
        this.#configurePDFJSForCanvas();
        this.#logger.info("PDF.js configured for Canvas rendering (WebGL disabled)");
      }
      
      
      // 配置PDF.js worker
      this.#pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CONFIG.workerSrc;
      
      this.#logger.info("PDF Manager initialized successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize PDF Manager:", error);
      throw error;
    }
  }

  /**
   * 配置PDF.js使用Canvas渲染
   * @private
   */
  #configurePDFJSForCanvas() {
    try {
      // 设置PDF.js使用Canvas渲染
      if (this.#pdfjsLib.GlobalWorkerOptions) {
        // 禁用WebGL相关功能
        this.#pdfjsLib.GlobalWorkerOptions.disableWebGL = true;
        this.#pdfjsLib.GlobalWorkerOptions.enableWebGL = false;
      }

      // 设置渲染器偏好为Canvas
      if (this.#pdfjsLib.setPreferences) {
        this.#pdfjsLib.setPreferences({
          'renderer': 'canvas',
          'enableWebGL': false
        });
      }

      this.#logger.debug("PDF.js configured for Canvas rendering");
    } catch (error) {
      this.#logger.warn("Failed to configure PDF.js for Canvas:", error);
    }
  }

  /**
   * 加载PDF文档
   * @param {Object} fileData - 文件数据
   * @returns {Promise<Object>} PDF文档对象
   */
  async loadPDF(fileData) {
    try {
      this.#logger.info("Loading PDF document:", fileData.filename);
      
      // 清理之前的文档
      this.cleanup();
      
      let pdfData;
      
      if (fileData.url) {
        // 从URL加载
        pdfData = await this.#loadFromURL(fileData.url);
      } else if (fileData.arrayBuffer) {
        // 从ArrayBuffer加载
        pdfData = await this.#loadFromArrayBuffer(fileData.arrayBuffer);
      } else if (fileData.blob) {
        // 从Blob加载
        pdfData = await this.#loadFromBlob(fileData.blob);
      } else {
        throw new Error("Unsupported file data format");
      }
      
      this.#currentDocument = pdfData;
      this.#pagesCache.clear();
      
      this.#logger.info(`PDF document loaded successfully. Pages: ${pdfData.numPages}`);
      
      return pdfData;
      
    } catch (error) {
      const classifiedError = this.#classifyPDFError(error, fileData);
      this.#logger.error("Failed to load PDF document:", classifiedError);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, classifiedError, { 
        actorId: 'PDFManager' 
      });
      throw classifiedError;
    }
  }

  /**
   * 从URL加载PDF文档
   * @param {string} url - PDF文件URL
   * @returns {Promise<Object>} PDF文档对象
   * @private
   */
  async #loadFromURL(url) {
    this.#logger.debug("Loading PDF from URL:", url);
    
    const loadingTask = this.#pdfjsLib.getDocument({
      url: url,
      withCredentials: PDFJS_CONFIG.withCredentials,
      maxImageSize: PDFJS_CONFIG.maxImageSize,
      disableAutoFetch: PDFJS_CONFIG.disableAutoFetch,
      disableStream: PDFJS_CONFIG.disableStream,
      disableRange: PDFJS_CONFIG.disableRange,
      isEvalSupported: PDFJS_CONFIG.isEvalSupported,
      useSystemFonts: PDFJS_CONFIG.useSystemFonts
    });
    
    // 设置进度回调
    loadingTask.onProgress = (progressData) => {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, {
        loaded: progressData.loaded,
        total: progressData.total,
        percent: progressData.total > 0 ? Math.round((progressData.loaded / progressData.total) * 100) : 0
      }, { actorId: 'PDFManager' });
    };
    
    return await loadingTask.promise;
  }

  /**
   * 从ArrayBuffer加载PDF文档
   * @param {ArrayBuffer} arrayBuffer - PDF文件数据
   * @returns {Promise<Object>} PDF文档对象
   * @private
   */
  async #loadFromArrayBuffer(arrayBuffer) {
    this.#logger.debug("Loading PDF from ArrayBuffer");
    
    const loadingTask = this.#pdfjsLib.getDocument({
      data: arrayBuffer,
      withCredentials: PDFJS_CONFIG.withCredentials,
      maxImageSize: PDFJS_CONFIG.maxImageSize,
      disableAutoFetch: PDFJS_CONFIG.disableAutoFetch,
      disableStream: PDFJS_CONFIG.disableStream,
      disableRange: PDFJS_CONFIG.disableRange,
      isEvalSupported: PDFJS_CONFIG.isEvalSupported,
      useSystemFonts: PDFJS_CONFIG.useSystemFonts
    });
    
    // 设置进度回调
    loadingTask.onProgress = (progressData) => {
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, {
        loaded: progressData.loaded,
        total: progressData.total,
        percent: progressData.total > 0 ? Math.round((progressData.loaded / progressData.total) * 100) : 0
      }, { actorId: 'PDFManager' });
    };
    
    return await loadingTask.promise;
  }

  /**
   * 从Blob加载PDF文档
   * @param {Blob} blob - PDF文件Blob
   * @returns {Promise<Object>} PDF文档对象
   * @private
   */
  async #loadFromBlob(blob) {
    this.#logger.debug("Loading PDF from Blob");
    
    const arrayBuffer = await blob.arrayBuffer();
    return await this.#loadFromArrayBuffer(arrayBuffer);
  }

  /**
   * 分类PDF加载错误
   * @param {Error} error - 原始错误
   * @param {Object} fileData - 文件数据
   * @returns {Object} 分类后的错误信息
   * @private
   */
  #classifyPDFError(error, fileData) {
    const errorMessage = error.message || error.toString();
    let errorCode = ERROR_CODES.GENERAL_ERRORS.UNKNOWN_ERROR;
    let errorType = 'UNKNOWN';
    let userMessage = ERROR_CODES.getErrorDescription(ERROR_CODES.GENERAL_ERRORS.UNKNOWN_ERROR);
    
    // 网络相关错误
    if (errorMessage.includes('Network') || errorMessage.includes('fetch') || 
        errorMessage.includes('HTTP') || errorMessage.includes('404') ||
        errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
      errorCode = ERROR_CODES.NETWORK_ERRORS.NETWORK_CONNECTION_FAILED;
      errorType = 'NETWORK_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // PDF格式错误
    else if (errorMessage.includes('format') || errorMessage.includes('PDF') || 
             errorMessage.includes('Invalid') || errorMessage.includes('corrupted')) {
      errorCode = ERROR_CODES.FORMAT_ERRORS.INVALID_PDF_FORMAT;
      errorType = 'FORMAT_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // 解析错误
    else if (errorMessage.includes('parse') || errorMessage.includes('syntax') ||
             errorMessage.includes('decrypt')) {
      errorCode = ERROR_CODES.FORMAT_ERRORS.ENCRYPTED_PDF;
      errorType = 'PARSE_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // 内存错误
    else if (errorMessage.includes('memory') || errorMessage.includes('out of memory') ||
             errorMessage.includes('too large')) {
      errorCode = ERROR_CODES.GENERAL_ERRORS.MEMORY_ERROR;
      errorType = 'MEMORY_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // 权限错误
    else if (errorMessage.includes('permission') || errorMessage.includes('access') ||
             errorMessage.includes('denied')) {
      errorCode = ERROR_CODES.GENERAL_ERRORS.PERMISSION_ERROR;
      errorType = 'PERMISSION_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // 特定HTTP状态码处理
    else if (errorMessage.includes('404')) {
      errorCode = ERROR_CODES.NETWORK_ERRORS.FILE_NOT_FOUND;
      errorType = 'NETWORK_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    else if (errorMessage.includes('500') || errorMessage.includes('502') || 
             errorMessage.includes('503')) {
      errorCode = ERROR_CODES.NETWORK_ERRORS.SERVER_ERROR;
      errorType = 'NETWORK_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    // 超时错误
    else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorCode = ERROR_CODES.NETWORK_ERRORS.REQUEST_TIMEOUT;
      errorType = 'NETWORK_ERROR';
      userMessage = ERROR_CODES.getErrorDescription(errorCode);
    }
    
    return {
      error: errorMessage,
      code: errorCode,
      type: errorType,
      userMessage: userMessage,
      file: fileData,
      timestamp: new Date().toISOString(),
      retryable: ERROR_CODES.isNetworkError(errorCode) || errorCode === ERROR_CODES.GENERAL_ERRORS.UNKNOWN_ERROR
    };
  }

  /**
   * 获取指定页面
   * @param {number} pageNumber - 页面编号
   * @returns {Promise<Object>} 页面对象
   */
  async getPage(pageNumber) {
    if (!this.#currentDocument) {
      throw new Error("No PDF document loaded");
    }
    
    if (pageNumber < 1 || pageNumber > this.#currentDocument.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}`);
    }
    
    // 检查缓存
    if (this.#pagesCache.has(pageNumber)) {
      this.#logger.debug(`Returning page ${pageNumber} from cache`);
      return this.#pagesCache.get(pageNumber);
    }
    
    try {
      this.#logger.debug(`Loading page ${pageNumber}`);
      
      const page = await this.#currentDocument.getPage(pageNumber);
      
      // 缓存页面
      this.#pagesCache.set(pageNumber, page);
      
      return page;
      
    } catch (error) {
      this.#logger.error(`Failed to get page ${pageNumber}:`, error);
      throw error;
    }
  }

  /**
   * 获取文档信息
   * @returns {Object} 文档信息
   */
  getDocumentInfo() {
    if (!this.#currentDocument) {
      return null;
    }
    
    return {
      numPages: this.#currentDocument.numPages,
      // 可以添加更多文档信息
    };
  }

  /**
   * 预加载页面范围
   * @param {number} startPage - 起始页面
   * @param {number} endPage - 结束页面
   * @returns {Promise<void>}
   */
  async preloadPages(startPage, endPage) {
    if (!this.#currentDocument) {
      return;
    }
    
    const totalPages = this.#currentDocument.numPages;
    const actualStart = Math.max(1, startPage);
    const actualEnd = Math.min(totalPages, endPage);
    
    this.#logger.debug(`Preloading pages ${actualStart} to ${actualEnd}`);
    
    const preloadPromises = [];
    
    for (let i = actualStart; i <= actualEnd; i++) {
      // 跳过已经缓存的页面
      if (!this.#pagesCache.has(i)) {
        preloadPromises.push(
          this.getPage(i).catch(error => {
            this.#logger.warn(`Failed to preload page ${i}:`, error);
          })
        );
      }
    }
    
    await Promise.all(preloadPromises);
    this.#logger.debug(`Preloaded ${preloadPromises.length} pages`);
  }

  /**
   * 清理缓存和资源
   * @param {number} [keepPages=3] - 保留的页面数量（当前页面前后）
   */
  cleanupCache(keepPages = 3) {
    if (!this.#currentDocument || this.#pagesCache.size === 0) {
      return;
    }
    
    const currentPage = this.#getCurrentPageContext();
    if (!currentPage) return;
    
    const pagesToKeep = new Set();
    
    // 保留当前页面及前后页面
    for (let i = Math.max(1, currentPage - keepPages); 
         i <= Math.min(this.#currentDocument.numPages, currentPage + keepPages); 
         i++) {
      pagesToKeep.add(i);
    }
    
    // 清理不在保留范围内的页面
    for (const [pageNumber, page] of this.#pagesCache.entries()) {
      if (!pagesToKeep.has(pageNumber)) {
        this.#pagesCache.delete(pageNumber);
        // 清理页面资源
        if (page.cleanup) {
          page.cleanup();
        }
      }
    }
    
    this.#logger.debug(`Cache cleaned. Kept ${pagesToKeep.size} pages`);
  }

  /**
   * 获取当前页面上下文（从事件总线或其他方式）
   * @returns {number|null} 当前页面编号
   * @private
   */
  #getCurrentPageContext() {
    // 这里可以从事件总线或其他方式获取当前页面信息
    // 暂时返回null，实际应用中应该从应用状态获取
    return null;
  }

  /**
   * 完全清理所有资源
   */
  cleanup() {
    this.#logger.info("Cleaning up PDF resources");
    
    // 清理所有页面缓存
    for (const [, page] of this.#pagesCache.entries()) {
      if (page.cleanup) {
        page.cleanup();
      }
    }
    this.#pagesCache.clear();
    
    // 清理当前文档
    if (this.#currentDocument) {
      this.#currentDocument.destroy().catch(error => {
        this.#logger.warn("Error destroying PDF document:", error);
      });
      this.#currentDocument = null;
    }
  }

  /**
   * 销毁PDF管理器
   */
  destroy() {
    this.#logger.info("Destroying PDF Manager");
    this.cleanup();
  }

  /**
   * 获取当前加载的文档
   * @returns {Object|null} 当前PDF文档
   */
  getCurrentDocument() {
    return this.#currentDocument;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      totalCached: this.#pagesCache.size,
      cachedPages: Array.from(this.#pagesCache.keys())
    };
  }
}