/**
 * 截图工具插件
 * @implements {IAnnotationTool}
 *
 * 功能:
 * - 允许用户框选PDF区域进行截图
 * - 通过QWebChannel保存图片到PyQt端
 * - 创建截图标注并添加到侧边栏
 */
import { IAnnotationTool } from "../../interfaces/IAnnotationTool.js";
import { ScreenshotCapturer } from "./screenshot-capturer.js";
import { QWebChannelScreenshotBridge } from "./qwebchannel-bridge.js";
import { getLogger } from "../../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";
import { escapeHtml, formatDate, getImageUrl } from "./ui-utils.js";
import { showScreenshotPreviewDialog } from "./preview-dialog.js";
import { ScreenshotMarkerRenderer } from "./marker-renderer.js";
import { createScreenshotAnnotationCard } from "./card-renderer.js";
import { ScreenshotSelectionController } from "./selection-controller.js";
import { ScreenshotCaptureFlow } from "./capture-flow.js";
import { installScreenshotAnnotationEventHandlers } from "./annotation-event-handlers.js";
import { ScreenshotMarkerQueue } from "./marker-queue.js";
import { createScreenshotAnnotationsLoadedHandler } from "./annotation-data-loaded-handler.js";

const MARKER_COLOR_PRESETS = [
  { name: "orange", label: "橙色", value: "#ff9800" },
  { name: "teal", label: "青色", value: "#26a69a" },
  { name: "blue", label: "蓝色", value: "#2196f3" },
  { name: "purple", label: "紫色", value: "#ab47bc" }
];

const DEFAULT_MARKER_COLOR = MARKER_COLOR_PRESETS[0].value;

export class ScreenshotTool extends IAnnotationTool {
  // ===== 元数据 (getter方法) =====
  get name() { return "screenshot"; }
  get displayName() { return "截图"; }
  get icon() { return "📷"; }
  get version() { return "1.0.0"; }
  get dependencies() { return ["pdfViewerManager", "eventBus", "logger"]; }

  // ===== 私有字段 =====
  #eventBus;
  #logger;
  #pdfViewerManager;
  #pdfjsEventBus = null;
  #container = null;
  #qwebChannelBridge;
  #capturer;
  #captureFlow = null;
  #isActive = false;
  #selectionController = null;
  #markerRenderer = null;
  #markerQueue = null;
  #annotationEventsUninstall = null;
  #onAnnotationDataLoadedHandler = null;
  #pdfjsPageRenderedHandler = null;
  #pdfjsScaleChangingHandler = null;
  #pdfjsScaleChangedHandler = null;

  /**
   * 内部：统一输出分步日志（含可选 toast）
   * @param {string} step - 步骤编号，如 'SM-01.1'
   * @param {string} message - 消息文本
   * @param {Object} [data] - 附加数据
   * @param {('info'|'warn'|'error'|'success'|'debug')|null} [toastType] - toast 类型（不传则仅console）
   * @param {number} [toastMs] - toast 时长毫秒
   */
  #logStep(step, message, data = undefined, toastType = null, toastMs = 5000) {
    const head = `[SM-${step}] ${message}`;
    const meta = data === undefined ? undefined : data;
    const toast = toastType ? { toast: { type: toastType, ms: toastMs } } : undefined;
    if (toast) {
      this.#logger.info(head, meta, toast);
    } else {
      this.#logger.info(head, meta);
    }
  }

  /**
   * 初始化工具
   * @param {Object} context - 上下文对象
   * @param {Object} context.eventBus - 事件总线
   * @param {Object} context.logger - 日志器
   * @param {Object} context.pdfViewerManager - PDF查看器管理器
   */
  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger || getLogger("ScreenshotTool");
    this.#pdfViewerManager = context.pdfViewerManager;
    this.#container = context.container || null;
    try {
      this.#pdfjsEventBus = this.#pdfViewerManager?.eventBus || null;
    } catch (e) { void e; /* logger-guard */ }

    // 初始化截图捕获器
    this.#capturer = new ScreenshotCapturer();

    // 初始化QWebChannel桥接器
    this.#qwebChannelBridge = new QWebChannelScreenshotBridge();

    // 截图流程（坐标转换 + capture + 预览 + 保存 + 事件派发）
    this.#captureFlow = new ScreenshotCaptureFlow({
      pdfViewerManager: this.#pdfViewerManager,
      capturer: this.#capturer,
      qwebChannelBridge: this.#qwebChannelBridge,
      eventBus: this.#eventBus,
      logger: this.#logger,
      defaultMarkerColor: DEFAULT_MARKER_COLOR,
      showPreviewDialog: showScreenshotPreviewDialog
    });

    // 框选/鼠标事件控制器
    this.#selectionController = new ScreenshotSelectionController({
      logger: this.#logger,
      onSelectionFinished: async (viewportRect) => this.#captureFlow.captureAndSave(viewportRect),
      onRequestDeactivate: () => this.deactivate()
    });

    // 标记框渲染器（从主类抽离，降低面条度）
    this.#markerRenderer = new ScreenshotMarkerRenderer({
      pdfViewerManager: this.#pdfViewerManager,
      eventBus: this.#eventBus,
      logger: this.#logger,
      logStep: this.#logStep.bind(this),
      markerColorPresets: MARKER_COLOR_PRESETS,
      defaultMarkerColor: DEFAULT_MARKER_COLOR,
      onJumpToAnnotation: (annotationId) => this.#handleJumpToAnnotation(annotationId)
    });

    // marker 队列（页面未就绪则入队，pagerendered/bridge 事件 flush）
    this.#markerQueue = new ScreenshotMarkerQueue({
      pdfViewerManager: this.#pdfViewerManager,
      logger: this.#logger,
      logStep: this.#logStep.bind(this),
      renderMarker: (annotation) => this.renderScreenshotMarker(annotation)
    });

    // 标注列表加载完成后恢复截图标记框
    this.#onAnnotationDataLoadedHandler = createScreenshotAnnotationsLoadedHandler({
      markerRenderer: this.#markerRenderer,
      markerQueue: this.#markerQueue,
      removeMarker: (annotationId) => this.removeScreenshotMarker(annotationId),
      logStep: this.#logStep.bind(this),
      logger: this.#logger
    });
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, this.#onAnnotationDataLoadedHandler);

    // 监听标注跳转/创建/删除事件（用于渲染/清理 marker）
    this.#annotationEventsUninstall = installScreenshotAnnotationEventHandlers({
      eventBus: this.#eventBus,
      logger: this.#logger,
      renderMarker: (annotation) => this.renderScreenshotMarker(annotation),
      removeMarker: (annotationId) => this.removeScreenshotMarker(annotationId)
    }).uninstall;

    // 监听 PDF.js 页面渲染完成事件，刷写等待中的标记（解决“刷新后侧边栏打开时未出现截图框”）
    if (this.#pdfjsEventBus && typeof this.#pdfjsEventBus.on === "function") {
      this.#pdfjsPageRenderedHandler = (evt) => {
        try {
          const pn = evt?.pageNumber;
          if (!pn) {return;}
          this.#markerQueue?.flushPendingForPage?.(pn);
          // 缩放或页面重绘后，主动按页恢复已渲染的截图标记（与 CommentTool 行为对齐）
          this.#restoreScreenshotMarkersForPage(pn);
        } catch (e) {
          this.#logger?.warn?.("[ScreenshotTool] flush pending on pagerendered failed", e);
        }
      };

      this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, this.#pdfjsPageRenderedHandler);

      // 缩放阶段：先清除可见标记，避免旧像素矩形残留
      this.#pdfjsScaleChangingHandler = () => {
        try { this.clearAllMarkers(); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] clearAllMarkers failed on scale changing", e); }
      };

      try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] register SCALE.CHANGING hook failed", e); }

      // 缩放完成：对当前页触发一次恢复，其它页依赖后续 pagerendered 回调
      this.#pdfjsScaleChangedHandler = () => {
        try {
          const pn = Number(this.#pdfViewerManager?.currentPageNumber || 0);
          if (pn) {
            this.#restoreScreenshotMarkersForPage(pn);
          }
        } catch (e) { this.#logger?.debug?.("[ScreenshotTool] scalechange restore failed", e); }
      };

      try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] register SCALE.CHANGED hook failed", e); }
    }

    // 统一事件信号：监听应用级 RENDER.PAGE_COMPLETED（由 PDFViewerManager 桥接）
    try {
      this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED, (data) => {
        const pn = Number(data?.pageNumber || 0);
        if (!pn) { return; }
        this.#logStep("04.bridge", "RENDER.PAGE_COMPLETED (app) received", { page: pn });
        this.#markerQueue?.flushPendingForPage?.(pn);
        this.#restoreScreenshotMarkersForPage(pn);
      }, { subscriberId: "ScreenshotTool" });
    } catch (e) { void e; /* logger-guard */ }

    this.#logStep("01", "Initialize begin", {
      qwebChannelMode: this.#qwebChannelBridge.getMode()
    }, "info", 1800);
    this.#logStep("01.1", "Event listeners ready: JUMP/CREATED/DELETED + DATA.LOADED");
    if (this.#pdfjsEventBus) {
      this.#logStep("01.2", "PDF.js pagerendered hook registered");
    } else {
      this.#logStep("01.2", "PDF.js EventBus not available (pagerendered not hooked)", null, "warn", 2500);
    }
    this.#logStep("01.done", "Initialize completed");
  }

  /**
   * 激活截图模式
   */
  activate() {
    if (this.#isActive) {
      this.#logger.warn("[ScreenshotTool] Already active");
      return;
    }

    this.#isActive = true;

    if (!this.#selectionController) {
      throw new Error("[ScreenshotTool] SelectionController not initialized");
    }

    // 1. 创建选择遮罩层 + 2. 设置鼠标事件
    this.#selectionController.activate();

    // 3. 改变鼠标样式
    document.body.style.cursor = "crosshair";

    // 4. 发布激活事件
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.ACTIVATED, {
      tool: this.name
    });

    this.#logger.info("[ScreenshotTool] Activated");
  }

  /**
   * 停用截图模式
   */
  deactivate() {
    if (!this.#isActive) {return;}

    this.#selectionController?.deactivate?.();
    this.#isActive = false;
    document.body.style.cursor = "default";

    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.TOOL.DEACTIVATED, {
      tool: this.name
    });

    this.#logger.info("[ScreenshotTool] Deactivated");
  }

  /**
   * 检查是否激活
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * 创建工具按钮
   */
  createToolButton() {
    const button = document.createElement("button");
    button.className = "annotation-tool-btn screenshot-tool-btn";
    button.dataset.tool = this.name;
    button.innerHTML = `${this.icon} ${this.displayName}`;
    button.title = `${this.displayName}工具`;

    button.style.cssText = [
      "padding: 8px 12px",
      "border: 1px solid #ddd",
      "border-radius: 4px",
      "background: white",
      "cursor: pointer",
      "font-size: 13px",
      "transition: all 0.2s"
    ].join(";");

    // 悬停效果
    button.addEventListener("mouseenter", () => {
      button.style.background = "#f5f5f5";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "white";
    });

    return button;
  }

  /**
   * 创建标注卡片
   */
  createAnnotationCard(annotation) {
    return createScreenshotAnnotationCard({
      annotation,
      icon: this.icon,
      displayName: this.displayName,
      getImageUrl,
      escapeHtml,
      formatDate,
      onJump: (annotationId) => this.#handleJumpToAnnotation(annotationId),
      onAddComment: (annotationId) => this.#handleAddComment(annotationId)
    });
  }

  /**
   * 销毁工具
   */
  destroy() {
    if (this.#eventBus && this.#onAnnotationDataLoadedHandler) {
      this.#eventBus.off?.(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, this.#onAnnotationDataLoadedHandler);
    }
    if (this.#pdfjsEventBus && this.#pdfjsPageRenderedHandler) {

      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, this.#pdfjsPageRenderedHandler); } catch (e) { void e; /* logger-guard */ }
    }
    this.#onAnnotationDataLoadedHandler = null;
    this.#pdfjsPageRenderedHandler = null;
    if (this.#pdfjsEventBus && this.#pdfjsScaleChangingHandler) {

      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler); } catch (e) { void e; /* logger-guard */ }
    }
    if (this.#pdfjsEventBus && this.#pdfjsScaleChangedHandler) {

      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler); } catch (e) { void e; /* logger-guard */ }
    }
    if (this.#annotationEventsUninstall) {
      try { this.#annotationEventsUninstall(); } catch (e) { void e; /* logger-guard */ }
    }
    this.deactivate();
    this.clearAllMarkers();
    this.#markerQueue?.clear?.();
    this.#capturer = null;
    this.#qwebChannelBridge = null;
    this.#captureFlow = null;
    this.#selectionController = null;
    this.#markerRenderer = null;
    this.#markerQueue = null;
    this.#annotationEventsUninstall = null;
    this.#logger.info("[ScreenshotTool] Destroyed");
  }

  /**
   * 恢复指定页上的所有截图标记（在 pagerendered 后调用）
   * @param {number} pageNumber
   * @private
   */
  #restoreScreenshotMarkersForPage(pageNumber) {
    try {
      const mgr = this.#container?.get ? this.#container.get("annotationManager") : null;
      if (!mgr) { return; }
      let items = [];
      if (typeof mgr.getAnnotationsByPage === "function") {
        items = mgr.getAnnotationsByPage(pageNumber) || [];
      } else if (typeof mgr.getAllAnnotations === "function") {
        items = (mgr.getAllAnnotations() || []).filter(a => a?.pageNumber === pageNumber);
      }
      const screenshots = items.filter(a => a && a.type === "screenshot");
      if (screenshots.length === 0) { return; }
      this.#logStep("04.rest", "Restoring screenshot markers for page", { page: pageNumber, count: screenshots.length });
      screenshots.forEach((ann) => {
        try {
          this.#logStep("04.rest.each", "Restore item", { id: ann.id, page: ann.pageNumber });
          this.renderScreenshotMarker(ann);
        } catch (e) { this.#logger?.debug?.("[ScreenshotTool] restore item failed", e); }
      });
    } catch (e) {
      this.#logger?.warn?.("[ScreenshotTool] restoreScreenshotMarkersForPage failed", e);
    }
  }

  // ===== 辅助方法 =====

  /**
   * 跳转到标注
   * @private
   */
  #handleJumpToAnnotation(annotationId) {
    this.#eventBus.emitGlobal(PDF_VIEWER_EVENTS.ANNOTATION.JUMP_TO, {
      id: annotationId,
      toolName: this.name  // 标识是截图工具的跳转请求
    });
  }

  /**
   * 添加评论
   * @private
   */
  #handleAddComment(annotationId) {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADD, { annotationId });
  }

  /**
   * 确保指定注释的截图标记框已渲染（用于侧边栏打开/数据加载后恢复）
   * @param {Annotation} annotation
   */
  ensureOverlayFor(annotation) {
    try {
      if (!annotation || annotation.type !== "screenshot") {return;}
      // 若页面未就绪则入队，由 pagerendered 时机再渲染
      this.#markerQueue?.enqueueOrRender?.(annotation);
    } catch (e) {
      this.#logger?.warn?.("[ScreenshotTool] ensureOverlayFor failed", e);
    }
  }

  /**
   * 渲染截图标记框（在PDF页面上显示截图区域）
   * @param {Object} annotation - 截图标注对象
   */
  renderScreenshotMarker(annotation) {
    this.#markerRenderer?.render?.(annotation);
  }

  /**
   * 移除截图标记框
   * @param {string} annotationId - 标注ID
   */
  removeScreenshotMarker(annotationId) {
    this.#markerRenderer?.remove?.(annotationId);
  }

  /**
   * 清除所有截图标记框
   */
  clearAllMarkers() {
    this.#markerRenderer?.clearAll?.();
  }
}
