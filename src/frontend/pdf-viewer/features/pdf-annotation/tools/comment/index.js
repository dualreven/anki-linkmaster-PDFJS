/**
 * CommentTool - 批注工具插件
 * @module features/annotation/tools/comment
 * @description 实现PDF批注功能的工具插件
 *
 * 详细拆分说明：`docs/standards/comment-tool.md`
 */

import { getLogger } from "../../../../../common/utils/logger.js";
import { IAnnotationTool } from "../../interfaces/IAnnotationTool.js";
import { CommentInput } from "./comment-input.js";
import { CommentMarker } from "./comment-marker.js";
import { createCommentAnnotationCard } from "./comment-tool-annotation-card.js";
import { confirmCommentDeleteAsync } from "./comment-tool-confirm-dialog.js";
import { installCommentToolPageRendering } from "./comment-tool-page-rendering.js";
import { installCommentToolAnnotationEventListeners } from "./comment-tool-subscriptions.js";
import {
  activateCommentTool,
  deactivateCommentTool,
  handleCommentToolMarkerClick,
  handleCommentToolPdfClick,
} from "./comment-tool-interactions.js";
import { createCommentToolButton } from "./comment-tool-button.js";
import { Annotation } from "../../../../../common/models/annotation.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import {
  ensureOverlayOrQueue,
  flushPendingMarkersForPage,
  renderCommentMarkerForAnnotation,
  restoreMarkersForPage,
} from "./comment-tool-marker-restoration.js";

/**
 * 批注工具类
 * @class CommentTool
 * @implements {IAnnotationTool}
 */
export class CommentTool extends IAnnotationTool {
  get name() {
    return "comment";
  }
  get displayName() {
    return "批注";
  }
  get icon() {
    return "📝";
  }
  get version() {
    return "1.0.0";
  }
  get dependencies() {
    return [];
  }

  /** @type {import('../../../../../common/utils/logger.js').Logger} */
  #logger = null;

  /** @type {import('../../../../../common/event/event-bus.js').EventBus} */
  #eventBus = null;

  /** @type {Object} PDF查看器管理器 */
  #pdfViewerManager = null;

  /** @type {Object} PDF.js EventBus (用于监听页面渲染事件) */
  #pdfjsEventBus = null;

  /** @type {Object} 标注管理器 (用于获取标注数据) */
  #annotationManager = null;

  /** @type {boolean} 是否激活 */
  #isActive = false;

  /** @type {CommentInput} 输入组件 */
  #commentInput = null;

  /** @type {CommentMarker} 标记渲染器 */
  #commentMarker = null;

  /** @type {Function} 点击处理器 */
  #clickHandler = null;

  /** @type {string} 原始鼠标样式 */
  #originalCursor = "";

  /** @type {Map<number, Map<string, any>>} 待渲染队列（按页） */
  #pendingMarkersByPage = new Map();

  /** @type {Function|null} 数据加载后的处理器 */
  #onAnnotationDataLoadedHandler = null;

  /** @type {Function[]} 统一 unsubscribe 集合 */
  #unsubscribeFunctions = [];

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @returns {Promise<void>}
   */
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager, container } = context;

    this.#logger = logger || getLogger("CommentTool");
    this.#eventBus = eventBus;
    this.#pdfViewerManager = pdfViewerManager;
    this.#unsubscribeFunctions = [];

    this.#pdfjsEventBus = pdfViewerManager?.eventBus || null;
    if (!this.#pdfjsEventBus) {
      this.#logger.error("❌ PDF.js EventBus not available, marker restoration will NOT work!");
    }

    this.#annotationManager = container?.get?.("annotationManager") || null;
    if (!this.#annotationManager) {
      this.#logger.error("❌ AnnotationManager not found in container!");
    }

    this.#commentInput = new CommentInput();
    this.#commentMarker = new CommentMarker();

    this.#setupPageRenderingListener();

    // 监听标注数据加载完成（用于补画/入队）
    this.#onAnnotationDataLoadedHandler = (data) => {
      try {
        const anns = Array.isArray(data?.annotations) ? data.annotations : [];
        const comments = anns.filter((a) => a?.type === "comment");
        this.#logger.info(`📥 [DataLoaded] total=${anns.length}, comments=${comments.length}`);
        comments.forEach((ann) => this.ensureOverlayFor(ann));
      } catch (e) {
        this.#logger?.warn?.("[CommentTool] handleAnnotationsLoaded failed", e);
      }
    };
    const unsubLoaded = this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
      this.#onAnnotationDataLoadedHandler,
      { subscriberId: "CommentTool" }
    );
    if (typeof unsubLoaded !== "function") {
      throw new Error("[CommentTool] eventBus.on must return an unsubscribe function");
    }
    this.#unsubscribeFunctions.push(unsubLoaded);

    // 设置标注事件监听
    this.#setupAnnotationEventListeners();
    this.#logger.info(`✅ CommentTool initialized (v${this.version})`);
  }

  /**
   * 激活工具
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn("CommentTool already active");
      return;
    }

    this.#isActive = true;

    const { originalCursor, clickHandler } = activateCommentTool({
      logger: this.#logger,
      eventBus: this.#eventBus,
      toolName: this.name,
      onPdfClick: (e) => this.#handlePdfClick(e),
    });
    this.#originalCursor = originalCursor;
    this.#clickHandler = clickHandler;

    this.#logger.info("CommentTool activated");
  }

  /**
   * 停用工具
   */
  deactivate() {
    if (!this.#isActive) {
      return;
    }

    this.#isActive = false;

    deactivateCommentTool({
      logger: this.#logger,
      eventBus: this.#eventBus,
      toolName: this.name,
      commentInput: this.#commentInput,
      originalCursor: this.#originalCursor,
      clickHandler: this.#clickHandler,
    });
    this.#clickHandler = null;
  }

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * 处理PDF点击
   * @private
   * @param {MouseEvent} e - 鼠标事件
   */
  #handlePdfClick(e) {
    handleCommentToolPdfClick({
      e,
      logger: this.#logger,
      commentInput: this.#commentInput,
      getCurrentPageNumber: () => this.#getCurrentPageNumber(),
      onCreateComment: (x, y, pageNumber, pageWidth, pageHeight, content) => (
        this.#createComment(x, y, pageNumber, pageWidth, pageHeight, content)
      )
    });
  }

  /**
   * 创建批注
   * @private
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} pageNumber - 页码
   * @param {number} pageWidth - 页面宽度(px)
   * @param {number} pageHeight - 页面高度(px)
   * @param {string} content - 批注内容
   */
  #createComment(x, y, pageNumber, pageWidth, pageHeight, content) {
    this.#logger.info(`Creating comment at (${x}, ${y}) on page ${pageNumber}: "${content}"`);

    // 将像素坐标换算为百分比存储
    const xPercent = Math.max(0, Math.min(100, (x / (pageWidth || 1)) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / (pageHeight || 1)) * 100));

    // 创建标注对象（使用静态工厂方法，传入百分比坐标）
    const annotation = Annotation.createComment(pageNumber, { xPercent, yPercent }, content);

    // 发布创建事件（标记渲染会在annotation:create:success事件中统一处理）
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      { annotation },
      { actorId: "CommentTool" }
    );

    this.#logger.info(`Comment annotation creation requested: ${annotation.id}`);
  }

  /**
   * 处理标记点击
   * @private
   * @param {string} annotationId - 标注ID
   */
  #handleMarkerClick(annotationId) {
    handleCommentToolMarkerClick({
      annotationId,
      logger: this.#logger,
      eventBus: this.#eventBus,
      commentMarker: this.#commentMarker
    });
  }

  /**
   * 设置页面渲染事件监听
   * @private
   */
  #setupPageRenderingListener() {
    const unsubs = installCommentToolPageRendering({
      pdfjsEventBus: this.#pdfjsEventBus,
      eventBus: this.#eventBus,
      logger: this.#logger,
      pdfViewerManager: this.#pdfViewerManager,
      commentMarker: this.#commentMarker,
      flushPendingForPage: (pn) => this.#flushPendingForPage(pn),
      restoreMarkersForPage: (pn) => this.#restoreMarkersForPage(pn),
    });
    this.#unsubscribeFunctions.push(...unsubs);
  }

  /**
   * 设置标注事件监听
   * @private
   */
  #setupAnnotationEventListeners() {
    if (!this.#eventBus) {
      this.#logger.error("❌ Cannot setup annotation event listeners: eventBus not available");
      return;
    }

    const unsubs = installCommentToolAnnotationEventListeners({
      eventBus: this.#eventBus,
      logger: this.#logger,
      ensureOverlayFor: (annotation) => this.ensureOverlayFor(annotation),
      commentMarker: this.#commentMarker,
      pendingMarkersByPage: this.#pendingMarkersByPage,
    });
    this.#unsubscribeFunctions.push(...unsubs);
  }

  /**
   * 若页面就绪则立即渲染，否则加入待渲染队列
   * @param {Annotation} annotation
   */
  ensureOverlayFor(annotation) {
    try {
      ensureOverlayOrQueue({
        annotation,
        isPageReady: (pageNumber) => this.#isPageReady(pageNumber),
        pendingMarkersByPage: this.#pendingMarkersByPage,
        renderMarkerForAnnotation: (ann) => this.#renderMarkerForAnnotation(ann),
        logger: this.#logger
      });
    } catch (e) {
      this.#logger?.warn?.("[CommentTool] ensureOverlayFor failed", e);
    }
  }

  /**
   * 刷新某页的待渲染批注标记
   * @param {number} pageNumber
   * @private
   */
  #flushPendingForPage(pageNumber) {
    try {
      flushPendingMarkersForPage({
        pageNumber,
        pendingMarkersByPage: this.#pendingMarkersByPage,
        renderMarkerForAnnotation: (ann) => this.#renderMarkerForAnnotation(ann),
        logger: this.#logger
      });
    } catch (e) {
      this.#logger?.warn?.("[CommentTool] flushPendingForPage failed", e);
    }
  }

  /**
   * 判断页面是否就绪（存在 pageView.div）
   * @param {number} pageNumber
   * @returns {boolean}
   * @private
   */
  #isPageReady(pageNumber) {
    try {
      const pageView = (pageNumber > 0) ? this.#pdfViewerManager?.getPageView?.(pageNumber) : null;
      return !!(pageView && pageView.div);
    } catch (e) {
      void e; /* logger-guard */
      return false;
    }
  }

  /**
   * 恢复指定页面的所有标记
   * @private
   * @param {number} pageNumber - 页码
   */
  #restoreMarkersForPage(pageNumber) {
    restoreMarkersForPage({
      pageNumber,
      annotationManager: this.#annotationManager,
      renderMarkerForAnnotation: (ann) => this.#renderMarkerForAnnotation(ann),
      logger: this.#logger
    });
  }

  /**
   * 为标注渲染标记
   * @private
   * @param {Annotation} annotation - 标注对象
   */
  #renderMarkerForAnnotation(annotation) {
    renderCommentMarkerForAnnotation({
      annotation,
      commentMarker: this.#commentMarker,
      getPageElement: (pageNumber) => this.#getPageElement(pageNumber),
      onMarkerClick: (annotationId) => this.#handleMarkerClick(annotationId),
      logger: this.#logger
    });
  }

  /**
   * 获取当前页码
   * @private
   * @returns {number}
   */
  #getCurrentPageNumber() {
    // 简化版：返回1，实际应该从PDFViewerManager获取
    if (this.#pdfViewerManager && this.#pdfViewerManager.currentPageNumber) {
      return this.#pdfViewerManager.currentPageNumber;
    }
    return 1;
  }

  /**
   * 获取页面元素
   * @private
   * @param {number} pageNumber - 页码
   * @returns {HTMLElement|null}
   */
  #getPageElement(pageNumber) {
    // 查找对应页码的页面元素
    const pageElement = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
    if (pageElement) {
      return pageElement;
    }

    // 备用方案：使用PDF容器
    const pdfContainer = document.querySelector(".pdf-container");
    return pdfContainer;
  }

  /**
   * 创建工具按钮
   * @returns {HTMLElement}
   */
  createToolButton() {
    return createCommentToolButton({
      toolName: this.name,
      displayName: this.displayName,
      icon: this.icon,
      eventBus: this.#eventBus,
      isActive: () => this.isActive(),
      deactivate: () => this.deactivate()
    });
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation) {
    return createCommentAnnotationCard({
      annotation,
      icon: this.icon,
      eventBus: this.#eventBus,
      commentMarker: this.#commentMarker,
      confirmDeleteAsync: ({ message }) => confirmCommentDeleteAsync({ message, logger: this.#logger }),
      logger: this.#logger
    });
  }

  /**
   * 销毁工具
   */
  destroy() {
    const logger = this.#logger || getLogger("CommentTool");
    logger.info("Destroying CommentTool");

    // 停用工具
    if (this.isActive()) {
      this.deactivate();
    }

    // 取消所有订阅（EventBus + PDF.js EventBus）
    for (const unsub of this.#unsubscribeFunctions) {
      try {
        unsub();
      } catch (e) {
        logger.warn("[CommentTool] unsubscribe failed during destroy", e);
      }
    }
    this.#unsubscribeFunctions = [];

    // 销毁组件
    if (this.#commentInput) {
      this.#commentInput.destroy();
      this.#commentInput = null;
    }

    if (this.#commentMarker) {
      this.#commentMarker.destroy();
      this.#commentMarker = null;
    }

    this.#pendingMarkersByPage.clear();
    this.#onAnnotationDataLoadedHandler = null;

    this.#annotationManager = null;
    this.#pdfjsEventBus = null;
    this.#pdfViewerManager = null;
    this.#eventBus = null;

    logger.info("CommentTool destroyed");
    this.#logger = null;
  }
}

export default CommentTool;
