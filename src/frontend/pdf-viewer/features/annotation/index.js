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
  /** @type {Logger} */
  #logger;

  /** @type {EventBus} */
  #eventBus;

  /** @type {AnnotationSidebarUI} */
  #sidebarUI;

  /** @type {HTMLElement} */
  #toggleButton;

  /** Feature名称 */
  get name() {
    return 'annotation';
  }

  /** 版本号 */
  get version() {
    return '1.0.0';
  }

  /** 依赖的Features */
  get dependencies() {
    return ['app-core', 'ui-manager'];
  }

  /**
   * 安装Feature
   * @param {Object} context - Feature上下文
   * @param {EventBus} context.globalEventBus - 全局事件总线
   * @param {Logger} context.logger - 日志记录器
   * @returns {Promise<void>}
   */
  async install(context) {
    console.log('🎯 AnnotationFeature.install() CALLED', context);
    const { globalEventBus, logger, container } = context;

    this.#logger = logger || getLogger('AnnotationFeature');
    this.#logger.info(`[${this.name}] Installing...`);
    console.log('🎯 AnnotationFeature: logger initialized');

    // 获取事件总线
    this.#eventBus = globalEventBus;
    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus not found in context`);
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
    console.log('🎯 AnnotationFeature: About to create annotation button');
    this.#createAnnotationButton();
    console.log('🎯 AnnotationFeature: Button creation completed');

    // 注册服务到容器
    if (container) {
      container.register('annotationSidebarUI', this.#sidebarUI);
    }

    this.#logger.info(`[${this.name}] Installed successfully`);
    console.log('🎯 AnnotationFeature: Installation COMPLETE');
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
    console.log('🔧 #createAnnotationButton() START');

    // 查找书签按钮所在的容器（由BookmarkSidebarUI创建）
    // 使用ID选择器，更可靠
    let buttonContainer = document.getElementById('pdf-viewer-button-container');
    console.log('🔧 buttonContainer by ID:', buttonContainer);

    if (!buttonContainer) {
      console.error('❌ Button container NOT FOUND');
      this.#logger.warn('Button container #pdf-viewer-button-container not found, cannot create annotation button');
      return;
    }

    console.log('✅ Button container FOUND:', buttonContainer);

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
    console.log('🔧 bookmarkBtn:', bookmarkBtn);
    console.log('🔧 bookmarkBtn.nextSibling:', bookmarkBtn?.nextSibling);

    if (bookmarkBtn && bookmarkBtn.nextSibling) {
      buttonContainer.insertBefore(button, bookmarkBtn.nextSibling);
      console.log('✅ Button inserted BEFORE nextSibling');
    } else {
      buttonContainer.appendChild(button);
      console.log('✅ Button APPENDED');
    }

    this.#toggleButton = button;
    console.log('✅ Annotation button created! ID:', button.id);
    console.log('✅ Button container children:', buttonContainer.children.length);
    console.log('✅ Buttons:', Array.from(buttonContainer.children).map(b => b.textContent));
    this.#logger.info('Annotation button created and inserted');

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
