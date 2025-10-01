/**
 * @file PDF管理器（重构版）
 * @module PDFManager
 * @description 整合PDF加载、文档管理和页面缓存的主管理器
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { PDFLoader } from "./pdf-loader.js";
import { PDFDocumentManager } from "./pdf-document-manager.js";
import { PageCacheManager } from "./page-cache-manager.js";
import { getPDFJSConfig, LOADING_CONFIG, CACHE_CONFIG, PATH_CONFIG } from "./pdf-config.js";

/**
 * PDF管理器主类
 * 协调PDF加载、文档管理和页面缓存
 */
export class PDFManager {
  #eventBus;
  #logger;
  #pdfjsLib = null;
  #loader = null;
  #documentManager = null;
  #cacheManager = null;
  #initialized = false;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('PDFViewer');
  }

  /**
   * 初始化PDF管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.warn("PDF Manager already initialized");
      return;
    }

    try {
      this.#logger.info("Initializing PDF Manager...");

      // 动态导入PDF.js库
      this.#logger.info("Loading PDF.js library...");
      this.#pdfjsLib = await import('pdfjs-dist/build/pdf');

      // 记录PDF.js版本信息
      if (this.#pdfjsLib) {
        this.#logger.info("PDF.js library loaded successfully", {
          version: this.#pdfjsLib.version,
          build: this.#pdfjsLib.build
        });
      }

      // 配置PDF.js
      const config = getPDFJSConfig();
      this.#pdfjsLib.GlobalWorkerOptions.workerSrc = config.workerSrc;

      // 启用标准字体映射，支持中文等非拉丁字符（使用Vite别名，简单且本地化）
      this.#pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = new URL('@pdfjs/standard_fonts/', import.meta.url).href;

      this.#logger.info("PDF.js worker configured", {
        workerSrc: config.workerSrc,
        standardFontDataUrl: this.#pdfjsLib.GlobalWorkerOptions.standardFontDataUrl
      });

      // 初始化子模块
      this.#loader = new PDFLoader(this.#eventBus, this.#pdfjsLib);
      this.#documentManager = new PDFDocumentManager(this.#eventBus);
      this.#cacheManager = new PageCacheManager({
        maxCacheSize: CACHE_CONFIG.maxCacheSize
      });

      this.#initialized = true;
      this.#logger.info("PDF Manager initialized successfully");

    } catch (error) {
      this.#logger.error("Failed to initialize PDF Manager:", error);

      // 发布初始化错误事件
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
    if (!this.#initialized) {
      await this.initialize();
    }

    const filename = fileData?.filename || null;
    let url = fileData?.url;

    // 如果仅传入filename而没有url，构造默认URL
    if (!url && filename) {
      const actualFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      url = `${PATH_CONFIG.proxyPath}${actualFilename}`;
      this.#logger.info(`Constructed URL from filename: ${url}`);
    }

    // 清理旧文档和缓存
    this.closePDF();

    // 重试逻辑
    let lastError = null;
    for (let attempt = 1; attempt <= LOADING_CONFIG.maxRetries; attempt++) {
      try {
        this.#logger.info(`Loading PDF (attempt ${attempt}/${LOADING_CONFIG.maxRetries}): ${filename || url}`);

        // 发布加载进度事件（开始）
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, {
          filename: filename,
          url: url,
          attempt: attempt,
          percent: 0,
          message: `开始加载 (尝试 ${attempt}/${LOADING_CONFIG.maxRetries})`
        }, { actorId: 'PDFManager' });

        // 根据数据类型选择加载方法
        let pdfDocument;
        if (url) {
          pdfDocument = await this.#loader.loadFromURL(url);
        } else if (fileData.arrayBuffer) {
          pdfDocument = await this.#loader.loadFromArrayBuffer(fileData.arrayBuffer);
        } else if (fileData.blob) {
          pdfDocument = await this.#loader.loadFromBlob(fileData.blob);
        } else {
          throw new Error("No valid PDF data provided");
        }

        // 设置文档到管理器
        this.#documentManager.setDocument(pdfDocument);

        this.#logger.info(`PDF loaded successfully: ${filename || 'Document'}`);
        
        // 将加载的文档传递给UIManager
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { pdfDocument });
        
        return pdfDocument;

      } catch (error) {
        lastError = error;
        this.#logger.error(`Failed to load PDF (attempt ${attempt}):`, error);

        // 发布加载失败事件
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.FAILED, {
          filename: filename,
          error: error.message,
          attempt: attempt,
          maxAttempts: LOADING_CONFIG.maxRetries
        }, { actorId: 'PDFManager' });

        // 如果还有重试机会，等待后重试
        if (attempt < LOADING_CONFIG.maxRetries) {
          this.#logger.info(`Retrying in ${LOADING_CONFIG.retryDelayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, LOADING_CONFIG.retryDelayMs));
        }
      }
    }

    // 所有重试都失败了
    throw lastError || new Error("Failed to load PDF after all retries");
  }

  /**
   * 获取PDF页面
   * @param {number} pageNumber - 页码
   * @returns {Promise<Object>} 页面对象
   */
  async getPage(pageNumber) {
    if (!this.#documentManager.hasDocument()) {
      throw new Error("No PDF document loaded");
    }

    // 先检查缓存
    let page = this.#cacheManager.getPage(pageNumber);
    if (page) {
      this.#logger.debug(`Page ${pageNumber} retrieved from cache`);
      return page;
    }

    // 从文档获取页面
    page = await this.#documentManager.getPage(pageNumber);

    // 添加到缓存
    this.#cacheManager.addPage(pageNumber, page);

    // 预加载相邻页面
    this.#preloadAdjacentPages(pageNumber);

    return page;
  }

  /**
   * 预加载相邻页面
   * @param {number} currentPage - 当前页码
   * @private
   */
  async #preloadAdjacentPages(currentPage) {
    const totalPages = this.#documentManager.getTotalPages();
    const startPage = Math.max(1, currentPage - CACHE_CONFIG.preloadRange);
    const endPage = Math.min(totalPages, currentPage + CACHE_CONFIG.preloadRange);

    const pagesToLoad = this.#cacheManager.getPagesToPreload(startPage, endPage);

    for (const pageNumber of pagesToLoad) {
      try {
        const page = await this.#documentManager.getPage(pageNumber);
        this.#cacheManager.addPage(pageNumber, page);
        this.#logger.debug(`Preloaded page ${pageNumber}`);
      } catch (error) {
        this.#logger.debug(`Failed to preload page ${pageNumber}:`, error);
      }
    }
  }

  /**
   * 获取文档信息
   * @returns {Object|null} 文档信息
   */
  getDocumentInfo() {
    return this.#documentManager.getDocumentInfo();
  }

  /**
   * 获取总页数
   * @returns {number} 总页数
   */
  getTotalPages() {
    return this.#documentManager.getTotalPages();
  }

  /**
   * 清理页面缓存
   * @param {number} currentPage - 当前页码
   */
  cleanupCache(currentPage) {
    this.#cacheManager.cleanupCache(currentPage, CACHE_CONFIG.keepRange);
  }

  /**
   * 关闭当前PDF
   */
  closePDF() {
    if (this.#documentManager) {
      this.#documentManager.closeDocument();
    }
    if (this.#cacheManager) {
      this.#cacheManager.clearAll();
    }
    if (this.#loader) {
      this.#loader.cancelLoading();
    }
    this.#logger.info("PDF closed");
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    return this.#cacheManager ? this.#cacheManager.getStats() : null;
  }

  /**
   * 销毁PDF管理器
   */
  destroy() {
    this.closePDF();

    if (this.#loader) {
      this.#loader.destroy();
      this.#loader = null;
    }

    if (this.#documentManager) {
      this.#documentManager.destroy();
      this.#documentManager = null;
    }

    if (this.#cacheManager) {
      this.#cacheManager.destroy();
      this.#cacheManager = null;
    }

    this.#pdfjsLib = null;
    this.#initialized = false;
    this.#logger.info("PDF Manager destroyed");
  }
}