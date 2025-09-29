/**
 * @file QWebChannel API包装器
 * @module ApiWrapper
 */

import { getLogger } from "../../common/utils/logger.js";

/**
 * QWebChannel API包装器类
 */
export class ApiWrapper {
  #logger;
  #bridge = null;

  constructor() {
    this.#logger = getLogger("ApiWrapper");
  }

  /**
   * 设置桥接对象
   * @param {Object} bridge - 桥接对象
   */
  setBridge(bridge) {
    this.#bridge = bridge;
  }

  /**
   * 检查是否已就绪
   * @returns {boolean} 是否已就绪
   */
  isReady() {
    return this.#bridge !== null;
  }

  /**
   * 选择PDF文件
   * @returns {Promise<Array>} 文件列表
   */
  async selectPdfFiles() {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling selectPdfFiles via QWebChannel");
      const files = await this.#bridge.selectPdfFiles();
      this.#logger.info("selectPdfFiles returned:", files);
      return files;
    } catch (error) {
      this.#logger.error("selectPdfFiles failed:", error);
      throw error;
    }
  }

  /**
   * 获取PDF列表
   * @returns {Promise<Array>} PDF列表
   */
  async getPdfList() {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling getPdfList via QWebChannel");
      const list = await this.#bridge.getPdfList();
      this.#logger.info("getPdfList returned:", list);
      return list;
    } catch (error) {
      this.#logger.error("getPdfList failed:", error);
      throw error;
    }
  }

  /**
   * 添加PDF文件（通过Base64）
   * @param {string} filename - 文件名
   * @param {string} dataBase64 - Base64数据
   * @returns {Promise<Object>} 添加结果
   */
  async addPdfFromBase64(filename, dataBase64) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling addPdfFromBase64 via QWebChannel:", filename);
      const result = await this.#bridge.addPdfFromBase64(filename, dataBase64);
      this.#logger.info("addPdfFromBase64 returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("addPdfFromBase64 failed:", error);
      throw error;
    }
  }

  /**
   * 批量添加PDF文件
   * @param {Array} items - 文件项目列表
   * @returns {Promise<Object>} 添加结果
   */
  async addPdfBatchFromBase64(items) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling addPdfBatchFromBase64 via QWebChannel:", items.length);
      const result = await this.#bridge.addPdfBatchFromBase64(items);
      this.#logger.info("addPdfBatchFromBase64 returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("addPdfBatchFromBase64 failed:", error);
      throw error;
    }
  }

  /**
   * 删除PDF文件
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async removePdf(fileId) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling removePdf via QWebChannel:", fileId);
      const result = await this.#bridge.removePdf(fileId);
      this.#logger.info("removePdf returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("removePdf failed:", error);
      throw error;
    }
  }

  /**
   * 打开PDF查看器
   * @param {string} fileId - 文件ID
   * @returns {Promise<Object>} 打开结果
   */
  async openPdfViewer(fileId) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling openPdfViewer via QWebChannel:", fileId);
      const result = await this.#bridge.openPdfViewer(fileId);
      this.#logger.info("openPdfViewer returned:", result);
      return result;
    } catch (error) {
      this.#logger.error("openPdfViewer failed:", error);
      throw error;
    }
  }

  /**
   * 读取文件为Base64
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 文件数据
   */
  async readFileAsBase64(filePath) {
    if (!this.isReady()) {
      throw new Error('QWebChannel not ready');
    }

    try {
      this.#logger.info("Calling readFileAsBase64 via QWebChannel:", filePath);
      const result = await this.#bridge.readFileAsBase64(filePath);
      this.#logger.info("readFileAsBase64 returned success:", result?.success);
      return result;
    } catch (error) {
      this.#logger.error("readFileAsBase64 failed:", error);
      throw error;
    }
  }
}