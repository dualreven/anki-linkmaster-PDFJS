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
import { createScopedEventBus } from "../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "./components/annotation-sidebar-ui.js";
import { ToolRegistry } from "./core/tool-registry.js";
import { AnnotationManager } from "./core/annotation-manager.js";
import { getCenterPercentFromRect } from "./utils/position-utils.js";

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

  /** @type {EventBus} */
  #globalEventBus;

  /** @type {boolean} */
  #ownsScopedEventBus = false;

  /** @type {AnnotationSidebarUI} */
  #sidebarUI;

  /** @type {ToolRegistry} */
  #toolRegistry;

  /** @type {AnnotationManager} */
  #annotationManager;

  /** @type {NavigationService} */
  #navigationService;

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
    return ['app-core', 'ui-manager', 'core-navigation'];
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
    const { globalEventBus, scopedEventBus, logger, container } = context;

    this.#logger = logger || getLogger('AnnotationFeature');
    this.#logger.info(`[${this.name}] Installing (v${this.version})...`);

    if (!globalEventBus) {
      throw new Error(`[${this.name}] Global EventBus not found in context`);
    }

    this.#globalEventBus = globalEventBus;

    if (scopedEventBus) {
      this.#eventBus = scopedEventBus;
    } else {
      this.#eventBus = createScopedEventBus(globalEventBus, this.name);
      this.#ownsScopedEventBus = true;
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

    // 2.5. 从容器获取导航服务（由 core-navigation Feature 提供）
    this.#navigationService = container?.get('navigationService');
    if (!this.#navigationService) {
      this.#logger.warn('[AnnotationFeature] navigationService 未在容器中找到，标注跳转功能可能不可用');
    } else {
      this.#logger.info('[AnnotationFeature] NavigationService obtained from container');
    }

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

    // 4. 【关键修复】使用 registerGlobal() 注册服务到根容器
    // 这样其他 Feature 的 scoped container 也能访问这些服务
    if (container) {
      container.registerGlobal('annotationSidebarUI', this.#sidebarUI);
      container.registerGlobal('toolRegistry', this.#toolRegistry);
      container.registerGlobal('annotationManager', this.#annotationManager);
      this.#logger.info('[AnnotationFeature] Services registered to global container');

      // 验证注册是否成功
      const testGet = container.get('annotationSidebarUI');
      this.#logger.info(`[AnnotationFeature] Verification: annotationSidebarUI retrievable = ${!!testGet}`);
    } else {
      this.#logger.error('[AnnotationFeature] Container is null! Cannot register services');
    }

    // 5. 注册工具插件
    await this.#registerTools();

    // 6. 初始化所有工具（工具现在可以从容器获取依赖）
    const toolContext = {
      eventBus: this.#eventBus,
      logger: this.#logger,
      pdfViewerManager: this.#pdfViewerManager,
      container: this.#container
    };
    await this.#toolRegistry.initializeAll(toolContext);
    this.#logger.info('[AnnotationFeature] All tools initialized');

    // 7. 创建工具按钮UI
    this.#createToolButtons();

    // 8. 创建标注侧边栏切换按钮 (已由SidebarManager统一管理，此处不再创建)
    // this.#createAnnotationButton();

    // 9. 设置事件监听器
    this.#setupEventListeners();

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
    const { TextHighlightTool } = await import('./tools/text-highlight/index.js');
    this.#toolRegistry.register(new TextHighlightTool());
    this.#logger.info('[AnnotationFeature] Text highlight tool registered');

    // Phase 3: 注册批注工具 ✅
    const { CommentTool } = await import('./tools/comment/index.js');
    this.#toolRegistry.register(new CommentTool());
    this.#logger.info('[AnnotationFeature] Comment tool registered');

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
    // 注意：标注CRUD事件的UI更新已由AnnotationSidebarUI自己监听处理
    // 这里不需要重复监听，避免重复添加/删除卡片

    // AnnotationFeature作为容器/协调器，主要职责是：
    // 1. 管理工具注册表、标注管理器、侧边栏UI的生命周期
    // 2. 协调各组件之间的交互（如果需要的话）
    //
    // 标注卡片的添加/删除由AnnotationSidebarUI负责监听和处理
    // 参考：annotation-sidebar-ui.js:322-338

    // 监听标注导航请求
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, (data) => {
      this.#handleNavigateToAnnotation(data);
    }, { subscriberId: 'AnnotationFeature' });
  }

  /**
   * 处理标注导航请求
   * @param {Object} data - 导航数据
   * @param {Annotation|string} data.annotation - 标注对象或标注ID
   * @param {string} [data.id] - 标注ID（备用）
   * @private
   */
  async #handleNavigateToAnnotation(data) {
    try {
      // 获取标注对象
      let annotation = null;

      if (data.annotation) {
        // 如果传入的是标注对象
        if (typeof data.annotation === 'object') {
          annotation = data.annotation;
        }
        // 如果传入的是ID字符串
        else if (typeof data.annotation === 'string') {
          annotation = this.#annotationManager.getAnnotation(data.annotation);
        }
      } else if (data.id) {
        // 备用：使用id字段
        annotation = this.#annotationManager.getAnnotation(data.id);
      }

      if (!annotation) {
        this.#logger.warn('[AnnotationFeature] Annotation not found for navigation', data);
        return;
      }

      const pageNumber = annotation.pageNumber;
      if (!pageNumber) {
        this.#logger.warn('[AnnotationFeature] Annotation has no page number', annotation);
        return;
      }

      this.#logger.info(`[AnnotationFeature] Navigating to annotation on page ${pageNumber}`, annotation.id);

      // 计算位置百分比（批注使用position字段）
      let position = null;
      if (annotation.type === 'screenshot' && annotation.data?.rectPercent) {
        const centerPercent = getCenterPercentFromRect(annotation.data.rectPercent);
        if (centerPercent !== null) {
          position = centerPercent;
          this.#logger.info(`[AnnotationFeature] Calculated position from rectPercent: ${centerPercent.toFixed(2)}%`);
        }
      }

      if (position === null && annotation.data && annotation.data.position) {
        const annotationPosition = annotation.data.position;

        // 先导航到页面，确保页面已渲染
        await this.#navigationService.navigateTo({
          pageAt: pageNumber,
          position: null  // 先不指定位置
        });

        // 等待页面渲染完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 获取页面元素来计算精确位置
        const viewerContainer = document.getElementById('viewerContainer');
        if (viewerContainer) {
          const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
          if (pageElement) {
            const pageHeight = pageElement.offsetHeight;
            // 计算标注在页面中的位置百分比
            position = (annotationPosition.y / pageHeight) * 100;
            this.#logger.info(`[AnnotationFeature] Calculated position: ${position.toFixed(2)}% (y=${annotationPosition.y}, pageHeight=${pageHeight})`);
          } else {
            this.#logger.warn(`[AnnotationFeature] Page element not found for page ${pageNumber}`);
          }
        }
      }
      if (position === null && annotation.data && annotation.data.boundingBox) {
        // 兼容其他类型标注使用boundingBox
        const boundingBox = annotation.data.boundingBox;

        await this.#navigationService.navigateTo({
          pageAt: pageNumber,
          position: null
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const viewerContainer = document.getElementById('viewerContainer');
        if (viewerContainer) {
          const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
          if (pageElement) {
            const pageHeight = pageElement.offsetHeight;
            position = (boundingBox.y / pageHeight) * 100;
            this.#logger.info(`[AnnotationFeature] Calculated position from boundingBox: ${position.toFixed(2)}%`);
          }
        }
      }

      // 如果计算出了位置，进行精确定位
      if (position !== null) {
        const result = await this.#navigationService.navigateTo({
          pageAt: pageNumber,
          position: position
        });

        if (result.success) {
          // 发出导航成功事件
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS, {
            annotation: annotation,
            pageNumber: result.actualPage,
            position: result.actualPosition
          });

          // 高亮目标标注（视觉反馈）
          this.#highlightAnnotationMarker(annotation.id);

          this.#logger.info(`[AnnotationFeature] Navigation succeeded: page=${result.actualPage}, position=${result.actualPosition}%`);
        } else {
          throw new Error(result.error || 'Navigation failed');
        }
      } else {
        // 没有位置信息，只跳转到页面
        const result = await this.#navigationService.navigateTo({
          pageAt: pageNumber,
          position: null
        });

        if (result.success) {
          // 发出导航成功事件
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_SUCCESS, {
            annotation: annotation,
            pageNumber: result.actualPage,
            position: result.actualPosition
          });

          // 高亮目标标注（视觉反馈）
          this.#highlightAnnotationMarker(annotation.id);

          this.#logger.info(`[AnnotationFeature] Navigation succeeded: page=${result.actualPage}, position=${result.actualPosition}%`);
        } else {
          throw new Error(result.error || 'Navigation failed');
        }
      }

    } catch (error) {
      this.#logger.error('[AnnotationFeature] Error navigating to annotation:', error);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
        error: error.message
      });
    }
  }

  /**
   * 高亮标注标记（视觉反馈）
   * @param {string} annotationId - 标注ID
   * @private
   */
  #highlightAnnotationMarker(annotationId) {
    // 发出标注选择事件，由CommentTool处理高亮
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, {
      id: annotationId
    }, { actorId: 'AnnotationFeature' });

    this.#logger.debug(`[AnnotationFeature] Highlight marker requested for ${annotationId}`);
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

    // 检测容器是否在header中（通过检查是否有sidebar-buttons类或在header-right中）
    const inHeader = buttonContainer.classList.contains('sidebar-buttons') ||
                     buttonContainer.closest('.header-right') !== null;

    // 创建标注按钮
    const button = document.createElement('button');
    button.id = 'annotation-toggle-btn';
    button.type = 'button';
    button.textContent = '✎ 标注';
    button.title = '打开标注（Ctrl+Shift+A）';
    button.className = 'btn'; // 使用统一的btn样式

    // 只有在非header模式才添加内联样式
    if (!inHeader) {
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
    }

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

    // 注意：不需要销毁 navigationService，它由 core-navigation Feature 管理
    this.#navigationService = null;

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

    if (this.#ownsScopedEventBus && typeof this.#eventBus?.destroy === 'function') {
      this.#eventBus.destroy();
    }

    this.#eventBus = null;
    this.#globalEventBus = null;
    this.#ownsScopedEventBus = false;

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
