/**
 * Annotation Feature - PDF标注功能
 * @module features/annotation
 * @description 提供PDF标注功能，包括截图、选字高亮和批注
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "./components/annotation-sidebar-ui.js";

/**
 * 标注功能Feature
 * @class AnnotationFeature
 * @implements {IFeature}
 */
export class AnnotationFeature {
  /** @type {string} Feature名称 */
  name = 'annotation';

  /** @type {string} 版本号 */
  version = '1.0.0';

  /** @type {Array<string>} 依赖的Features */
  dependencies = ['app-core'];

  /** @type {Logger} */
  #logger;

  /** @type {EventBus} */
  #eventBus;

  /** @type {AnnotationSidebarUI} */
  #sidebarUI;

  /** @type {HTMLElement} */
  #toggleButton;

  /**
   * 安装Feature
   * @param {IDependencyContainer} container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(container) {
    this.#logger = getLogger('AnnotationFeature');
    this.#logger.info(`[${this.name}] Installing...`);

    // 获取依赖
    this.#eventBus = container.resolve('eventBus');
    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus not found in container`);
    }

    // 创建标注侧边栏UI
    const mainContainer = document.querySelector('main');
    if (!mainContainer) {
      throw new Error(`[${this.name}] Main container not found`);
    }

    this.#sidebarUI = new AnnotationSidebarUI(this.#eventBus, {
      container: mainContainer
    });
    this.#sidebarUI.initialize();

    // 创建标注按钮
    this.#createAnnotationButton();

    // 注册服务到容器
    container.register('annotationSidebarUI', this.#sidebarUI);

    this.#logger.info(`[${this.name}] Installed successfully`);
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`[${this.name}] Uninstalling...`);

    // 销毁侧边栏UI
    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
      this.#sidebarUI = null;
    }

    // 移除按钮
    if (this.#toggleButton) {
      this.#toggleButton.remove();
      this.#toggleButton = null;
    }

    this.#logger.info(`[${this.name}] Uninstalled successfully`);
  }

  /**
   * 创建标注按钮
   * @private
   */
  #createAnnotationButton() {
    // 在header-right中查找合适的位置插入按钮
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) {
      this.#logger.warn('Header-right not found, cannot create annotation button');
      return;
    }

    // 创建标注按钮容器
    const annotationControls = document.createElement('div');
    annotationControls.className = 'annotation-controls';
    annotationControls.style.cssText = 'display: flex; align-items: center; margin-right: 8px;';

    // 创建标注按钮
    const button = document.createElement('button');
    button.id = 'annotation-toggle-btn';
    button.className = 'btn';
    button.title = '标注（Ctrl+Shift+A）';
    button.textContent = '📝 标注';
    button.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 4px',
      'padding: 6px 12px',
      'font-size: 14px'
    ].join(';');

    // 点击事件
    button.addEventListener('click', () => {
      this.#logger.debug('Annotation button clicked');
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
    });

    // 键盘快捷键 Ctrl+Shift+A
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
      }
    });

    annotationControls.appendChild(button);

    // 插入到header-right的第一个位置（最左边）
    headerRight.insertBefore(annotationControls, headerRight.firstChild);

    this.#toggleButton = button;
    this.#logger.debug('Annotation button created');

    // 监听侧边栏状态，更新按钮样式
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, () => {
      button.style.background = '#e3f2fd';
      button.style.borderColor = '#2196f3';
    }, { subscriberId: 'AnnotationFeature' });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, () => {
      button.style.background = '';
      button.style.borderColor = '';
    }, { subscriberId: 'AnnotationFeature' });
  }
}

export default AnnotationFeature;
