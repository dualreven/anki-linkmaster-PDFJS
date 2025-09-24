/**
 * @file PDF管理器，负责PDF文档的加载、页面获取和资源管理
 * @module PDFManager
 * @description 基于PDF.js的PDF文档管理模块
 */

import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";
import { Logger } from "../common/utils/logger.js";

// PDF.js 配置
const PDFJS_CONFIG = {
  workerSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
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
    this.#logger = new Logger('PDFManager');
  }

  /**
   * 初始化PDF管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing PDF Manager...");

      // 检测WebGL状态并配置PDF.js
      const webglState = { enabled: false };

      // 动态导入PDF.js库
      this.#logger.info("Loading PDF.js library...");

      this.#pdfjsLib = await import('pdfjs-dist/build/pdf');

      // Log PDF.js library information
      if (this.#pdfjsLib) {
        this.#logger.info("PDF.js library loaded successfully", {
          version: this.#pdfjsLib.version,
          build: this.#pdfjsLib.build
        });
      }

      // 配置PDF.js worker
      this.#pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CONFIG.workerSrc;
      this.#logger.info("PDF.js worker configured", {
        workerSrc: PDFJS_CONFIG.workerSrc
      });

      this.#logger.info("PDF Manager initialized successfully");

    } catch (error) {
      this.#logger.error("Failed to initialize PDF Manager:", error);

      // Emit initialization error event
      this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.ERROR, {
        module: 'PDFManager',
        error: error.message
      }, { actorId: 'PDFManager' });

      throw error;
    }
  }

  /**
   * 加载PDF文档
   * @param {Object} fileData - 文件数据
   * @returns {Promise<Object>} PDF文档对象
   */
  async loadPDF(fileData) {
    const maxRetries = 3;
    const retryDelayMs = 500;
    const filename = fileData && fileData.filename ? fileData.filename : null;

    // 如果仅传入 filename 而没有 url，则使用开发代理相对路径
    if (!fileData.url && filename) {
      // 如果filename包含路径（如 "public/test.pdf"），提取实际文件名
      const actualFilename = filename.includes('/')
        ? filename.split('/').pop()
        : filename;

      // 使用相对路径 /pdfs/{filename}，由 Vite dev server 代理到后端
      fileData.url = `/pdfs/${encodeURIComponent(actualFilename)}`;
      this.#logger.debug(`Constructed proxy URL for filename ${filename} -> ${actualFilename}: ${fileData.url}`);

      // 如果提取了路径，记录调试信息
      if (filename !== actualFilename) {
        this.#logger.info(`Path extraction: "${filename}" -> "${actualFilename}"`);
      }
    }

    // 确保 PDF.js 已加载；若未加载尝试初始化
    if (!this.#pdfjsLib) {
      this.#logger.warn("PDF.js library not loaded yet, attempting to initialize before loading PDF");
      try {
        await this.initialize();
      } catch (initErr) {
        this.#logger.error("Failed to initialize PDFManager before load:", initErr);
        // 继续，让下面的重试逻辑处理
      }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.#logger.info(`Loading PDF document (attempt ${attempt}):`, filename || fileData.url);

        // 清理之前的文档
        this.cleanup();

        let pdfData;

        if (fileData.url) {
          // 从URL加载
          this.#logger.info("Loading PDF from URL:", fileData.url);
          pdfData = await this.#loadFromURL(fileData.url);
        } else if (fileData.arrayBuffer) {
          // 从ArrayBuffer加载
          this.#logger.info("Loading PDF from ArrayBuffer");
          pdfData = await this.#loadFromArrayBuffer(fileData.arrayBuffer);
        } else if (fileData.blob) {
          // 从Blob加载
          this.#logger.info("Loading PDF from Blob");
          pdfData = await this.#loadFromBlob(fileData.blob);
        } else {
          throw new Error("Unsupported file data format");
        }

        this.#currentDocument = pdfData;
        this.#pagesCache.clear();

        this.#logger.info(`PDF document loaded successfully. Pages: ${pdfData.numPages}`);

        // Log document information
        const docInfo = this.getDocumentInfo();
        this.#logger.info("Document information:", docInfo);

        return pdfData;
      } catch (error) {
        // 记录详细的错误信息，包含调试所需的所有上下文
        this.#logger.error(`Failed to load PDF document on attempt ${attempt}/${maxRetries}:`, {
          filename: filename,
          url: fileData.url,
          error: error.message,
          errorType: error.name,
          stack: error.stack,
          attempt: attempt,
          maxRetries: maxRetries
        });

        // 发出详细错误事件，包含诊断信息
        const errorDetails = {
          module: 'PDFManager',
          operation: 'loadPDF',
          filename: filename,
          url: fileData.url,
          attempt: attempt,
          maxRetries: maxRetries,
          error: error.message,
          errorType: error.name,
          timestamp: new Date().toISOString(),
          suggestions: [
            '检查文件是否存在于服务器',
            '检查网络连接状态',
            '检查代理服务器运行状态',
            '检查文件路径格式是否正确',
            '查看浏览器网络面板了解HTTP状态码'
          ]
        };

        try {
          this.#eventBus.emit(PDF_VIEWER_EVENTS.STATE.ERROR, errorDetails, { actorId: 'PDFManager' });
        } catch (emitErr) {
          this.#logger.warn("Failed to emit detailed error event:", emitErr);
        }

        // 如果未达到最大重试次数，则发出重试事件并等待一段时间再重试
        if (attempt < maxRetries) {
          try {
            this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.RETRY, {
              filename,
              attempt,
              nextAttempt: attempt + 1,
              retryDelayMs: retryDelayMs,
              lastError: error.message
            }, { actorId: 'PDFManager' });
          } catch (emitErr) {
            // 忽略事件发射错误
            this.#logger.warn("Failed to emit retry event:", emitErr);
          }

          this.#logger.info(`将在 ${retryDelayMs}ms 后进行第 ${attempt + 1} 次重试...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          continue;
        }

        // 达到最大重试次数，放弃尝试并记录最终失败
        this.#logger.error(`PDF加载完全失败！已达到最大重试次数（${maxRetries}次）`, {
          filename,
          finalUrl: fileData.url,
          totalAttempts: maxRetries,
          finalError: error.message
        });

        // 发出最终失败事件
        try {
          this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, {
            filename,
            url: fileData.url,
            error: error.message,
            errorType: error.name,
            attempts: maxRetries,
            timestamp: new Date().toISOString(),
            troubleshooting: {
              fileExists: `检查文件是否存在: ${fileData.url}`,
              proxyStatus: '检查 Vite 开发服务器代理配置',
              backendStatus: '检查后端 HTTP 服务器是否运行在端口 8080',
              networkCheck: '在浏览器开发者工具中查看网络请求状态'
            }
          }, { actorId: 'PDFManager' });
        } catch (emitErr) {
          this.#logger.warn("Failed to emit load failed event:", emitErr);
        }

        // 抛出增强的错误信息
        const enhancedError = new Error(
          `加载PDF失败: ${filename}\n` +
          `URL: ${fileData.url}\n` +
          `错误: ${error.message}\n` +
          `重试次数: ${maxRetries}\n` +
          `建议: 检查文件路径、网络连接和代理配置`
        );
        enhancedError.originalError = error;
        enhancedError.filename = filename;
        enhancedError.url = fileData.url;
        enhancedError.attempts = maxRetries;

        throw enhancedError;
      }
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