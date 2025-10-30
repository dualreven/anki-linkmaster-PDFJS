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

import { getLogger, setModuleLogLevel, LogLevel } from "../../../common/utils/logger.js";
import { createScopedEventBus } from "../../../common/event/scoped-event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { AnnotationSidebarUI } from "./components/annotation-sidebar-ui.js";
import { ToolRegistry } from "./core/tool-registry.js";
import { AnnotationManager } from "./core/annotation-manager.js";
import { getCenterPercentFromRect } from "./utils/position-utils.js";
import { URLParamsParser } from "../url-navigation/components/url-params-parser.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";

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

  /** @type {string|null} 最近一次解析到的 pdfId */
  #currentPdfId = null;

  /** @type {boolean} 本次会话是否已成功加载过标注数据 */
  #hasLoadedOnce = false;

  /** Feature名称 */
  get name() {
    return "annotation";
  }

  /** 版本号 */
  get version() {
    return "2.0.0"; // v003模块化架构版本
  }

  /** 依赖的Features */
  get dependencies() {
    return ["app-core", "ui-manager", "core-navigation"];
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
      this.#eventBus = createScopedEventBus(globalEventBus, this.name);
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
    try { void this.#globalEventBus; void this.#createAnnotationButton; } catch (e) { void e; }

    // 在 PDF 加载成功后自动加载该 PDF 的标注
    try {
      this.#setupAutoLoadOnFileLoad();
    } catch (e) {
      this.#logger.warn("[AnnotationFeature] setup auto-load failed", e);
    }

    // 安装后兜底：延迟尝试一次从 URL 解析 pdfId 并加载（防止某些环境下 FILE.LOAD.SUCCESS 提前/丢失）
    setTimeout(() => {
      try {
        if (!this.#currentPdfId) {
          const parsed = URLParamsParser.parse();
          const pdfId = parsed?.pdfId || null;
          if (pdfId) {
            this.#logger.info(`[AnnotationFeature] 兜底加载标注（install延迟，pdfId=${pdfId}）`);
            this.#currentPdfId = pdfId;
            this.#hasLoadedOnce = false;
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId }, { actorId: "AnnotationFeature" });
          }
        }
      } catch (e) { void e; }
    }, 600);
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

    // 监听文件加载成功事件，兜底设置 PDF ID（从文件名推断，无扩展名）
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, (data) => {
      try {
        if (!this.#annotationManager) {return;}
        const extracted = this.#extractPdfUUID({ filename: data?.filename, url: data?.url });
        if (extracted) {
          this.#annotationManager.setPdfId(extracted);
          this.#logger.info(`[AnnotationFeature] PDF ID inferred from file info: ${extracted}`);
        } else {
          this.#logger.warn("[AnnotationFeature] 未能从文件信息中解析出有效的 pdf_uuid (12位十六进制)");
        }
      } catch (e) {
        this.#logger.warn("[AnnotationFeature] Failed to set PDF ID from LOAD.SUCCESS", e);
      }
    }, { subscriberId: "AnnotationFeature" });

    // 标注数据加载成功标记
    try {
      this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, () => {
        this.#hasLoadedOnce = true;
      }, { subscriberId: "AnnotationFeature" });
    } catch (e) { void e; }
  }

  /**
   * 监听 PDF 加载成功事件，解析 pdf-id 并触发标注加载
   * @private
   */
  #setupAutoLoadOnFileLoad() {
    if (!this.#eventBus) {return;}
    this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, (data) => {
      try {
        // 优先从 URL 参数解析 pdf-id（与 url-navigation 一致）
        let pdfId = null;
        try {
          const parsed = URLParamsParser.parse();
          if (parsed && parsed.pdfId) {pdfId = parsed.pdfId;}
        } catch (e) { void e; }

        // 兼容：从事件数据中回退获取（pdf-manager 会透传 filename）
        if (!pdfId && data) {
          const extracted = this.#extractPdfUUID({ filename: data.filename, url: data.url });
          if (extracted) {pdfId = extracted;}
        }

        if (!pdfId) {
          this.#logger.warn("[AnnotationFeature] 无法解析 pdfId，跳过自动加载");
          return;
        }

        // 记录当前 pdfId，供 WS 建立后重试加载
        this.#currentPdfId = pdfId;
        this.#hasLoadedOnce = false;

        this.#logger.info(`[AnnotationFeature] 文件加载完成，自动加载标注（pdfId=${pdfId}）`);
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId }, { actorId: "AnnotationFeature" });
      } catch (err) {
        this.#logger.warn("[AnnotationFeature] 自动加载标注失败", err);
      }
    }, { subscriberId: "AnnotationFeature" });

    // 当 WS 建立后，若已记录 pdfId，重试一次加载，避免首次加载时 WS 尚未就绪
    this.#eventBus.onGlobal(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => {
      try {
        if (this.#currentPdfId) {
          this.#logger.info(`[AnnotationFeature] WS 已连接，重试加载标注（pdfId=${this.#currentPdfId}）`);
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: this.#currentPdfId }, { actorId: "AnnotationFeature" });
        }
      } catch (e) { void e; }
    }, { subscriberId: "AnnotationFeature" });

    // 当标注侧边栏被打开时：若已知 pdfId 且从未加载过，则主动加载一次；否则仅确保叠加层渲染
    this.#eventBus.onGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED, (data) => {
      try {
        if (data?.sidebarId === "annotation" && this.#currentPdfId) {
          if (!this.#hasLoadedOnce) {
            this.#logger.info(`[AnnotationFeature] 侧边栏打开，首次加载标注（pdfId=${this.#currentPdfId}）`);
            this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId: this.#currentPdfId }, { actorId: "AnnotationFeature" });
          } else {
            this.#logger.info("[AnnotationFeature] 侧边栏打开，已加载过标注，跳过二次加载");
          }
          // 确保当前页面上已有的标注覆盖层可见
          this.#ensureAllOverlays();
        }
      } catch (e) { void e; }
    }, { subscriberId: "AnnotationFeature" });
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
    try {
      const HEX12 = /([a-f0-9]{12})/i;
      const tryMatch = (value) => {
        if (!value || typeof value !== "string") {return null;}
        const m = value.match(HEX12);
        return m ? m[1].toLowerCase() : null;
      };
      // 优先：显式 pdfId
      const fromPdfId = tryMatch(src.pdfId);
      if (fromPdfId) {return fromPdfId;}
      // 其次：filename（剥离扩展名后匹配）
      const fromFilename = tryMatch(src.filename);
      if (fromFilename) {return fromFilename;}
      // 再次：URL 路径中匹配
      const fromUrl = tryMatch(src.url);
      if (fromUrl) {return fromUrl;}
      return null;
    } catch (e) { void e;
      return null;
    }
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
        if (typeof data.annotation === "object") {
          annotation = data.annotation;
        }
        // 如果传入的是ID字符串
        else if (typeof data.annotation === "string") {
          annotation = this.#annotationManager.getAnnotation(data.annotation);
        }
      } else if (data.id) {
        // 备用：使用id字段
        annotation = this.#annotationManager.getAnnotation(data.id);
      }

      if (!annotation) {
        this.#logger.warn("[AnnotationFeature] Annotation not found for navigation", data);
        try {
          const { error: toastError } = await import("../../../common/utils/thirdparty-toast.js");
          toastError("标注不存在或未加载，无法跳转");
        } catch (_) {}
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
          error: "not_found",
          id: data?.annotation || data?.id
        }, { actorId: "AnnotationFeature" });
        return;
      }

      // 计算应跳转的页码：优先DOM中已渲染的容器（更可靠，避免数据层页码异常时跳到错误页面）
      let pageNumber = annotation.pageNumber;
      try {
        if (annotation.type === "text-highlight" && annotation.id) {
          const el = document.querySelector(`.text-highlight-container[data-annotation-id="${annotation.id}"]`);
          const pageEl = el?.closest?.(".page");
          const numAttr = pageEl?.getAttribute?.("data-page-number");
          const pn = numAttr ? parseInt(numAttr, 10) : NaN;
          if (Number.isInteger(pn) && pn > 0) {
            pageNumber = pn;
            this.#logger.info(`[AnnotationFeature] Page resolved from DOM for ${annotation.id}: ${pageNumber}`);
          }
        }
      } catch (e) { void e; /* ignore DOM resolution errors */ }
      if (!pageNumber) {
        this.#logger.warn("[AnnotationFeature] Annotation has no page number", annotation);
        try {
          const { error: toastError } = await import("../../../common/utils/thirdparty-toast.js");
          toastError("标注缺少页码信息，无法跳转");
        } catch (_) {}
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_FAILED, {
          error: "missing_page_number",
          id: annotation?.id
        }, { actorId: "AnnotationFeature" });
        return;
      }

      this.#logger.info(`[AnnotationFeature] Navigating to annotation on page ${pageNumber}`, annotation.id);

      // 计算位置百分比（优先依据注释类型的数据特征）
      let position = null;
      // 截图：使用矩形中心百分比
      if (annotation.type === "screenshot" && annotation.data?.rectPercent) {
        const centerPercent = getCenterPercentFromRect(annotation.data.rectPercent);
        if (centerPercent !== null) {
          position = centerPercent;
          this.#logger.info(`[AnnotationFeature] Calculated position from rectPercent: ${centerPercent.toFixed(2)}%`);
        }
      }
      // 严格模式：截图不再基于 rect 或 boundingBox 回退换算位置
      // 文本高亮：优先使用 lineRects 的首段中心（百分比），更贴近真实位置
      if (position === null && annotation.type === "text-highlight" && Array.isArray(annotation.data?.lineRects) && annotation.data.lineRects.length > 0) {
        try {
          const r0 = annotation.data.lineRects[0];
          if (typeof r0?.yPercent === "number" && typeof r0?.heightPercent === "number") {
            const center = Number((r0.yPercent + (r0.heightPercent / 2)).toFixed(6));
            if (Number.isFinite(center)) {
              position = Math.max(0, Math.min(100, center));
              this.#logger.info(`[AnnotationFeature] Calculated position from lineRects: ${position.toFixed(2)}%`);
            }
          }
        } catch (e) { void e; /* ignore */ }
      }

      // 批注：优先使用百分比坐标
      if (position === null && annotation.type === "comment" && annotation.data && annotation.data.positionPercent) {
        const yp = Number(annotation.data.positionPercent.yPercent);
        if (Number.isFinite(yp)) {
          position = Math.max(0, Math.min(100, yp));
          this.#logger.info(`[AnnotationFeature] Using comment positionPercent: ${position.toFixed(2)}%`);
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
        const viewerContainer = document.getElementById("viewerContainer");
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

        const viewerContainer = document.getElementById("viewerContainer");
        if (viewerContainer) {
          const pageElement = viewerContainer.querySelector(`.page[data-page-number="${pageNumber}"]`);
          if (pageElement) {
            const pageHeight = pageElement.offsetHeight;
            // 兼容 top 或 y 字段；使用中心位置（top + height/2）提高感知
            const topPx = (typeof boundingBox.top === "number") ? boundingBox.top : (boundingBox.y || 0);
            const hPx = (typeof boundingBox.height === "number") ? boundingBox.height : 0;
            position = ((topPx + (hPx / 2)) / pageHeight) * 100;
            this.#logger.info(`[AnnotationFeature] Calculated position from boundingBox: ${position.toFixed(2)}%`);
          }
        }
      }

      // 统一改走 URL 导航 API，由 URLNavigationFeature 执行实际导航
      try {
        // 优先使用已解析的 pdfId，回退从文件信息/URL 中提取
        let pdfId = this.#currentPdfId;
        if (!pdfId) {
          pdfId = this.#extractPdfUUID({ filename: this.#container?.get?.("currentFilename"), url: window?.location?.href || "" }) || null;
        }
        const req = {
          pdfId: pdfId || undefined,
          pageAt: pageNumber,
          position: (position !== null && Number.isFinite(position)) ? position : null,
          annotationId: annotation?.id || undefined
        };
        // 重要：必须发到全局事件总线，URLNavigationFeature 在全局总线上监听
        this.#eventBus.emitGlobal(
          PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
          req,
          { actorId: "AnnotationFeature" }
        );
        try { this.#highlightAnnotationMarker?.(annotation?.id); } catch (e) { this.#logger?.warn?.("highlight marker failed", e); }
      } catch (emitErr) {
        this.#logger.warn("[AnnotationFeature] Failed to emit URL_PARAMS.REQUESTED for annotation jump", emitErr);
        throw emitErr;
      }

    } catch (error) {
      this.#logger.error("[AnnotationFeature] Error navigating to annotation:", error);
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
    }, { actorId: "AnnotationFeature" });

    this.#logger.debug(`[AnnotationFeature] Highlight marker requested for ${annotationId}`);
  }

  /**
   * 创建标注侧边栏切换按钮
   * @private
   */
  #createAnnotationButton() {
    // 查找按钮容器（由BookmarkSidebarUI创建）
    let buttonContainer = document.getElementById("pdf-viewer-button-container");

    if (!buttonContainer) {
      this.#logger.warn("Button container #pdf-viewer-button-container not found, cannot create annotation button");
      return;
    }

    // 检测容器是否在header中（通过检查是否有sidebar-buttons类或在header-right中）
    const inHeader = buttonContainer.classList.contains("sidebar-buttons") ||
                     buttonContainer.closest(".header-right") !== null;

    // 创建标注按钮
    const button = document.createElement("button");
    button.id = "annotation-toggle-btn";
    button.type = "button";
    button.textContent = "✎ 标注";
    button.title = "打开标注（Ctrl+Shift+A）";
    button.className = "btn"; // 使用统一的btn样式

    // 只有在非header模式才添加内联样式
    if (!inHeader) {
      button.style.cssText = [
        "padding:4px 8px",
        "border:1px solid #ddd",
        "border-radius:4px",
        "background:#fff",
        "cursor:pointer",
        "box-shadow:0 1px 2px rgba(0,0,0,0.06)",
        "font-size:13px",
        "white-space:nowrap"
      ].join(";");
    }

    // 点击事件
    button.addEventListener("click", () => {
      this.#logger.debug("Annotation button clicked");
      this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
    });

    // 键盘快捷键 Ctrl+Shift+A
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        this.#logger.debug("Annotation keyboard shortcut triggered");
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.TOGGLE, {});
      }
    });

    // 插入到书签按钮后面
    const bookmarkBtn = buttonContainer.querySelector("button");
    if (bookmarkBtn && bookmarkBtn.nextSibling) {
      buttonContainer.insertBefore(button, bookmarkBtn.nextSibling);
    } else {
      buttonContainer.appendChild(button);
    }

    this.#toggleButton = button;
    this.#logger.info("Annotation button created and inserted");

    // 监听侧边栏状态，更新按钮样式
    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.OPENED, () => {
      button.style.background = "#e3f2fd";
      button.style.borderColor = "#2196f3";
    }, { subscriberId: "AnnotationFeature" });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.SIDEBAR.CLOSED, () => {
      button.style.background = "#fff";
      button.style.borderColor = "#ddd";
    }, { subscriberId: "AnnotationFeature" });
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
