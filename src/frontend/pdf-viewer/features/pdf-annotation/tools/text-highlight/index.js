/**
 * TextHighlightTool - 文字高亮工具
 * @module features/annotation/tools/text-highlight
 * @description 实现文本选择和高亮标注功能
 */

import { IAnnotationTool } from "../../interfaces/IAnnotationTool.js";
import { TextSelectionHandler } from "./text-selection-handler.js";
import { HighlightRenderer } from "./highlight-renderer.js";
import { FloatingColorToolbar } from "./floating-color-toolbar.js";
import { HighlightActionMenu } from "./highlight-action-menu.js";
import { HighlightOverlayController } from "./highlight-overlay-controller.js";
import { installTextHighlightSubscriptions } from "./event-subscriptions.js";
import { confirmTextHighlightAction } from "./confirm-dialog.js";
import { copyTextToClipboard } from "./clipboard-utils.js";
import { createTextHighlightToolButton } from "./tool-button-renderer.js";
import { createTextHighlightAnnotationCard } from "./card-renderer.js";
import {
  activateTextHighlightTool,
  deactivateTextHighlightTool,
  handleTextSelectionCompleted,
  handleColorSelected,
  handleColorSelectionCancelled,
} from "./interaction-flow.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

const HIGHLIGHT_COLOR_PRESETS = ["#ffeb3b", "#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0"];

/**
 * 文字高亮工具
 * @class TextHighlightTool
 * @implements {IAnnotationTool}
 */
export class TextHighlightTool extends IAnnotationTool {
  // ==================== 私有属性 ====================

  /** @type {EventBus} */
  #eventBus = null;

  /** @type {Logger} */
  #logger = null;

  /** @type {Object} */
  #pdfViewerManager = null;

  /** @type {Object|null} PDF.js EventBus */
  #pdfjsEventBus = null;

  /** @type {Object|null} 依赖容器 */
  #container = null;

  /** @type {TextSelectionHandler} */
  #selectionHandler = null;

  /** @type {HighlightRenderer} */
  #highlightRenderer = null;

  /** @type {FloatingColorToolbar} */
  #floatingToolbar = null;

  /** @type {HighlightActionMenu} */
  #actionMenu = null;

  /** @type {HighlightOverlayController|null} */
  #overlayController = null;

  /** @type {{ uninstall: Function }|null} */
  #subscriptions = null;
  /** @type {boolean} */
  #isActive = false;

  /** @type {Object|null} 当前选择数据（等待用户选择颜色） */
  #pendingSelection = null;

  /** @type {string} */
  // 默认颜色由外部注入或使用调用方提供；不再持有未用的私有字段

  /** @type {(message: string) => Promise<boolean>} */
  #confirmAction = null;

  // ==================== 元数据属性 ====================

  get name() {
    return "text-highlight";
  }

  get displayName() {
    return "选字";
  }

  get icon() {
    return "✏️";
  }

  get version() {
    return "1.0.0";
  }

  get dependencies() {
    return [];
  }

  // ==================== 生命周期方法 ====================

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @param {EventBus} context.eventBus - 事件总线
   * @param {Logger} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   * @param {Object} context.container - 依赖容器
   * @returns {Promise<void>}
   */
  async initialize(context) {
    const { eventBus, logger, pdfViewerManager, container } = context;

    this.#eventBus = eventBus;
    this.#logger = logger || console;
    this.#pdfViewerManager = pdfViewerManager;
    this.#container = container || null;
    try {
      this.#pdfjsEventBus = this.#pdfViewerManager?.eventBus || null;
    } catch {
      this.#pdfjsEventBus = null;
    }

    // 创建工具特定的对象
    this.#selectionHandler = new TextSelectionHandler(this.#eventBus, this.#logger);
    this.#highlightRenderer = new HighlightRenderer(this.#logger);

    // 创建浮动颜色工具栏
    this.#floatingToolbar = new FloatingColorToolbar({
      onColorSelected: this.#handleColorSelected.bind(this),
      onCancel: this.#handleColorSelectionCancelled.bind(this)
    });

    this.#actionMenu = new HighlightActionMenu({
      logger: this.#logger,
      colorPresets: HIGHLIGHT_COLOR_PRESETS,
      onDelete: this.#handleDeleteRequested.bind(this),
      onCopy: this.#handleCopyRequested.bind(this),
      onColorChange: this.#handleColorChangeRequested.bind(this),
      onJump: this.#handleJumpRequested.bind(this),
      onTranslate: this.#handleTranslateRequested.bind(this)
    });

    this.#confirmAction = (message) => confirmTextHighlightAction(message, { logger: this.#logger });

    this.#overlayController = new HighlightOverlayController({
      logger: this.#logger,
      pdfViewerManager: this.#pdfViewerManager,
      container: this.#container,
      highlightRenderer: this.#highlightRenderer,
      actionMenu: this.#actionMenu
    });

    this.#subscriptions = installTextHighlightSubscriptions({
      eventBus: this.#eventBus,
      pdfjsEventBus: this.#pdfjsEventBus,
      pdfViewerManager: this.#pdfViewerManager,
      logger: this.#logger,
      highlightRenderer: this.#highlightRenderer,
      overlayController: this.#overlayController,
      handlers: {
        onTextSelectionCompleted: this.#handleTextSelectionCompleted.bind(this),
        onAnnotationCreated: this.#handleAnnotationCreated.bind(this),
        onAnnotationUpdated: this.#handleAnnotationUpdated.bind(this),
        onAnnotationDeleted: this.#handleAnnotationDeleted.bind(this),
        onAnnotationDataLoaded: this.#handleAnnotationsLoaded.bind(this),
      }
    });

    this.#logger.info("[TextHighlightTool] Initialized successfully");
  }

  /**
   * 激活工具
   * @returns {void}
   */
  activate() {
    this.#isActive = activateTextHighlightTool({
      isActive: this.#isActive,
      selectionHandler: this.#selectionHandler,
      eventBus: this.#eventBus,
      logger: this.#logger,
      toolName: this.name,
    });
  }

  /**
   * 停用工具
   * @returns {void}
   */
  deactivate() {
    this.#isActive = deactivateTextHighlightTool({
      isActive: this.#isActive,
      selectionHandler: this.#selectionHandler,
      eventBus: this.#eventBus,
      logger: this.#logger,
      toolName: this.name,
    });
  }

  /**
   * 检查工具是否激活
   * @returns {boolean}
   */
  isActive() {
    return this.#isActive;
  }

  // ==================== 事件处理器 ====================

  /**
   * 处理文本选择完成事件
   * @param {Object} data - 选择数据
   * @param {string} data.text - 选中的文本
   * @param {number} data.pageNumber - 页码
   * @param {Array<{start: number, end: number}>} data.ranges - 文本范围
   * @param {Range} data.range - 浏览器Range对象
   * @param {Object} data.rect - 边界矩形（相对于页面容器）
   * @returns {void}
   * @private
   */
  #handleTextSelectionCompleted(data) {
    this.#pendingSelection = handleTextSelectionCompleted({
      isActive: this.#isActive,
      logger: this.#logger,
      floatingToolbar: this.#floatingToolbar,
      data,
    });
  }

  /**
   * 处理颜色选择
   * @param {string} color - 选中的颜色
   * @private
   */
  #handleColorSelected(color) {
    this.#pendingSelection = handleColorSelected({
      pendingSelection: this.#pendingSelection,
      color,
      eventBus: this.#eventBus,
      logger: this.#logger,
    });
  }

  /**
   * 处理颜色选择取消
   * @private
   */
  #handleColorSelectionCancelled() {
    this.#pendingSelection = handleColorSelectionCancelled({ logger: this.#logger });
  }

  /**
   * 处理标注创建成功事件
   * @param {Object} data - 事件数据
   * @param {Annotation} data.annotation - 标注对象
   * @returns {void}
   * @private
   */
  #handleAnnotationCreated(data) {
    const { annotation } = data;

    // 只处理文本高亮类型的标注
    if (annotation.type !== "text-highlight") {
      return;
    }

    this.#logger.info("[TextHighlightTool] Rendering highlight for annotation", annotation.id);

    this.#overlayController?.renderHighlightForAnnotation(annotation);
  }

  /**
   * 处理删除请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  async #handleDeleteRequested(annotation) {
    if (!annotation?.id) {
      return;
    }

    const shouldDelete = await this.#confirmAction("确定要删除这个高亮标注吗？");

    if (!shouldDelete) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Delete requested for annotation ${annotation.id}`);
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DELETE, { id: annotation.id });
  }

  /**
   * 处理复制请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleCopyRequested(annotation) {
    const latestAnnotation = annotation?.id ? this.#overlayController?.getLatestAnnotationById(annotation.id) : null;
    const text = latestAnnotation?.data?.selectedText ?? annotation?.data?.selectedText;
    copyTextToClipboard(text, { logger: this.#logger });
  }

  /**
   * 处理颜色变更请求
   * @param {Annotation} annotation - 标注对象
   * @param {string} color - 新颜色
   * @private
   */
  #handleColorChangeRequested(annotation, color) {
    if (!annotation?.id) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Color change requested: ${color} for ${annotation.id}`);

    this.#overlayController?.updateHighlightColor(annotation, color);

    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.UPDATE, {
      id: annotation.id,
      changes: {
        data: {
          highlightColor: color
        }
      }
    });
  }

  /**
   * 处理跳转请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleJumpRequested(annotation) {
    if (!annotation?.id) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Jump requested for annotation ${annotation.id}`);
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "annotation" });
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, { id: annotation.id });
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, { annotation });
  }

  /**
   * 处理翻译请求
   * @param {Annotation} annotation - 标注对象
   * @private
   */
  #handleTranslateRequested(annotation) {
    const latestAnnotation = annotation?.id ? this.#overlayController?.getLatestAnnotationById(annotation.id) : null;
    const text = latestAnnotation?.data?.selectedText ?? annotation?.data?.selectedText;
    if (!text) {
      this.#logger.warn("[TextHighlightTool] No text available for translation");
      return;
    }

    this.#logger.info(`[TextHighlightTool] Translate requested for annotation ${annotation.id}`);
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, { sidebarId: "translate" });
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.TRANSLATOR.TEXT.SELECTED, {
      text,
      pageNumber: annotation.pageNumber,
      annotationId: annotation.id,
      source: "text-highlight",
      timestamp: Date.now()
    });
  }

  /**
   * 处理标注更新事件
   * @param {{ annotation: Annotation }} data - 事件数据
   * @private
   */
  #handleAnnotationUpdated(data) {
    const annotation = data?.annotation;
    if (!annotation || annotation.type !== "text-highlight") {
      return;
    }
    this.#overlayController?.handleAnnotationUpdated(annotation);
  }

  /**
   * 处理标注删除事件
   * @param {{ id: string }} data - 事件数据
   * @private
   */
  #handleAnnotationDeleted(data) {
    const annotationId = data?.id;
    if (!annotationId) {
      return;
    }

    this.#logger.info(`[TextHighlightTool] Annotation deleted event received: ${annotationId}`);
    this.#overlayController?.handleAnnotationDeleted(annotationId, data?.pageNumber);
  }

  /**
   * 确保指定高亮注释的覆盖层已渲染
   * @param {Annotation} annotation
   */
  ensureOverlayFor(annotation) {
    this.#overlayController?.ensureOverlayFor(annotation);
  }

  /**
   * 处理标注列表加载完成事件
   * @param {{annotations?: Annotation[]}} data
   * @private
   */
  #handleAnnotationsLoaded(data) {
    try {
      this.#overlayController?.handleAnnotationsLoaded(data);
    } catch (e) {
      this.#logger?.warn?.("[TextHighlightTool] handleAnnotationsLoaded failed", e);
    }
  }

  // ==================== UI方法 ====================

  /**
   * 创建工具按钮
   * @returns {HTMLElement}
   */
  createToolButton() {
    return createTextHighlightToolButton({
      name: this.name,
      displayName: this.displayName,
      icon: this.icon,
      eventBus: this.#eventBus,
      isActive: () => this.#isActive,
      deactivate: this.deactivate.bind(this),
    });
  }

  /**
   * 创建标注卡片
   * @param {Annotation} annotation - 标注对象
   * @returns {HTMLElement}
   */
  createAnnotationCard(annotation) {
    return createTextHighlightAnnotationCard({
      annotation,
      eventBus: this.#eventBus,
      confirmAction: this.#confirmAction,
    });
  }

  // ==================== 清理方法 ====================

  /**
   * 销毁工具
   * @returns {void}
   */
  destroy() {
    if (this.#isActive) {
      this.deactivate();
    }

    const logger = this.#logger;
    try {
      this.#subscriptions?.uninstall?.();
    } catch (e) {
      logger?.warn?.("[TextHighlightTool] uninstall subscriptions failed", e);
    } finally {
      this.#subscriptions = null;
    }

    try {
      this.#overlayController?.clear?.();
    } catch (e) {
      logger?.debug?.("[TextHighlightTool] clear overlay controller failed", e);
    }

    try { this.#selectionHandler?.destroy?.(); } catch (e) { logger?.debug?.("[TextHighlightTool] selectionHandler destroy failed", e); }
    try { this.#highlightRenderer?.destroy?.(); } catch (e) { logger?.debug?.("[TextHighlightTool] highlightRenderer destroy failed", e); }
    try { this.#floatingToolbar?.destroy?.(); } catch (e) { logger?.debug?.("[TextHighlightTool] floatingToolbar destroy failed", e); }
    try { this.#actionMenu?.destroy?.(); } catch (e) { logger?.debug?.("[TextHighlightTool] actionMenu destroy failed", e); }

    this.#eventBus = null;
    this.#pdfjsEventBus = null;
    this.#logger = null;
    this.#pdfViewerManager = null;
    this.#container = null;
    this.#selectionHandler = null;
    this.#highlightRenderer = null;
    this.#floatingToolbar = null;
    this.#actionMenu = null;
    this.#overlayController = null;
    this.#confirmAction = null;
    this.#pendingSelection = null;

    logger?.info?.("[TextHighlightTool] Destroyed");
  }
}

export default TextHighlightTool;
