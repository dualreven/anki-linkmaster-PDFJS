/**
 * @file UI管理器功能域
 * @module UIManagerFeature
 */

import { UIManagerCore } from './components/ui-manager-core.js';

/**
 * UI管理器功能域
 * @class UIManagerFeature
 * @implements {IFeature}
 */
export class UIManagerFeature {
  #uiManager = null;

  /** 功能名称 */
  get name() {
    return 'ui-manager';
  }

  /** 版本号 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的功能 */
  get dependencies() {
    return ['pdf-manager']; // UI Manager 依赖 PDF Manager
  }

  /**
   * 安装功能
   * @param {FeatureContext} context - 功能上下文
   */
  async install(context) {
    const { globalEventBus, logger } = context;

    logger.info('Installing UIManagerFeature...');

    // 创建 UIManager 实例
    this.#uiManager = new UIManagerCore(globalEventBus);

    // 初始化
    await this.#uiManager.initialize();

    logger.info('UIManagerFeature installed successfully');
  }

  /**
   * 卸载功能
   * @param {FeatureContext} context - 功能上下文
   */
  async uninstall(context) {
    const { logger } = context;

    logger.info('Uninstalling UIManagerFeature...');

    if (this.#uiManager) {
      this.#uiManager.destroy();
      this.#uiManager = null;
    }

    logger.info('UIManagerFeature uninstalled');
  }

  /**
   * 获取 UIManager 实例（供其他 Feature 使用）
   */
  getUIManager() {
    return this.#uiManager;
  }
}
