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
import { AnnotationType } from "../../../../../common/models/annotation.js";
import { escapeHtml, formatDate, getImageUrl } from "./ui-utils.js";
import { showScreenshotPreviewDialog } from "./preview-dialog.js";
import { ScreenshotMarkerRenderer } from "./marker-renderer.js";
import { createScreenshotAnnotationCard } from "./card-renderer.js";
import { ScreenshotSelectionController } from "./selection-controller.js";
import { ScreenshotCaptureFlow } from "./capture-flow.js";
import { ScreenshotMarkerQueue } from "./marker-queue.js";
import { ScreenshotStoreReactiveMarkers } from "./store-reactive-markers.js";

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
  get dependencies() { return ["pdfViewerManager", "eventBus", "logger", "annotationManager"]; }

  // ===== 私有字段 =====
  #eventBus;
  #logger;
  #pdfViewerManager;
  #annotationManager;
  #pdfjsEventBus = null;
  #qwebChannelBridge;
  #capturer;
  #captureFlow = null;
  #isActive = false;
  #selectionController = null;
  #markerRenderer = null;
  #markerQueue = null;
  #storeReactiveMarkers = null;
  #storeUnsubscribe = null;
  #renderPageCompletedUnsub = null;
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
   * @param {Object} context.annotationManager - 标注管理器
   */
  async initialize(context) {
    this.#eventBus = context.eventBus;
    this.#logger = context.logger || getLogger("ScreenshotTool");
    this.#pdfViewerManager = context.pdfViewerManager;
    this.#annotationManager = context.annotationManager;
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

    this.#storeReactiveMarkers = new ScreenshotStoreReactiveMarkers({
      markerQueue: this.#markerQueue,
      ensureOverlayFor: (annotation) => this.ensureOverlayFor(annotation),
      removeMarker: (annotationId) => this.removeScreenshotMarker(annotationId),
      logger: this.#logger
    });

    // 订阅 AnnotationManager.store，响应式更新截图标记
    if (!this.#annotationManager?.store || typeof this.#annotationManager.store.subscribe !== "function") {
      this.#logger.error("[ScreenshotTool] AnnotationManager.store.subscribe not available");
      throw new Error("[ScreenshotTool] AnnotationManager.store is not correctly initialized.");
    }
    if (typeof this.#annotationManager.store.get !== "function") {
      this.#logger.error("[ScreenshotTool] AnnotationManager.store.get not available");
      throw new Error("[ScreenshotTool] AnnotationManager.store.get is required.");
    }

    this.#storeUnsubscribe = this.#annotationManager.store.subscribe(
      (state) => state?.annotations,
      (currentAnnotations) => {
        const currentScreenshots = (currentAnnotations || []).filter((a) => a?.type === AnnotationType.SCREENSHOT);
        this.#updateScreenshotMarkers(currentScreenshots);
      },
      { fireImmediately: true }
    );

    // 监听 PDF.js 页面渲染完成事件，刷写等待中的标记（解决“刷新后侧边栏打开时未出现截图框”）
    if (this.#pdfjsEventBus && typeof this.#pdfjsEventBus.on === "function") {
      this.#pdfjsPageRenderedHandler = (evt) => {
        try {
          const pn = evt?.pageNumber;
          if (!pn) {return;}
          try { this.#markerQueue?.clearPendingForPage?.(pn); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] clearPendingForPage failed", e); }
          // 缩放或页面重绘后，主动按页恢复已渲染的截图标记（与 CommentTool 行为对齐）
          this.#refreshScreenshotMarkersForPage(pn);
        } catch (e) {
          this.#logger?.warn?.("[ScreenshotTool] pagerendered handler failed", e);
        }
      };

      this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, this.#pdfjsPageRenderedHandler);

      // 缩放阶段：先清除可见标记，避免旧像素矩形残留
      this.#pdfjsScaleChangingHandler = () => {
        try { this.clearAllMarkers(); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] clearAllMarkers failed on scale changing", e); }
        try { this.#storeReactiveMarkers?.invalidateAll?.(); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] invalidateAll failed on scale changing", e); }
      };

      try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] register SCALE.CHANGING hook failed", e); }

      // 缩放完成：对当前页触发一次恢复，其它页依赖后续 pagerendered 回调
      this.#pdfjsScaleChangedHandler = () => {
        try {
          const pn = Number(this.#pdfViewerManager?.currentPageNumber || 0);
          if (pn) {
            this.#refreshScreenshotMarkersForPage(pn);
          }
        } catch (e) { this.#logger?.debug?.("[ScreenshotTool] scalechange restore failed", e); }
      };

      try { this.#pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] register SCALE.CHANGED hook failed", e); }
    }

    // 统一事件信号：监听应用级 RENDER.PAGE_COMPLETED（由 PDFViewerManager 桥接）
    try {
      const unsub = this.#eventBus.onGlobal(
        PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED,
        this.#handleRenderPageCompleted,
        { subscriberId: "ScreenshotTool" }
      );
      if (typeof unsub !== "function") {
        throw new Error("[ScreenshotTool] eventBus.onGlobal must return an unsubscribe function");
      }
      this.#renderPageCompletedUnsub = unsub;
    } catch (e) {
      this.#logger.error("[ScreenshotTool] Failed to subscribe RENDER.PAGE_COMPLETED", e);
      throw e;
    }

    this.#logStep("01", "Initialize begin", {
      qwebChannelMode: this.#qwebChannelBridge.getMode()
    }, "info", 1800);
    this.#logStep("01.1", "Store subscription for markers ready");
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
    if (this.#storeUnsubscribe) {
      this.#storeUnsubscribe();
      this.#storeUnsubscribe = null;
    }
    if (this.#renderPageCompletedUnsub) {
      this.#renderPageCompletedUnsub();
      this.#renderPageCompletedUnsub = null;
    }
    if (this.#pdfjsEventBus && this.#pdfjsPageRenderedHandler) {
      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, this.#pdfjsPageRenderedHandler); } catch (e) { void e; /* logger-guard */ }
    }
    this.#pdfjsPageRenderedHandler = null;
    if (this.#pdfjsEventBus && this.#pdfjsScaleChangingHandler) {
      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, this.#pdfjsScaleChangingHandler); } catch (e) { void e; /* logger-guard */ }
    }
    if (this.#pdfjsEventBus && this.#pdfjsScaleChangedHandler) {
      try { this.#pdfjsEventBus.off?.(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, this.#pdfjsScaleChangedHandler); } catch (e) { void e; /* logger-guard */ }
    }

    this.deactivate();
    this.clearAllMarkers();
    this.#markerQueue?.clear?.();
    this.#storeReactiveMarkers?.destroy?.();
    this.#storeReactiveMarkers = null;

    this.#capturer = null;
    this.#qwebChannelBridge = null;
    this.#captureFlow = null;
    this.#selectionController = null;
    this.#markerRenderer = null;
    this.#markerQueue = null;

    this.#logger.info("[ScreenshotTool] Destroyed");
  }

  /**
   * 根据 store 中的截图标注列表更新页面上的 marker
   * @param {Array<Annotation>} currentScreenshots - 当前的截图标注列表
   * @private
   */
  #updateScreenshotMarkers(currentScreenshots) {
    if (!this.#storeReactiveMarkers) {
      throw new Error("[ScreenshotTool] storeReactiveMarkers is not initialized");
    }
    this.#storeReactiveMarkers.apply(currentScreenshots);
  }

  /**
   * 刷新指定页上的所有截图标记（事件仅作为“刷新信号”，渲染仍由 storeReactiveMarkers 统一驱动）
   * @param {number} pageNumber
   * @private
   */
  #refreshScreenshotMarkersForPage(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      return;
    }

    const store = this.#annotationManager?.store || null;
    if (!store || typeof store.get !== "function") {
      throw new Error("[ScreenshotTool] AnnotationManager.store.get is required for refresh");
    }

    const allAnnotations = store.get()?.annotations || [];
    const screenshots = allAnnotations.filter((a) => a && a.type === AnnotationType.SCREENSHOT);

    try { this.#storeReactiveMarkers?.invalidatePage?.(pn); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] invalidatePage failed", e); }

    this.#logStep("04.rest", "Refreshing screenshot markers for page", {
      page: pn,
      total: screenshots.length
    });

    this.#updateScreenshotMarkers(screenshots);
  }

  // ===== 辅助方法 =====

  /**
   * 处理 RENDER.PAGE_COMPLETED 事件，用于刷新当前页的标记
   * @param {object} data
   * @private
   */
  #handleRenderPageCompleted = (data) => {
    const pn = Number(data?.pageNumber || 0);
    if (!pn) { return; }
    this.#logStep("04.bridge", "RENDER.PAGE_COMPLETED (app) received", { page: pn });
    try { this.#markerQueue?.clearPendingForPage?.(pn); } catch (e) { this.#logger?.debug?.("[ScreenshotTool] clearPendingForPage failed", e); }
    this.#refreshScreenshotMarkersForPage(pn);
  };

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
      if (!annotation || annotation.type !== AnnotationType.SCREENSHOT) {return;}
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
