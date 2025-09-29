/**
 * @file PDF文档管理器
 * @module PDFDocumentManager
 * @description 管理当前打开的PDF文档，提供页面访问和文档信息
 */

import { getLogger } from "../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";

/**
 * PDF文档管理器类
 * 管理当前打开的PDF文档实例
 */
export class PDFDocumentManager {
  #logger;
  #eventBus;
  #currentDocument = null;
  #documentInfo = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger('PDFViewer.Document');
  }

  /**
   * 设置当前PDF文档
   * @param {Object} pdfDocument - PDF.js文档对象
   */
  setDocument(pdfDocument) {
    // 清理旧文档
    this.closeDocument();

    this.#currentDocument = pdfDocument;
    this.#extractDocumentInfo();

    this.#logger.info(`Document loaded: ${this.#documentInfo.title || 'Untitled'}`);

    // 发布文档加载完成事件
    this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, {
      ...this.#documentInfo
    }, { actorId: 'PDFDocumentManager' });
  }

  /**
   * 获取当前文档
   * @returns {Object|null} PDF文档对象
   */
  getDocument() {
    return this.#currentDocument;
  }

  /**
   * 检查是否有打开的文档
   * @returns {boolean}
   */
  hasDocument() {
    return this.#currentDocument !== null;
  }

  /**
   * 获取指定页面
   * @param {number} pageNumber - 页码
   * @returns {Promise<Object>} 页面对象
   */
  async getPage(pageNumber) {
    if (!this.#currentDocument) {
      throw new Error("No PDF document loaded");
    }

    if (pageNumber < 1 || pageNumber > this.#currentDocument.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}`);
    }

    try {
      const page = await this.#currentDocument.getPage(pageNumber);
      this.#logger.debug(`Page ${pageNumber} retrieved`);
      return page;
    } catch (error) {
      this.#logger.error(`Failed to get page ${pageNumber}:`, error);
      throw error;
    }
  }

  /**
   * 获取文档信息
   * @returns {Object|null} 文档信息
   */
  getDocumentInfo() {
    return this.#documentInfo;
  }

  /**
   * 获取总页数
   * @returns {number} 总页数
   */
  getTotalPages() {
    return this.#currentDocument ? this.#currentDocument.numPages : 0;
  }

  /**
   * 关闭当前文档
   */
  closeDocument() {
    if (this.#currentDocument) {
      try {
        // 销毁PDF文档以释放资源
        this.#currentDocument.destroy();
        this.#logger.info("Document closed and resources released");
      } catch (error) {
        this.#logger.warn("Error closing document:", error);
      }

      this.#currentDocument = null;
      this.#documentInfo = null;

      // 发布文档关闭事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.CLOSE, {}, { actorId: 'PDFDocumentManager' });
    }
  }

  /**
   * 提取文档信息
   * @private
   */
  #extractDocumentInfo() {
    if (!this.#currentDocument) {
      this.#documentInfo = null;
      return;
    }

    const info = this.#currentDocument.getMetadata ? this.#currentDocument.getMetadata() : {};
    const fingerprint = this.#currentDocument.fingerprints ?
      this.#currentDocument.fingerprints[0] :
      this.#currentDocument.fingerprint;

    this.#documentInfo = {
      numPages: this.#currentDocument.numPages,
      fingerprint: fingerprint,
      title: info.info?.Title || '',
      author: info.info?.Author || '',
      subject: info.info?.Subject || '',
      keywords: info.info?.Keywords || '',
      creator: info.info?.Creator || '',
      producer: info.info?.Producer || '',
      creationDate: info.info?.CreationDate || '',
      modificationDate: info.info?.ModDate || '',
      metadata: info.metadata || null
    };
  }

  /**
   * 获取页面标签（如果有）
   * @param {number} pageIndex - 页面索引（0开始）
   * @returns {Promise<string>} 页面标签
   */
  async getPageLabel(pageIndex) {
    if (!this.#currentDocument || !this.#currentDocument.getPageLabels) {
      return String(pageIndex + 1);
    }

    try {
      const labels = await this.#currentDocument.getPageLabels();
      return labels && labels[pageIndex] ? labels[pageIndex] : String(pageIndex + 1);
    } catch (error) {
      this.#logger.debug("Could not get page label:", error);
      return String(pageIndex + 1);
    }
  }

  /**
   * 获取文档目录（大纲）
   * @returns {Promise<Array>} 文档目录
   */
  async getOutline() {
    if (!this.#currentDocument || !this.#currentDocument.getOutline) {
      return [];
    }

    try {
      const outline = await this.#currentDocument.getOutline();
      return outline || [];
    } catch (error) {
      this.#logger.debug("Could not get outline:", error);
      return [];
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.closeDocument();
  }
}