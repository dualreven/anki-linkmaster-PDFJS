/**
 * @file PDF文档加载器
 * @module PDFLoader
 * @description 负责从不同来源（URL、ArrayBuffer、Blob）加载PDF文档
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * PDF加载器类
 * 处理从不同来源加载PDF文档的逻辑
 */
export class PDFLoader {
  #logger;
  #eventBus;
  #pdfjsLib;
  #currentLoadTask = null;

  constructor(eventBus, pdfjsLib) {
    this.#eventBus = eventBus;
    this.#pdfjsLib = pdfjsLib;
    this.#logger = getLogger('PDFViewer.Loader');
  }

  /**
   * 获取PDF.js配置中的资源URL
   * @private
   * @returns {Object} 包含cMapUrl和standardFontDataUrl的对象
   */
  #getPDFJSResourceUrls() {
    const urls = {};

    // 使用Function构造器避开Babel的静态分析
    // 在测试环境中import.meta不可用，返回空对象
    try {
      const getImportMetaUrl = new Function('return import.meta.url');
      const metaUrl = getImportMetaUrl();
      if (metaUrl) {
        urls.cMapUrl = new URL('@pdfjs/cmaps/', metaUrl).href;
        urls.standardFontDataUrl = new URL('@pdfjs/standard_fonts/', metaUrl).href;
      }
    } catch (e) {
      // 测试环境中import.meta不可用，跳过
      this.#logger.debug('import.meta.url not available, skipping CMap and StandardFonts config');
    }

    return urls;
  }

  /**
   * 从URL加载PDF文档
   * @param {string} url - PDF文件URL
   * @returns {Promise<Object>} PDF文档对象
   */
  async loadFromURL(url) {
    this.#logger.info(`Loading PDF from URL: ${url}`);

    // 取消之前的加载任务
    if (this.#currentLoadTask) {
      try {
        await this.#currentLoadTask.destroy();
      } catch (e) {
        // 忽略销毁错误
      }
    }

    // 创建加载配置
    const config = {
      url: url,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      cMapPacked: true,
      // 获取资源URL（在测试环境中可能为空）
      ...this.#getPDFJSResourceUrls()
    };

    const loadingTask = this.#pdfjsLib.getDocument(config);

    this.#currentLoadTask = loadingTask;

    // 监听加载进度
    loadingTask.onProgress = (progressData) => {
      const percent = progressData.loaded > 0 && progressData.total > 0
        ? Math.round((progressData.loaded / progressData.total) * 100)
        : 0;

      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, {
        loaded: progressData.loaded,
        total: progressData.total,
        percent: percent
      }, { actorId: 'PDFLoader' });
    };

    try {
      const pdfDocument = await loadingTask.promise;
      this.#logger.info(`PDF loaded successfully from URL: ${url}`);
      return pdfDocument;
    } finally {
      this.#currentLoadTask = null;
    }
  }

  /**
   * 从ArrayBuffer加载PDF文档
   * @param {ArrayBuffer} arrayBuffer - PDF文件的ArrayBuffer
   * @returns {Promise<Object>} PDF文档对象
   */
  async loadFromArrayBuffer(arrayBuffer) {
    this.#logger.info("Loading PDF from ArrayBuffer");

    // 取消之前的加载任务
    if (this.#currentLoadTask) {
      try {
        await this.#currentLoadTask.destroy();
      } catch (e) {
        // 忽略销毁错误
      }
    }

    const loadingTask = this.#pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      cMapPacked: true,
      // 获取资源URL（在测试环境中可能为空）
      ...this.#getPDFJSResourceUrls()
    });

    this.#currentLoadTask = loadingTask;

    // 监听加载进度
    loadingTask.onProgress = (progressData) => {
      const percent = progressData.loaded > 0 && progressData.total > 0
        ? Math.round((progressData.loaded / progressData.total) * 100)
        : 0;

      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.PROGRESS, {
        loaded: progressData.loaded,
        total: progressData.total,
        percent: percent
      }, { actorId: 'PDFLoader' });
    };

    try {
      const pdfDocument = await loadingTask.promise;
      this.#logger.info("PDF loaded successfully from ArrayBuffer");
      return pdfDocument;
    } finally {
      this.#currentLoadTask = null;
    }
  }

  /**
   * 从Blob加载PDF文档
   * @param {Blob} blob - PDF文件的Blob对象
   * @returns {Promise<Object>} PDF文档对象
   */
  async loadFromBlob(blob) {
    this.#logger.info("Loading PDF from Blob");

    // 将Blob转换为ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    return this.loadFromArrayBuffer(arrayBuffer);
  }

  /**
   * 取消当前的加载任务
   */
  async cancelLoading() {
    if (this.#currentLoadTask) {
      try {
        await this.#currentLoadTask.destroy();
        this.#currentLoadTask = null;
        this.#logger.info("PDF loading cancelled");
      } catch (e) {
        this.#logger.warn("Error cancelling PDF load:", e);
      }
    }
  }

  /**
   * 销毁加载器，清理资源
   */
  destroy() {
    this.cancelLoading();
  }
}
