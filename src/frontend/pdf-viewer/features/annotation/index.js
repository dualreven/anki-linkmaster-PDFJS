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
  dependencies = ['app-core', 'ui-manager'];

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

    // 延迟创建标注按钮，确保BookmarkSidebarUI已经创建了按钮容器
    // 使用setTimeout让UIManager完成初始化
    setTimeout(() => {
      this.#createAnnotationButton();
    }, 100);

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
    // 查找书签按钮所在的容器（由BookmarkSidebarUI创建）
    // 容器可能在main元素内，也可能在body上（fixed定位）
    const mainContainer = document.querySelector('main');
    let buttonContainer = mainContainer ? mainContainer.querySelector('div[style*="flex-direction:column"]') : null;

    if (!buttonContainer) {
      // 尝试在body上查找fixed定位的容器
      buttonContainer = document.body.querySelector('div[style*="position:fixed"][style*="flex-direction:column"]');
    }

    if (!buttonContainer) {
      this.#logger.warn('Button container not found, cannot create annotation button');
      return;
    }

    // 创建标注按钮
    const button = document.createElement('button');
    button.id = 'annotation-toggle-btn';
    button.type = 'button';
    button.textContent = '✎ 标注';
    button.title = '打开标注（Ctrl+Shift+A）';
    button.style.cssText = [
      'padding:4px 8px',
      'border:1px solid #ddd',
      'border-radius:4px',
      'background:#fff',
      'cursor:pointer',
      'box-shadow:0 1px 2px rgba(0,0,0,0.06)',
      'font-size:13px',
      'white-space:nowrap'
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
        this.#logger.debug('Annotation keyboard shortcut triggered');
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
      }
    });

    // 插入到书签按钮后面
    const bookmarkBtn = buttonContainer.querySelector('button');
    if (bookmarkBtn && bookmarkBtn.nextSibling) {
      buttonContainer.insertBefore(button, bookmarkBtn.nextSibling);
    } else {
      buttonContainer.appendChild(button);
    }

    this.#toggleButton = button;
    this.#logger.debug('Annotation button created and inserted after bookmark button');

    // 监听侧边栏状态，更新按钮样式
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, () => {
      button.style.background = '#e3f2fd';
      button.style.borderColor = '#2196f3';
    }, { subscriberId: 'AnnotationFeature' });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, () => {
      button.style.background = '#fff';
      button.style.borderColor = '#ddd';
    }, { subscriberId: 'AnnotationFeature' });
  }
}

export default AnnotationFeature;
