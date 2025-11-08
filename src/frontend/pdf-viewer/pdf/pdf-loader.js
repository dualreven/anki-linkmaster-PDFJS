/**
 * @file PDF文档加载器
 * @module PDFLoader
 * @description 负责从不同来源（URL、ArrayBuffer、Blob）加载PDF文档
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

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
    this.#logger = getLogger("PDFViewer.Loader");
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
        this.#logger.warn("Error destroying previous load task (URL)", e);
      }
    }

    // 计算 PDF.js 资源基址（生产优先 vendor 基址，开发回退 alias）
    let cMapUrlResolved = null;
    let standardFontDataUrlResolved = null;
    try {
      if (typeof window !== "undefined" && window.__PDFJS_VENDOR_BASE__) {
        const base = String(window.__PDFJS_VENDOR_BASE__).endsWith("/") ? window.__PDFJS_VENDOR_BASE__ : `${window.__PDFJS_VENDOR_BASE__}/`;
        cMapUrlResolved = `${base}cmaps/`;
        standardFontDataUrlResolved = `${base}standard_fonts/`;
      }
    } catch (e) { this.#logger.debug("Resolve PDFJS vendor base (URL) failed", e); }
    if (!cMapUrlResolved || !standardFontDataUrlResolved) {
      // 回退到 import.meta + 别名（主要用于开发环境）
      cMapUrlResolved = new URL("@pdfjs/cmaps/", import.meta.url).href;
      standardFontDataUrlResolved = new URL("@pdfjs/standard_fonts/", import.meta.url).href;
    }

    // 创建加载配置
    const loadingTask = this.#pdfjsLib.getDocument({
      url: url,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      // 启用CMap支持中文等CJK字符
      cMapUrl: cMapUrlResolved,
      cMapPacked: true,
      // 启用标准字体
      standardFontDataUrl: standardFontDataUrlResolved
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
      }, { actorId: "PDFLoader" });
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
        this.#logger.warn("Error destroying previous load task (ArrayBuffer)", e);
      }
    }

    // 计算 PDF.js 资源基址（生产优先 vendor 基址，开发回退 alias）
    let cMapUrlResolved2 = null;
    let standardFontDataUrlResolved2 = null;
    try {
      if (typeof window !== "undefined" && window.__PDFJS_VENDOR_BASE__) {
        const base = String(window.__PDFJS_VENDOR_BASE__).endsWith("/") ? window.__PDFJS_VENDOR_BASE__ : `${window.__PDFJS_VENDOR_BASE__}/`;
        cMapUrlResolved2 = `${base}cmaps/`;
        standardFontDataUrlResolved2 = `${base}standard_fonts/`;
      }
    } catch (e) { this.#logger.debug("Resolve PDFJS vendor base (ArrayBuffer) failed", e); }
    if (!cMapUrlResolved2 || !standardFontDataUrlResolved2) {
      // 回退到 import.meta + 别名（主要用于开发环境）
      cMapUrlResolved2 = new URL("@pdfjs/cmaps/", import.meta.url).href;
      standardFontDataUrlResolved2 = new URL("@pdfjs/standard_fonts/", import.meta.url).href;
    }

    const loadingTask = this.#pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false,
      // 启用CMap支持中文等CJK字符
      cMapUrl: cMapUrlResolved2,
      cMapPacked: true,
      // 启用标准字体
      standardFontDataUrl: standardFontDataUrlResolved2
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
      }, { actorId: "PDFLoader" });
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

