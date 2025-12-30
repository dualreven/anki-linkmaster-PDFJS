/**
 * PDF URL Loader Feature
 * @module PDFUrlLoaderFeature
 * @description URL参数导航功能，支持通过URL参数自动打开PDF并跳转到指定位置
 * @implements {IFeature}
 */

import { getLogger, setModuleLogLevel, LogLevel } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { URLParamsParser } from "./components/url-params-parser.js";
import { PDFUrlLoaderFeatureConfig } from "./feature.config.js";

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

  /** @type {Object|null} 解析出的URL参数 */
  #parsedParams = null;

  /** @type {boolean} 是否已处理URL参数 */
  #hasProcessedParams = false;

  // 已不依赖渲染就绪门闸

  /** @type {boolean} 导航进行中（用于抑制重复载荷二次触发） */
  #navInProgress = false;
  /** @type {string|null} 进行中载荷指纹 */
  #inflightNavKey = null;

  /** @type {{params: any, startTime: number}|null} 记录一次“因切换PDF而延迟执行”的手动导航请求（用于避免跳到第一页后丢失目标页） */
  #pendingManualNav = null;

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return PDFUrlLoaderFeatureConfig.name;
  }

  /**
   * Feature版本
   * @returns {string}
   */
  get version() {
    return PDFUrlLoaderFeatureConfig.version;
  }

  /**
   * Feature依赖
   * @returns {string[]}
   */
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

    // 开启 URL 跳转检查相关模块的日志（模块级）
    try {
      // 按需降低噪声：仅通过 ERROR 级别（用户期望“模块级日志过滤，仅错误开放”）
      setModuleLogLevel("PDFUrlLoaderFeature", LogLevel.ERROR);
      setModuleLogLevel("URLJumpDispatcher", LogLevel.ERROR);
      setModuleLogLevel("URLParamsParser", LogLevel.ERROR);
    } catch (e) { this.#logger.debug("[PDFUrlLoaderFeature] setModuleLogLevel failed", e); }

    // 1. 从context中获取依赖
    const container = context.container || context;  // 兼容旧版本直接传container的情况
    this.#eventBus = context.globalEventBus || null;
    if (!this.#eventBus) {
      try {
        this.#eventBus = container.get("eventBus");
      } catch {
        this.#eventBus = null;
      }
    }
    if (!this.#eventBus) {
      throw new Error("EventBus未在容器或context中找到");
    }

    // 2. 从容器获取导航服务（由 core-navigation Feature 提供）
    this.#navigationService = container.get("navigationService");
    if (!this.#navigationService) {
      throw new Error("[url-navigation] navigationService 未在容器中找到，请确保 core-navigation Feature 已安装");
    }

    // 3. 解析URL参数（仅解析与广播，跳转由 URLJumpDispatcher 执行）
    this.#parsedParams = URLParamsParser.parse();
    try {
      const dbg = {
        pdfId: this.#parsedParams?.pdfId ?? null,
        pageAt: this.#parsedParams?.pageAt ?? null,
        position: this.#parsedParams?.position ?? null,
        annotationId: this.#parsedParams?.annotationId ?? null,
        hasParams: !!this.#parsedParams?.hasParams
      };
      this.#logger.info("[url-navigation] 解析URL参数", dbg);
    } catch (e) { /* logger-guard */ void e; }

    // 4. 如果有URL参数，发出解析完成事件
    if (this.#parsedParams.hasParams) {
      this.#logger.info("检测到URL导航参数:", this.#parsedParams);

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
        this.#parsedParams,
        { actorId: "PDFUrlLoaderFeature" }
      );

      // URL 参数跳转已禁用，不再触发任何导航事件

      // 验证参数（解析与校验职责内聚于 Parser；跳转逻辑在 Dispatcher）
      const validation = URLParamsParser.validate(this.#parsedParams);
      if (!validation.isValid) {
        this.#logger.error("URL参数验证失败:", validation.errors);
        this.#emitNavigationFailed(
          new Error(validation.errors.join("; ")),
          "parse"
        );
        return;
      }

      // 立即触发加载：当仅携带 pdf-id 时，优先通过 WS 查询详情以获得真实文件名，再触发加载
      try {
        const pdfId = this.#parsedParams?.pdfId;
        if (pdfId && typeof pdfId === "string" && pdfId.trim().length > 0) {
          this.#logger.info("[url-navigation] 触发文件加载 (from url params)", { pdfId });

          let filenameForLoad = pdfId; // 回退：若无法获取详情则使用 pdfId（可能退化为以ID命名的文件）
          let filePath = null;
          try {
            const wsClient = context?.container?.get?.("wsClient") || context?.container?.getGlobal?.("wsClient");
            if (wsClient && typeof wsClient.sendPDFDetailRequest === "function") {
              const resp = await wsClient.sendPDFDetailRequest(String(pdfId), 4000, 1);
              const data = resp?.data || {};
              // 标准字段优先：filename / file_path；兼容 title/path
              const fname = (typeof data.filename === "string" && data.filename.trim()) ? data.filename.trim() : null;
              const title = (typeof data.title === "string" && data.title.trim()) ? data.title.trim() : null;
              filenameForLoad = fname || title || filenameForLoad;
              filePath = (typeof data.file_path === "string" && data.file_path.trim()) ? data.file_path.trim()
                : (typeof data.path === "string" && data.path.trim()) ? data.path.trim()
                  : null;
              this.#logger.info("[url-navigation] 详情查询成功，使用真实文件名加载", { filename: filenameForLoad, file_path: filePath });
            } else {
              this.#logger.warn("[url-navigation] wsClient 不可用或不支持 sendPDFDetailRequest，回退为使用 pdfId 作为文件名");
            }
          } catch (detailErr) {
            this.#logger.warn("[url-navigation] 获取文件详情失败，回退使用 pdfId 作为文件名继续加载", detailErr);
          }

          // 以 warn 级别输出一次“将要触发加载”的跟踪日志，便于生产观察来源
          try {
            this.#logger.info("[TRACE] Emitting FILE.LOAD.REQUESTED from PDFUrlLoaderFeature", { pdfId, filename: filenameForLoad, source: "url-params" });
          } catch (e) { void e; /* logger-guard */ }

          this.#eventBus.emit(
            PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
            { pdfId, filename: filenameForLoad, file_path: filePath, source: "pdf-url-loader" },
            { actorId: "PDFUrlLoaderFeature" }
          );
        }
      } catch (e) {
        this.#logger.warn("[url-navigation] 触发加载失败（忽略并继续门闸流程）", e);
      }

      if (validation.warnings.length > 0) {
        this.#logger.warn("URL参数警告:", validation.warnings);
      }
    } else {
      this.#logger.debug("未检测到URL导航参数，Feature待命");
    }

    // 5. 设置事件监听器（仅保留必要的事件监听）
    this.#setupEventListeners();

    // URL 参数跳转功能已禁用，不再设置导航门闸
    this.#logger.info(`${this.name} Feature安装完成（URL 参数跳转已禁用）`);
  }

  /**
   * 卸载Feature
   * @returns {Promise<void>}
   */
  async uninstall() {
    this.#logger.info(`卸载 ${this.name} Feature...`);

    // 注意：不需要销毁 navigationService，它由 core-navigation Feature 管理
    this.#navigationService = null;
    this.#eventBus = null;
    this.#parsedParams = null;
    this.#hasProcessedParams = false;

    this.#logger.info(`${this.name} Feature已卸载`);
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 监听PDF加载成功事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      this.#handlePDFLoadSuccess.bind(this),
      { subscriberId: "PDFUrlLoaderFeature" }
    );

    // 监听PDF加载失败事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      this.#handlePDFLoadFailed.bind(this),
      { subscriberId: "PDFUrlLoaderFeature" }
    );

    // 监听手动触发的URL参数导航请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      this.#handleNavigationRequested.bind(this),
      { subscriberId: "PDFUrlLoaderFeature" }
    );
  }

  /**
   * 处理PDF加载成功事件
   * @param {Object} data - 事件数据
   * @private
   */
  async #handlePDFLoadSuccess() {
    // 优先处理手动挂起的导航（pdfId 切换后自动恢复），避免仅渲染到第1页
    if (this.#pendingManualNav) {
      try {
        const { params, startTime } = this.#pendingManualNav;
        this.#pendingManualNav = null;
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
      return;
    }

    // URL 参数跳转已禁用，不再执行门闸导航
    this.#logger.info("[url-navigation] 文件加载成功（URL 参数跳转已禁用）");
  }

  /**
   * 处理PDF加载失败事件
   * @param {Object} data - 事件数据
   * @private
   */
  #handlePDFLoadFailed(data) {
    if (this.#hasProcessedParams) {
      return;
    }

    this.#logger.error("PDF加载失败，取消导航:", data);
    this.#emitNavigationFailed(
      new Error(data.message || "PDF加载失败"),
      "load"
    );
    this.#hasProcessedParams = true;
  }

  /**
   * 处理手动触发的导航请求
   * @param {Object} params - 导航参数
   * @private
   */
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

    // 去重：若与进行中的载荷完全一致，则忽略（避免“正在进行中”错误与重复 toast）
    try {
      const key = JSON.stringify({
        pdfId: params.pdfId || null,
        anchorId: params.anchorId || null,
        annotationId: params.annotationId || null,
        outlineItemId: params.outlineItemId || null,
        pageAt: params.pageAt,
        position: (params.position ?? null)
      });
      if (this.#navInProgress && this.#inflightNavKey === key) {
        this.#logger.warn("[url-navigation] 忽略重复导航请求（相同载荷且正在进行中）", { key });
        return;
      }
      this.#inflightNavKey = key;
    } catch (e) {
      void e; /* logger-guard */
    }

    try {
      this.#navInProgress = true;
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
          this.#pendingManualNav = { params: { ...params }, startTime };
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
      this.#navInProgress = false;
      this.#inflightNavKey = null;
    }
  }

  /**
   * 发出导航成功事件
   * @param {Object} data - 成功数据
   * @private
   */
  #emitNavigationSuccess(data) {
    this.#logger.info(`URL导航成功: ${JSON.stringify(data)}`);

    this.#eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.SUCCESS,
      data,
      { actorId: "PDFUrlLoaderFeature" }
    );
  }

  /**
   * 发出导航失败事件
   * @param {Error} error - 错误对象
   * @param {string} stage - 失败阶段
   * @private
   */
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

