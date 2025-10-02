/**
 * @file PDF管理器功能域
 * @module PDFManagerFeature
 */

import { PDFManager } from '../../pdf/pdf-manager-refactored.js';

/**
 * PDF管理器功能域
 * @class PDFManagerFeature
 * @implements {IFeature}
 */
export class PDFManagerFeature {
  #pdfManager = null;

  /** 功能名称 */
  get name() {
    return 'pdf-manager';
  }

  /** 版本号 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的功能 */
  get dependencies() {
    return []; // PDF Manager 是基础功能，无依赖
  }

  /**
   * 安装功能
   * @param {FeatureContext} context - 功能上下文
   */
  async install(context) {
    const { globalEventBus, logger } = context;

    logger.info('Installing PDFManagerFeature...');

    // 创建 PDFManager 实例
    this.#pdfManager = new PDFManager(globalEventBus);

    // 初始化
    await this.#pdfManager.initialize();

    logger.info('PDFManagerFeature installed successfully');
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info('Uninstalling PDFManagerFeature...');

    if (this.#pdfManager) {
      this.#pdfManager.destroy();
      this.#pdfManager = null;
    }

    logger.info('PDFManagerFeature uninstalled');
  }

  /**
   * 获取 PDFManager 实例（供其他 Feature 使用）
   */
  getPDFManager() {
    return this.#pdfManager;
  }
}
