/**
 * Annotation Feature（PDF 标注）
 * - 主文件保持为“装配/委托层”，大块逻辑按职责拆分为同目录模块
 * - 详细说明见：`docs/standards/pdf-annotation-feature.md`
 */

import { getLogger, setModuleLogLevel, LogLevel } from "../../../common/utils/logger.js";
import { createScopedEventBus } from "../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "./components/annotation-sidebar-ui.js";
import { ToolRegistry } from "./core/tool-registry.js";
import { AnnotationManager } from "./core/annotation.manager.v2.js"; // Use V2
import { extractPdfId12Hex } from "./utils/annotation-pdf-id-utils.js";
import { handleNavigateToAnnotation } from "./annotation-feature-navigate-to-annotation.js";
import { setupAnnotationAutoLoadOnFileLoad } from "./annotation-feature-autoload.js";
import { createAnnotationToggleButton } from "./annotation-feature-toggle-button.js";

/**
 * 标注功能Feature（容器模式）
 * @class AnnotationFeature
 * @implements {IFeature}
 */
export class AnnotationFeature {
  // 作用域固定为 "annotation"；后续即便重命名 Feature.name，事件前缀保持 @annotation/...
  static SCOPE_ID = "annotation";
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

  /** @type {string|null} 最近一次解析到的 pdfId */
  #currentPdfId = null;

  /** @type {boolean} 本次会话是否已成功加载过标注数据 */
  #hasLoadedOnce = false;

  /** @type {Array<() => void>} */
  #unsubs = [];

  /** Feature名称 */
  get name() {
    return "pdf-annotation";
  }

  /** 版本号 */
  get version() {
    return "2.0.0";
  }

  /** 依赖的Features */
  get dependencies() {
    return ["infra-app", "infra-ui", "infra-nav-core"];
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

    this.#logger = logger || getLogger("AnnotationFeature");
    this.#logger.info(`[${this.name}] Installing (v${this.version})...`);

    try {
      const lvStr = (typeof window !== "undefined" && window.localStorage)
        ? (window.localStorage.getItem("ANNOTATION_LOG_LEVEL") || "error").toLowerCase()
        : "error";
      const allowed = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
      const lv = allowed.includes(lvStr) ? lvStr : LogLevel.DEBUG;
      setModuleLogLevel("Feature.annotation", lv);
      setModuleLogLevel("Feature.pdf-annotation", lv);
      setModuleLogLevel("AnnotationFeature", lv);
      setModuleLogLevel("ScreenshotTool", lv);
      setModuleLogLevel("TextHighlightTool", lv);
      setModuleLogLevel("CommentTool", lv);
      this.#logger.info("[AnnotationFeature] Log level override for annotation modules", { level: lv });
    } catch (e) {
      try { this.#logger.warn("[AnnotationFeature] Failed to override module log levels", { error: e?.message }); } catch { /* no-op */ }
    }

    if (!globalEventBus) {
      throw new Error(`[${this.name}] Global EventBus not found in context`);
    }

    this.#globalEventBus = globalEventBus;

    if (scopedEventBus) {
      this.#eventBus = scopedEventBus;
    } else {
      const scope = (this.constructor?.SCOPE_ID || this.SCOPE_ID || this.name);
      this.#eventBus = createScopedEventBus(globalEventBus, scope);
      this.#ownsScopedEventBus = true;
    }

    this.#container = container;

    this.#pdfViewerManager = container?.get("pdfViewerManager");
    if (!this.#pdfViewerManager) {
      this.#logger.warn("[AnnotationFeature] PDFViewerManager not found, some tools may not work");
    }

    // 1. 创建工具注册表
    this.#toolRegistry = new ToolRegistry(this.#eventBus, this.#logger);
    this.#logger.debug("[AnnotationFeature] ToolRegistry created");

    // 2. 创建标注管理器 (V2)
    this.#annotationManager = new AnnotationManager(this.#eventBus, this.#logger, this.#container);
    this.#logger.debug("[AnnotationFeature] AnnotationManager created");

    // 2.5. 从容器获取导航服务
    this.#navigationService = container?.get("navigationService");
    if (!this.#navigationService) {
      this.#logger.warn("[AnnotationFeature] navigationService 未在容器中找到，标注跳转功能可能不可用");
    } else {
      this.#logger.debug("[AnnotationFeature] NavigationService obtained from container");
    }

    // 3. 创建侧边栏UI
    const mainContainer = document.querySelector("main");
    if (!mainContainer) {
      throw new Error(`[${this.name}] Main container not found`);
    }

    this.#sidebarUI = new AnnotationSidebarUI(this.#eventBus, {
      container: mainContainer,
      annotationManager: this.#annotationManager,
    });
    this.#sidebarUI.initialize();
    this.#logger.debug("[AnnotationFeature] AnnotationSidebarUI initialized");

    // 4. 注册服务到根容器
    if (container) {
      container.registerGlobal("annotationSidebarUI", this.#sidebarUI);
      container.registerGlobal("toolRegistry", this.#toolRegistry);
      container.registerGlobal("annotationManager", this.#annotationManager);
      this.#logger.debug("[AnnotationFeature] Services registered to global container");
    } else {
      this.#logger.error("[AnnotationFeature] Container is null! Cannot register services");
    }

    // 5. 注册工具插件
    await this.#registerTools();

    // 6. 初始化所有工具
    const toolContext = {
      eventBus: this.#eventBus,
      logger: this.#logger,
      pdfViewerManager: this.#pdfViewerManager,
      annotationManager: this.#annotationManager,
      container: this.#container
    };
    await this.#toolRegistry.initializeAll(toolContext);
    this.#logger.debug("[AnnotationFeature] All tools initialized");

    // 7. 创建工具按钮UI
    this.#createToolButtons();

    // 9. 设置事件监听器
    this.#setupEventListeners();

    this.#logger.info(`[${this.name}] Installed successfully`);
    try { void this.#globalEventBus; void this.#createAnnotationButton; } catch (e) { void e; /* logger-guard */ }

    // 在 PDF 加载成功后自动加载该 PDF 的标注
    try {
      this.#setupAutoLoadOnFileLoad();
    } catch (e) {
      this.#logger.warn("[AnnotationFeature] setup auto-load failed", e);
    }
  }

  /**
   * 注册工具插件
   * @private
   */
  async #registerTools() {
    this.#logger.debug("[AnnotationFeature] Registering tools...");
    try {
      const { ScreenshotTool } = await import("./tools/screenshot/index.js");
      const screenshotTool = new ScreenshotTool();
      this.#toolRegistry.register(screenshotTool);
      this.#logger.debug("[AnnotationFeature] Screenshot tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register ScreenshotTool", e);
    }

    try {
      const { TextHighlightTool } = await import("./tools/text-highlight/index.js");
      this.#toolRegistry.register(new TextHighlightTool());
      this.#logger.debug("[AnnotationFeature] Text highlight tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register TextHighlightTool", e);
    }

    try {
      const { CommentTool } = await import("./tools/comment/index.js");
      this.#toolRegistry.register(new CommentTool());
      this.#logger.debug("[AnnotationFeature] Comment tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register CommentTool", e);
    }

    this.#logger.info("[AnnotationFeature] Registered tools: screenshot, text-highlight, comment");
    this.#logger.info(`[AnnotationFeature] ${this.#toolRegistry.getCount()} tools registered`);
  }

  /**
   * 创建工具按钮UI
   * @private
   */
  #createToolButtons() {
    if (this.#toolRegistry.getCount() === 0) {
      this.#logger.warn("[AnnotationFeature] No tools to create buttons for");
      return;
    }
    this.#logger.info("[AnnotationFeature] Tool buttons will be created by tools");
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    const ensureManager = () => {
      if (!this.#annotationManager) {
        throw new Error("[AnnotationFeature] AnnotationManager not initialized");
      }
      return this.#annotationManager;
    };

    // Feature 内桥接：EventBus Command -> Manager Method（Manager 不订阅 EventBus）
    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.CREATE,
      (data) => ensureManager().createAnnotation(data?.annotation),
      { subscriberId: "AnnotationFeature.ManagerBridge.Create" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.UPDATE,
      (data) => ensureManager().updateAnnotation(data?.id, data?.changes),
      { subscriberId: "AnnotationFeature.ManagerBridge.Update" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DELETE,
      (data) => ensureManager().deleteAnnotation(data?.id),
      { subscriberId: "AnnotationFeature.ManagerBridge.Delete" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.COMMENT.ADD,
      (data) => ensureManager().addComment(String(data?.annotationId || ""), {
        content: data?.content,
        createdAt: data?.createdAt,
      }),
      { subscriberId: "AnnotationFeature.ManagerBridge.CommentAdd" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD,
      (data) => ensureManager().loadAnnotations(data?.pdfId),
      { subscriberId: "AnnotationFeature.ManagerBridge.Load" }
    ));

    this.#unsubs.push(this.#eventBus.onGlobal(
      PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
      (data) => { void this.#handleNavigateToAnnotation(data); },
      { subscriberId: "AnnotationFeature.Nav" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
      (data) => {
        const extracted = this.#extractPdfUUID({ pdfId: data?.pdfId, url: data?.url, filename: data?.filename });
        if (extracted) {
          ensureManager().setPdfId(extracted);
          this.#logger.info(`[AnnotationFeature] PDF ID set from URL params: ${extracted}`);
        }
      },
      { subscriberId: "AnnotationFeature.UrlParamsParsed" }
    ));

    this.#unsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED,
      () => { this.#hasLoadedOnce = true; },
      { subscriberId: "AnnotationFeature.LoadedFlag" }
    ));
  }

  #setupAutoLoadOnFileLoad() {
    const offs = setupAnnotationAutoLoadOnFileLoad({
      eventBus: this.#eventBus,
      logger: this.#logger,
      annotationManager: this.#annotationManager,
      ensureAllOverlays: () => this.#ensureAllOverlays(),
      getCurrentPdfId: () => this.#currentPdfId,
      setCurrentPdfId: (pdfId) => { this.#currentPdfId = pdfId; },
      getHasLoadedOnce: () => this.#hasLoadedOnce,
      setHasLoadedOnce: (v) => { this.#hasLoadedOnce = v; },
    });
    if (!Array.isArray(offs)) {
      throw new Error("[AnnotationFeature] setupAnnotationAutoLoadOnFileLoad must return unsubs[]");
    }
    for (const off of offs) {
      if (typeof off !== "function") {
        throw new Error("[AnnotationFeature] invalid unsubscribe returned from setupAnnotationAutoLoadOnFileLoad");
      }
      this.#unsubs.push(off);
    }
  }

  #ensureAllOverlays() {
    try {
      if (!this.#annotationManager || !this.#toolRegistry) {return;}
      const anns = this.#annotationManager.getAllAnnotations();
      if (!Array.isArray(anns) || anns.length === 0) {return;}
      const screenshotTool = this.#toolRegistry.get?.("screenshot");
      const highlightTool = this.#toolRegistry.get?.("text-highlight");
      const commentTool = this.#toolRegistry.get?.("comment");
      for (const ann of anns) {
        if (ann.type === "screenshot" && screenshotTool?.ensureOverlayFor) {
          screenshotTool.ensureOverlayFor(ann);
        } else if (ann.type === "text-highlight" && highlightTool?.ensureOverlayFor) {
          highlightTool.ensureOverlayFor(ann);
        } else if (ann.type === "comment" && commentTool?.ensureOverlayFor) {
          commentTool.ensureOverlayFor(ann);
        }
      }
    } catch (e) {
      this.#logger?.warn?.("[AnnotationFeature] ensureAllOverlays failed", e);
    }
  }

  #extractPdfUUID(src = {}) {
    return extractPdfId12Hex(src);
  }

  async #handleNavigateToAnnotation(data) {
    await handleNavigateToAnnotation({
      data,
      annotationManager: this.#annotationManager,
      eventBus: this.#eventBus,
      navigationService: this.#navigationService,
      logger: this.#logger,
      highlightAnnotationMarker: (annotationId) => this.#highlightAnnotationMarker(annotationId),
    });
  }

  #highlightAnnotationMarker(annotationId) {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, {
      id: annotationId
    }, { actorId: "AnnotationFeature" });

    this.#logger.debug(`[AnnotationFeature] Highlight marker requested for ${annotationId}`);
  }

  #createAnnotationButton() {
    this.#toggleButton = createAnnotationToggleButton({ eventBus: this.#eventBus, logger: this.#logger });
  }

  async uninstall() {
    this.#logger.info(`[${this.name}] Uninstalling...`);

    // 解绑所有事件订阅（即使 scopedEventBus 由外部注入，也必须显式清理）
    for (const fn of this.#unsubs.splice(0)) {
      try { fn?.(); } catch (e) { void e; /* logger-guard */ }
    }

    if (this.#toolRegistry) {
      this.#toolRegistry.destroyAll();
      this.#toolRegistry = null;
    }

    if (this.#annotationManager) {
      this.#annotationManager.clear();
      this.#annotationManager = null;
    }

    this.#navigationService = null;

    if (this.#sidebarUI) {
      this.#sidebarUI.destroy();
      this.#sidebarUI = null;
    }

    if (this.#toggleButton) {
      if (typeof this.#toggleButton.uninstall !== "function") {
        throw new Error("[AnnotationFeature] toggleButton.uninstall is required for symmetric cleanup");
      }
      this.#toggleButton.uninstall();
      this.#toggleButton.remove();
      this.#toggleButton = null;
    }

    if (this.#ownsScopedEventBus && typeof this.#eventBus?.destroy === "function") {
      this.#eventBus.destroy();
    }

    this.#eventBus = null;
    this.#globalEventBus = null;
    this.#ownsScopedEventBus = false;

    this.#logger.info(`[${this.name}] Uninstalled successfully`);
  }

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
