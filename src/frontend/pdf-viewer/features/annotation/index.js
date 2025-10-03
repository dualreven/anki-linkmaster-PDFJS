/**
 * Annotation Feature - PDF标注功能（模块化容器版）
 * @module features/annotation
 * @description 提供PDF标注功能，采用插件化架构
 *
 * v003架构说明:
 * - AnnotationFeature作为容器和协调器
 * - ToolRegistry管理工具插件的注册和生命周期
 * - AnnotationManager管理标注数据的CRUD和持久化
 * - AnnotationSidebarUI管理侧边栏UI和标注列表
 * - 各工具作为独立插件实现IAnnotationTool接口
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "./components/annotation-sidebar-ui.js";
import { ToolRegistry } from "./core/tool-registry.js";
import { AnnotationManager } from "./core/annotation-manager.js";

/**
 * 标注功能Feature（容器模式）
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

  /** @type {ToolRegistry} */
  #toolRegistry;

  /** @type {AnnotationManager} */
  #annotationManager;

  /** @type {HTMLElement} */
  #toggleButton;

  /** @type {Object} */
  #container;

  /** @type {Object} */
  #pdfViewerManager;

  /** Feature名称 */
  get name() {
    return 'annotation';
  }

  /** 版本号 */
  get version() {
    return '2.0.0'; // v003模块化架构版本
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
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async install(context) {
    const { globalEventBus, logger, container } = context;

    this.#logger = logger || getLogger('AnnotationFeature');
    this.#logger.info(`[${this.name}] Installing (v${this.version})...`);

    // 获取事件总线
    this.#eventBus = globalEventBus;
    if (!this.#eventBus) {
      throw new Error(`[${this.name}] EventBus not found in context`);
    }

    this.#container = container;

    // 获取PDF查看器管理器（用于初始化工具）
    this.#pdfViewerManager = container?.get('pdfViewerManager');
    if (!this.#pdfViewerManager) {
      this.#logger.warn('[AnnotationFeature] PDFViewerManager not found, some tools may not work');
    }

    // 1. 创建工具注册表
    this.#toolRegistry = new ToolRegistry(this.#eventBus, this.#logger);
    this.#logger.info('[AnnotationFeature] ToolRegistry created');

    // 2. 创建标注管理器
    this.#annotationManager = new AnnotationManager(this.#eventBus, this.#logger);
    this.#logger.info('[AnnotationFeature] AnnotationManager created');

    // 3. 创建侧边栏UI
    const mainContainer = document.querySelector('main');
    if (!mainContainer) {
      throw new Error(`[${this.name}] Main container not found`);
    }

    this.#sidebarUI = new AnnotationSidebarUI(this.#eventBus, {
      container: mainContainer
    });
    this.#sidebarUI.initialize();
    this.#logger.info('[AnnotationFeature] AnnotationSidebarUI initialized');

    // 4. 注册工具插件
    await this.#registerTools();

    // 5. 初始化所有工具
    const toolContext = {
      eventBus: this.#eventBus,
      logger: this.#logger,
      pdfViewerManager: this.#pdfViewerManager,
      container: this.#container
    };
    await this.#toolRegistry.initializeAll(toolContext);
    this.#logger.info('[AnnotationFeature] All tools initialized');

    // 6. 创建工具按钮UI
    this.#createToolButtons();

    // 7. 创建标注侧边栏切换按钮
    this.#createAnnotationButton();

    // 8. 设置事件监听器
    this.#setupEventListeners();

    // 9. 注册服务到容器
    if (container) {
      container.register('annotationSidebarUI', this.#sidebarUI);
      container.register('toolRegistry', this.#toolRegistry);
      container.register('annotationManager', this.#annotationManager);
    }

    this.#logger.info(`[${this.name}] Installed successfully`);
  }

  /**
   * 注册工具插件
   * @private
   */
  async #registerTools() {
    this.#logger.info('[AnnotationFeature] Registering tools...');

    // Phase 1: 注册截图工具
    const { ScreenshotTool } = await import('./tools/screenshot/index.js');
    const screenshotTool = new ScreenshotTool();
    this.#toolRegistry.register(screenshotTool);
    this.#logger.info('[AnnotationFeature] Screenshot tool registered');

    // Phase 2: 注册文字高亮工具
    // const { TextHighlightTool } = await import('./tools/text-highlight/index.js');
    // this.#toolRegistry.register(new TextHighlightTool());

    // Phase 3: 注册批注工具
    // const { CommentTool } = await import('./tools/comment/index.js');
    // this.#toolRegistry.register(new CommentTool());

    this.#logger.info(`[AnnotationFeature] ${this.#toolRegistry.getCount()} tools registered`);
  }

  /**
   * 创建工具按钮UI
   * @private
   */
  #createToolButtons() {
    if (this.#toolRegistry.getCount() === 0) {
      this.#logger.warn('[AnnotationFeature] No tools to create buttons for');
      return;
    }

    this.#logger.info('[AnnotationFeature] Creating tool buttons...');

    // Phase 1: 工具按钮创建由各工具自己负责
    // ToolRegistry会在工具激活时创建按钮
    // 这里不需要额外操作

    this.#logger.info(`[AnnotationFeature] Tool buttons will be created by tools`);
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听标注创建成功事件
    this.#eventBus.on('annotation:create:success', (data) => {
      const { annotation } = data;
      this.#logger.info(`[AnnotationFeature] Annotation created: ${annotation.id}`);
      // 更新侧边栏UI（使用现有方法addAnnotationCard）
      this.#sidebarUI.addAnnotationCard(annotation);
    }, { subscriberId: 'AnnotationFeature' });

    // 监听标注删除成功事件
    this.#eventBus.on('annotation:delete:success', (data) => {
      const { id } = data;
      this.#logger.info(`[AnnotationFeature] Annotation deleted: ${id}`);
      // 更新侧边栏UI（使用现有方法removeAnnotationCard）
      this.#sidebarUI.removeAnnotationCard(id);
    }, { subscriberId: 'AnnotationFeature' });
  }

  /**
   * 创建标注侧边栏切换按钮
   * @private
   */
  #createAnnotationButton() {
    // 查找按钮容器（由BookmarkSidebarUI创建）
    let buttonContainer = document.getElementById('pdf-viewer-button-container');

    if (!buttonContainer) {
      this.#logger.warn('Button container #pdf-viewer-button-container not found, cannot create annotation button');
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

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`[${this.name}] Uninstalling...`);

    // 销毁所有工具
    if (this.#toolRegistry) {
      this.#toolRegistry.destroyAll();
      this.#toolRegistry = null;
    }

    // 清空标注数据
    if (this.#annotationManager) {
      this.#annotationManager.clear();
      this.#annotationManager = null;
    }

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
   * 获取Feature状态（用于调试）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      name: this.name,
      version: this.version,
      toolRegistry: this.#toolRegistry?.getStatus(),
      annotationManager: this.#annotationManager?.getStatus()
    };
  }
}

export default AnnotationFeature;
