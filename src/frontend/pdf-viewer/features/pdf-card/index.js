/**
 * PDF卡片功能Feature
 * @file PDF Viewer的Anki卡片管理功能
 * @description 第一期实现：仅包含UI容器，不实现具体业务逻辑
 */

import { getLogger } from '../../../common/utils/logger.js';
import { PDFCardFeatureConfig } from './feature.config.js';
import { CardSidebarUI } from './components/card-sidebar-ui.js';

export class PDFCardFeature {
  #logger = null;
  #eventBus = null;
  #container = null;
  #cardSidebarUI = null;
  #enabled = false;

  /**
   * Feature名称
   */
  get name() {
    return PDFCardFeatureConfig.name;
  }

  /**
   * 版本号
   */
  get version() {
    return PDFCardFeatureConfig.version;
  }

  /**
   * 依赖的Features
   */
  get dependencies() {
    return PDFCardFeatureConfig.dependencies;
  }

  /**
   * 安装Feature
   * @param {Object} context - Feature上下文
   * @param {EventBus} context.globalEventBus - 全局事件总线
   * @param {Object} context.container - 依赖容器
   * @param {Logger} context.logger - 日志记录器
   */
  async install(context) {
    const { globalEventBus, container, logger } = context;

    this.#eventBus = globalEventBus;
    this.#container = container;
    this.#logger = logger || getLogger(`Feature.${this.name}`);

    this.#logger.info(`Installing ${this.name} v${this.version}...`);

    // 创建并初始化卡片侧边栏UI
    this.#cardSidebarUI = new CardSidebarUI(this.#eventBus);
    this.#cardSidebarUI.initialize();

    // 将UI注册到全局依赖容器（供SidebarManager跨Feature访问）
    if (this.#container) {
      this.#container.registerGlobal('cardSidebarUI', this.#cardSidebarUI);
      this.#logger.info('CardSidebarUI registered to global container');
    }

    this.#enabled = true;
    this.#logger.info(`${this.name} installed successfully`);
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info(`Uninstalling ${this.name}...`);

    // 销毁UI组件
    if (this.#cardSidebarUI) {
      this.#cardSidebarUI.destroy();
      this.#cardSidebarUI = null;
    }

    this.#enabled = false;
    this.#logger.info(`${this.name} uninstalled`);
  }

  /**
   * 检查Feature是否已启用
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * 获取卡片侧边栏UI实例
   * @returns {CardSidebarUI}
   */
  getCardSidebarUI() {
    return this.#cardSidebarUI;
  }
}
