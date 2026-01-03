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
import { AnnotationManager } from "./core/annotation-manager.js";
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

  /** Feature名称 */
  get name() {
    // 规范化命名（事件作用域保持 SCOPE_ID = 'annotation' 不变）
    return "pdf-annotation";
  }

  /** 版本号 */
  get version() {
    return "2.0.0"; // v003模块化架构版本
  }

  /** 依赖的Features */
  get dependencies() {
    // 统一为规范名；事件作用域仍通过 SCOPE_ID = 'annotation' 保持稳定
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

    // Annotation 模块级日志过滤（可被 localStorage.ANNOTATION_LOG_LEVEL 覆盖）
    try {
      const lvStr = (typeof window !== "undefined" && window.localStorage)
        ? (window.localStorage.getItem("ANNOTATION_LOG_LEVEL") || "error").toLowerCase()
        : "error";
      const allowed = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
      const lv = allowed.includes(lvStr) ? lvStr : LogLevel.DEBUG;
      // 针对不同命名的模块名做覆盖，避免模块名不统一导致的观测缺失
      setModuleLogLevel("Feature.annotation", lv);
      setModuleLogLevel("Feature.pdf-annotation", lv);
      setModuleLogLevel("AnnotationFeature", lv);
      setModuleLogLevel("ScreenshotTool", lv);
      setModuleLogLevel("TextHighlightTool", lv);
      setModuleLogLevel("CommentTool", lv);
      this.#logger.info("[AnnotationFeature] Log level override for annotation modules", { level: lv });
    } catch (e) {
      // 忽略日志覆盖失败，不影响功能
      try { this.#logger.warn("[AnnotationFeature] Failed to override module log levels", { error: e?.message }); } catch { /* no-op */ }
    }

    if (!globalEventBus) {
      throw new Error(`[${this.name}] Global EventBus not found in context`);
    }

    this.#globalEventBus = globalEventBus;

    if (scopedEventBus) {
      this.#eventBus = scopedEventBus;
    } else {
      // 兜底：在未使用 FeatureRegistry 的场景下，仍按 SCOPE_ID 创建作用域事件总线
      const scope = (this.constructor?.SCOPE_ID || this.SCOPE_ID || this.name);
      this.#eventBus = createScopedEventBus(globalEventBus, scope);
      this.#ownsScopedEventBus = true;
    }

    this.#container = container;

    // 获取PDF查看器管理器（用于初始化工具）
    this.#pdfViewerManager = container?.get("pdfViewerManager");
    if (!this.#pdfViewerManager) {
      this.#logger.warn("[AnnotationFeature] PDFViewerManager not found, some tools may not work");
    }

    // 1. 创建工具注册表
    this.#toolRegistry = new ToolRegistry(this.#eventBus, this.#logger);
    this.#logger.debug("[AnnotationFeature] ToolRegistry created");

    // 2. 创建标注管理器
    this.#annotationManager = new AnnotationManager(this.#eventBus, this.#logger, this.#container);
    this.#logger.debug("[AnnotationFeature] AnnotationManager created");

    // 2.5. 从容器获取导航服务（由 core-navigation Feature 提供）
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
      container: mainContainer
    });
    this.#sidebarUI.initialize();
    this.#logger.debug("[AnnotationFeature] AnnotationSidebarUI initialized");

    // 4. 【关键修复】使用 registerGlobal() 注册服务到根容器
    // 这样其他 Feature 的 scoped container 也能访问这些服务
    if (container) {
      container.registerGlobal("annotationSidebarUI", this.#sidebarUI);
      container.registerGlobal("toolRegistry", this.#toolRegistry);
      container.registerGlobal("annotationManager", this.#annotationManager);
      this.#logger.debug("[AnnotationFeature] Services registered to global container");

      // 验证注册是否成功（降级为debug）
      const testGet = container.get("annotationSidebarUI");
      this.#logger.debug(`[AnnotationFeature] Verification: annotationSidebarUI retrievable = ${!!testGet}`);
    } else {
      this.#logger.error("[AnnotationFeature] Container is null! Cannot register services");
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
    this.#logger.debug("[AnnotationFeature] All tools initialized");

    // 7. 创建工具按钮UI
    this.#createToolButtons();

    // 8. 创建标注侧边栏切换按钮 (已由SidebarManager统一管理，此处不再创建)
    // this.#createAnnotationButton();

    // 9. 设置事件监听器
    this.#setupEventListeners();

    this.#logger.info(`[${this.name}] Installed successfully`);
    // 标记私有成员为已使用，避免 lint 对未使用私有成员报错（不影响行为）
    try { void this.#globalEventBus; void this.#createAnnotationButton; } catch (e) { void e; /* logger-guard */ }

    // 在 PDF 加载成功后自动加载该 PDF 的标注
    try {
      this.#setupAutoLoadOnFileLoad();
    } catch (e) {
      this.#logger.warn("[AnnotationFeature] setup auto-load failed", e);
    }

    // 注：兜底加载已由 FILE.LOAD.SUCCESS 事件处理器覆盖，无需重复实现
  }

  /**
   * 注册工具插件
   * @private
   */
  async #registerTools() {
    this.#logger.debug("[AnnotationFeature] Registering tools...");
    // Phase 1: 注册截图工具（出现错误不阻断后续工具）
    try {
      const { ScreenshotTool } = await import("./tools/screenshot/index.js");
      const screenshotTool = new ScreenshotTool();
      this.#toolRegistry.register(screenshotTool);
      this.#logger.debug("[AnnotationFeature] Screenshot tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register ScreenshotTool", e);
    }

    // Phase 2: 注册文字高亮工具（出错不中断）
    try {
      const { TextHighlightTool } = await import("./tools/text-highlight/index.js");
      this.#toolRegistry.register(new TextHighlightTool());
      this.#logger.debug("[AnnotationFeature] Text highlight tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register TextHighlightTool", e);
    }

    // Phase 3: 注册批注工具（出错不中断）
    try {
      const { CommentTool } = await import("./tools/comment/index.js");
      this.#toolRegistry.register(new CommentTool());
      this.#logger.debug("[AnnotationFeature] Comment tool registered");
    } catch (e) {
      this.#logger.error("[AnnotationFeature] Failed to register CommentTool", e);
    }

    // 汇总一次性信息（信息级别）
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

    this.#logger.info("[AnnotationFeature] Creating tool buttons...");

    // Phase 1: 工具按钮创建由各工具自己负责
    // ToolRegistry会在工具激活时创建按钮
    // 这里不需要额外操作

    this.#logger.info("[AnnotationFeature] Tool buttons will be created by tools");
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

    // 监听标注导航请求（来自 URL/WS 等全局来源，需监听全局总线）
    this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, (data) => {
      this.#handleNavigateToAnnotation(data);
    }, { subscriberId: "AnnotationFeature" });

    // 监听 URL 参数解析结果以设置 PDF ID（供 AnnotationManager 远端保存使用）
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, (data) => {
      try {
        if (!this.#annotationManager) {return;}
        const extracted = this.#extractPdfUUID({ pdfId: data?.pdfId, url: data?.url, filename: data?.filename });
        if (extracted) {
          this.#annotationManager.setPdfId(extracted);
          this.#logger.info(`[AnnotationFeature] PDF ID set from URL params: ${extracted}`);
        }
      } catch (e) {
        this.#logger.warn("[AnnotationFeature] Failed to set PDF ID from URL params", e);
      }
    }, { subscriberId: "AnnotationFeature" });

    // 标注数据加载成功标记
    try {
      this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, () => {
        this.#hasLoadedOnce = true;
      }, { subscriberId: "AnnotationFeature" });
    } catch (e) {
      void e; /* logger-guard */
    }
  }
  /** 标注自动加载：延迟到 resume:flow:done */
  #setupAutoLoadOnFileLoad() {
    setupAnnotationAutoLoadOnFileLoad({
      eventBus: this.#eventBus,
      logger: this.#logger,
      annotationManager: this.#annotationManager,
      ensureAllOverlays: () => this.#ensureAllOverlays(),
      getCurrentPdfId: () => this.#currentPdfId,
      setCurrentPdfId: (pdfId) => { this.#currentPdfId = pdfId; },
      getHasLoadedOnce: () => this.#hasLoadedOnce,
      setHasLoadedOnce: (v) => { this.#hasLoadedOnce = v; },
    });
  }

  /**
   * 确保所有已加载标注的覆盖层在页面上可见（用于侧边栏打开/数据加载后）
   * @private
   */
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

  /**
   * 从多种来源提取标准 pdf_uuid（12位十六进制）
   * @param {Object} src
   * @param {string} [src.pdfId]
   * @param {string} [src.filename]
   * @param {string} [src.url]
   * @returns {string|null}
   * @private
   */
  #extractPdfUUID(src = {}) {
    return extractPdfId12Hex(src);
  }

  /**
   * 处理标注导航请求
   * @param {Object} data - 导航数据
   * @param {Annotation|string} data.annotation - 标注对象或标注ID
   * @param {string} [data.id] - 标注ID（备用）
   * @private
   */
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

  /**
   * 高亮标注标记（视觉反馈）
   * @param {string} annotationId - 标注ID
   * @private
   */
  #highlightAnnotationMarker(annotationId) {
    // 发出标注选择事件，由CommentTool处理高亮
    this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SELECT, {
      id: annotationId
    }, { actorId: "AnnotationFeature" });

    this.#logger.debug(`[AnnotationFeature] Highlight marker requested for ${annotationId}`);
  }

  /**
   * 创建标注侧边栏切换按钮
   * @private
   */
  #createAnnotationButton() {
    this.#toggleButton = createAnnotationToggleButton({ eventBus: this.#eventBus, logger: this.#logger });
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

    if (this.#ownsScopedEventBus && typeof this.#eventBus?.destroy === "function") {
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
