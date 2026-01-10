/**
 * PDF URL Loader Feature
 * @module PDFUrlLoaderFeature
 * @description URL参数导航功能，支持通过URL参数自动打开PDF并跳转到指定位置
 * @implements {IFeature}
 */

import { getLogger, setModuleLogLevel, LogLevel } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { PDFUrlLoaderFeatureConfig } from "./feature.config.js";
import { NavigationRequestGate } from "./components/navigation-request-gate.js";
import { buildNavigationRequestKey } from "./components/nav-request-key.js";
import { URLParamsParser } from "./components/url-params-parser.js";
import {
  parseAndValidateUrlParams,
  resolveContainer,
  resolveDependencies,
} from "./components/install-helpers.js";

/**
 * URL导航功能Feature
 * @class PDFUrlLoaderFeature
 * @implements {IFeature}
 */
export class PDFUrlLoaderFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = getLogger("PDFUrlLoaderFeature");

  /** @type {EventBus|null} */
  #eventBus = null;

  /** @type {NavigationService|null} */
  #navigationService = null;

  /** @type {import('../../../common/micro-service/dependency-container.js').DependencyContainer|null} */
  #container = null;

  /** @type {Array<Function>} 已注册的 EventBus 清理函数 */
  #listenerCleanups = [];

  /** @type {boolean} 是否已处理URL参数 */
  #hasProcessedParams = false;

  // 已不依赖渲染就绪门闸

  #navGate = new NavigationRequestGate();

  get name() {
    return PDFUrlLoaderFeatureConfig.name;
  }

  get version() {
    return PDFUrlLoaderFeatureConfig.version;
  }

  get dependencies() {
    return PDFUrlLoaderFeatureConfig.dependencies;
  }

  /**
   * 安装Feature
   * @param {Object} context - Feature上下文对象
   * @param {import('../../../common/micro-service/dependency-container.js').DependencyContainer} context.container - 依赖容器
   * @param {Object} context.globalEventBus - 全局事件总线
   * @param {Object} context.scopedEventBus - 作用域事件总线
   * @param {Object} context.logger - 日志器
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#logger.info(`安装 ${this.name} Feature v${this.version}...`);
    this.#configureLogLevels();
    this.#container = resolveContainer(context);
    const { eventBus, navigationService } = resolveDependencies({ container: this.#container, context });
    this.#eventBus = eventBus;
    this.#navigationService = navigationService;

    const { parsedParams, validation } = parseAndValidateUrlParams();
    await this.#processUrlParams(parsedParams, validation);

    this.#setupEventListeners();
    this.#logger.info(`${this.name} Feature安装完成（URL 参数跳转已禁用）`);
  }

  #configureLogLevels() {
    try {
      setModuleLogLevel("PDFUrlLoaderFeature", LogLevel.ERROR);
      setModuleLogLevel("URLJumpDispatcher", LogLevel.ERROR);
      setModuleLogLevel("URLParamsParser", LogLevel.ERROR);
    } catch (error) {
      this.#logger.debug("[PDFUrlLoaderFeature] setModuleLogLevel failed", error);
    }
  }

  async #processUrlParams(parsedParams, validation) {
    if (!parsedParams?.hasParams) {
      this.#logger.debug("未检测到URL导航参数，Feature待命");
      return;
    }

    this.#logger.info("检测到URL导航参数:", parsedParams);
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
      parsedParams,
      { actorId: "PDFUrlLoaderFeature" }
    );

    if (!validation.isValid) {
      const error = new Error(validation.errors.join("; ") || "URL参数验证失败");
      this.#logger.error("URL参数验证失败:", validation.errors);
      this.#emitNavigationFailed(error, "validate");
      throw error;
    }

    try {
      await this.#maybeEmitFileLoad(parsedParams);
    } catch (error) {
      this.#logger.warn("[url-navigation] 触发加载失败（忽略并继续门闸流程）", error);
    }

    if (validation.warnings.length > 0) {
      this.#logger.warn("URL参数警告:", validation.warnings);
    }
  }

  async #maybeEmitFileLoad(parsedParams) {
    const pdfId = parsedParams?.pdfId;
    if (!pdfId || typeof pdfId !== "string" || pdfId.trim().length === 0) {
      return;
    }

    this.#logger.info("[url-navigation] 触发文件加载 (from url params)", { pdfId });
    let filenameForLoad = pdfId;
    let filePath = null;

    try {
      const wsData = await this.#fetchPdfDetails(pdfId);
      if (wsData) {
        const fname = (typeof wsData.filename === "string" && wsData.filename.trim()) ? wsData.filename.trim() : null;
        const title = (typeof wsData.title === "string" && wsData.title.trim()) ? wsData.title.trim() : null;
        filenameForLoad = fname || title || filenameForLoad;
        filePath = (typeof wsData.file_path === "string" && wsData.file_path.trim()) ? wsData.file_path.trim()
          : (typeof wsData.path === "string" && wsData.path.trim()) ? wsData.path.trim()
            : null;
        this.#logger.info("[url-navigation] 详情查询成功，使用真实文件名加载", { filename: filenameForLoad, file_path: filePath });
      } else {
        this.#logger.warn("[url-navigation] wsClient 不可用或不支持 sendPDFDetailRequest，回退为使用 pdfId 作为文件名");
      }
    } catch (detailErr) {
      this.#logger.warn("[url-navigation] 获取文件详情失败，回退使用 pdfId 作为文件名继续加载", detailErr);
    }

    try {
      this.#logger.info("[TRACE] Emitting FILE.LOAD.REQUESTED from PDFUrlLoaderFeature", { pdfId, filename: filenameForLoad, source: "url-params" });
    } catch (e) {
      void e;
    }

    this.#emitPdfLoadRequest({
      pdfId,
      filenameForLoad,
      filePath
    });
  }

  async #fetchPdfDetails(pdfId) {
    const wsClient = this.#resolveWsClient();
    if (!wsClient || typeof wsClient.sendPDFDetailRequest !== "function") {
      return null;
    }

    const response = await wsClient.sendPDFDetailRequest(String(pdfId), 4000, 1);
    return response?.data ?? null;
  }

  #resolveWsClient() {
    if (!this.#container) {
      return null;
    }

    const accessors = [];
    if (typeof this.#container.get === "function") {
      accessors.push(() => this.#container.get("wsClient"));
    }
    if (typeof this.#container.getGlobal === "function") {
      accessors.push(() => this.#container.getGlobal("wsClient"));
    }

    for (const accessor of accessors) {
      try {
        const candidate = accessor();
        if (candidate) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  #emitPdfLoadRequest({ pdfId, filenameForLoad, filePath }) {
    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      { pdfId, filename: filenameForLoad, file_path: filePath, source: "pdf-url-loader" },
      { actorId: "PDFUrlLoaderFeature" }
    );
  }

  async uninstall() {
    this.#logger.info(`卸载 ${this.name} Feature...`);

    // 注意：不需要销毁 navigationService，它由 core-navigation Feature 管理
    this.#clearListeners();
    this.#navigationService = null;
    this.#eventBus = null;
    this.#container = null;
    this.#hasProcessedParams = false;
    this.#navGate.reset();

    this.#logger.info(`${this.name} Feature已卸载`);
  }

  #setupEventListeners() {
    // 监听PDF加载成功事件
    this.#registerCleanup(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
        this.#handlePDFLoadSuccess.bind(this),
        { subscriberId: "PDFUrlLoaderFeature" }
      )
    );

    // 监听PDF加载失败事件
    this.#registerCleanup(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
        this.#handlePDFLoadFailed.bind(this),
        { subscriberId: "PDFUrlLoaderFeature" }
      )
    );

    // 监听手动触发的URL参数导航请求
    this.#registerCleanup(
      this.#eventBus.on(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
        this.#handleNavigationRequested.bind(this),
        { subscriberId: "PDFUrlLoaderFeature" }
      )
    );
  }

  #registerCleanup(cleanup) {
    if (typeof cleanup === "function") {
      this.#listenerCleanups.push(cleanup);
    }
  }

  #clearListeners() {
    this.#listenerCleanups.forEach(cleanup => {
      if (typeof cleanup === "function") {
        try {
          cleanup();
        } catch (error) {
          this.#logger.warn("[PDFUrlLoaderFeature] Listener cleanup failed", error);
        }
      }
    });
    this.#listenerCleanups = [];
  }

  async #handlePDFLoadSuccess() {
    // 优先处理手动挂起的导航（pdfId 切换后自动恢复），避免仅渲染到第1页
    const pending = this.#navGate.consumePendingManualNav();
    if (pending) {
      try {
        const { params, startTime } = pending;
        // 执行页内导航（此时已是目标文档）
        const result = await this.#navigationService.navigateTo({
          pageAt: params.pageAt,
          position: params.position,
        });
        if (result?.success) {
          this.#emitNavigationSuccess({
            pdfId: params.pdfId,
            pageAt: result.actualPage,
            position: result.actualPosition,
            duration: Math.round(performance.now() - (startTime || performance.now())),
          });
          this.#logger.info("[url-navigation] 恢复手动导航成功（在文件切换后）", { toast: { type: "success", ms: 2500 } });
        } else {
          this.#emitNavigationFailed(new Error(result?.error || "navigate failed"), "navigate");
        }
      } catch (e) {
        this.#logger.error("[url-navigation] 恢复手动导航失败：", e, { toast: { type: "error", ms: 5000 } });
      }
      // 手动挂起场景已处理，直接返回，不再走启动门闸
      this.#navGate.reset();
      return;
    }

    // URL 参数跳转已禁用，不再执行门闸导航
    this.#logger.info("[url-navigation] 文件加载成功（URL 参数跳转已禁用）");
  }

  #handlePDFLoadFailed(data) {
    if (this.#hasProcessedParams) {
      this.#navGate.reset();
      return;
    }

    this.#logger.error("PDF加载失败，取消导航:", data);
    this.#emitNavigationFailed(
      new Error(data.message || "PDF加载失败"),
      "load"
    );
    this.#hasProcessedParams = true;
    this.#navGate.reset();
  }

  async #handleNavigationRequested(params) {
    try {
      this.#logger.info(`[url-navigation] 收到手动导航请求: ${JSON.stringify(params)}`);
    } catch (e) {
      void e; /* logger-guard */
      this.#logger.info("收到手动导航请求:", params);
    }

    const validation = URLParamsParser.validate(params);
    if (!validation.isValid) {
      this.#logger.error("导航参数验证失败:", validation.errors);
      this.#emitNavigationFailed(
        new Error(validation.errors.join("; ")),
        "parse"
      );
      return;
    }

    // 不做任何 fallback：缺少 pageAt 直接失败
    if (params.pageAt === null || params.pageAt === undefined) {
      this.#logger.error("[url-navigation] 缺少 pageAt，拒绝导航（严格模式）");
      this.#emitNavigationFailed(new Error("missing pageAt"), "parse");
      return;
    }

    // 注：pageAt===1 是一个有效页码（第一页），不可拦截。仅缺少 pageAt 时由分发器拒绝执行。

    const startTime = performance.now();

    const navKey = buildNavigationRequestKey(params);
    const gate = this.#navGate.tryEnter(navKey);
    if (!gate.accepted) {
      if (gate.reason === "deduped") {
        this.#logger.warn("[url-navigation] 忽略重复导航请求（相同载荷且正在进行中）", { navKey });
        return;
      }
      this.#logger.warn("[url-navigation] 忽略导航请求（已有进行中的导航）", { navKey });
      return;
    }

    try {
      // 如果指定了 pdfId：仅当与当前已打开的文档不同才触发重新加载；
      // 否则视为“同文档内导航”，直接执行页面跳转，避免刷新到第1页。
      if (params.pdfId) {
        let currentId = null;
        try { currentId = new URLSearchParams(window.location.search).get("pdf-id"); } catch (e) { void e; /* logger-guard */ }
        const sameDoc = currentId && (String(currentId).trim() === String(params.pdfId).trim());
        if (!sameDoc) {
          this.#logger.info("[url-navigation] 检测到不同的 pdfId，触发重新加载", { currentId, target: params.pdfId });
          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
            { filename: params.pdfId, source: "pdf-url-loader" },
            { actorId: "PDFUrlLoaderFeature" }
          );
          // 记录本次手动请求，待 FILE.LOAD.SUCCESS 后恢复执行
          this.#navGate.setPendingManualNav({ params: { ...params }, startTime });
          return;
        } else {
          this.#logger.info("[url-navigation] 目标 pdfId 与当前一致，直接页内导航（不重载）");
        }
      }

      // 否则直接执行页面导航
      const result = await this.#navigationService.navigateTo({
        pageAt: params.pageAt,
        position: params.position,
      });

      if (result.success) {
        this.#emitNavigationSuccess({
          pdfId: params.pdfId,
          pageAt: result.actualPage,
          position: result.actualPosition,
          duration: Math.round(performance.now() - startTime),
        });
      } else {
        this.#emitNavigationFailed(
          new Error(result.error || "导航失败"),
          "navigate"
        );
      }
    } catch (error) {
      this.#logger.error("手动导航失败:", error);
      this.#emitNavigationFailed(error, "navigate");
    } finally {
      this.#navGate.reset();
    }
  }

  #emitNavigationSuccess(data) {
    this.#logger.info(`URL导航成功: ${JSON.stringify(data)}`);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
      data,
      { actorId: "PDFUrlLoaderFeature" }
    );
  }

  #emitNavigationFailed(error, stage) {
    this.#logger.error(`URL导航失败 (阶段: ${stage}):`, error);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.FAILED,
      {
        error,
        message: error.message,
        stage,
      },
      { actorId: "PDFUrlLoaderFeature" }
    );
  }
}

export default PDFUrlLoaderFeature;
