/**
 * URL Navigation Feature
 * @module URLNavigationFeature
 * @description URL参数导航功能，支持通过URL参数自动打开PDF并跳转到指定位置
 * @implements {IFeature}
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { createScopedEventBus } from "../../../common/event/scoped-event-bus.js";
import { URLParamsParser } from "./components/url-params-parser.js";
import { URLNavigationFeatureConfig } from "./feature.config.js";
import { pending as toastPending, success as toastSuccess, error as toastError, info as toastInfo, dismissById as toastDismiss } from "../../../common/utils/thirdparty-toast.js";

/**
 * URL导航功能Feature
 * @class URLNavigationFeature
 * @implements {IFeature}
 */
export class URLNavigationFeature {
  /** @type {import('../../../common/utils/logger.js').Logger} */
  #logger = getLogger("URLNavigationFeature");

  /** @type {EventBus|null} */
  #eventBus = null;

  /** @type {NavigationService|null} */
  #navigationService = null;

  /** @type {Object|null} 解析出的URL参数 */
  #parsedParams = null;

  /** @type {boolean} 是否已处理URL参数 */
  #hasProcessedParams = false;

  // 已不依赖渲染就绪门闸

  /** @type {boolean} 标注数据是否已加载 */
  #annotationDataLoaded = false;

  /** @type {boolean} 是否已执行过受控导航（防止重复触发） */
  #gatedNavigationDone = false;

  /** @type {number|null} 导航开始时间戳 */
  #navigationStartTime = null;

  /**
   * Feature名称
   * @returns {string}
   */
  get name() {
    return URLNavigationFeatureConfig.name;
  }

  /**
   * Feature版本
   * @returns {string}
   */
  get version() {
    return URLNavigationFeatureConfig.version;
  }

  /**
   * Feature依赖
   * @returns {string[]}
   */
  get dependencies() {
    return URLNavigationFeatureConfig.dependencies;
  }

  /**
   * 安装Feature
   * @param {Object} context - Feature上下文对象
   * @param {import('../../container/simple-dependency-container.js').SimpleDependencyContainer} context.container - 依赖容器
   * @param {Object} context.globalEventBus - 全局事件总线
   * @param {Object} context.scopedEventBus - 作用域事件总线
   * @param {Object} context.logger - 日志器
   * @returns {Promise<void>}
   */
  async install(context) {
    this.#logger.info(`安装 ${this.name} Feature v${this.version}...`);

    // 1. 从context中获取依赖
    const container = context.container || context;  // 兼容旧版本直接传container的情况
    this.#eventBus = context.globalEventBus || container.get("eventBus");
    if (!this.#eventBus) {
      throw new Error("EventBus未在容器或context中找到");
    }

    // 2. 从容器获取导航服务（由 core-navigation Feature 提供）
    this.#navigationService = container.get("navigationService");
    if (!this.#navigationService) {
      throw new Error("[url-navigation] navigationService 未在容器中找到，请确保 core-navigation Feature 已安装");
    }

    // 3. 解析URL参数
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
      try {
        toastInfo(`URL导航参数: pdf=${dbg.pdfId || "(无)"} page=${dbg.pageAt ?? "-"} pos=${dbg.position ?? "-"} ann=${dbg.annotationId || "-"}`);
      } catch (e) { void e; }
    } catch (e) { void e; }

    // 4. 如果有URL参数，发出解析完成事件
    if (this.#parsedParams.hasParams) {
      this.#logger.info("检测到URL导航参数:", this.#parsedParams);

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
        this.#parsedParams,
        { actorId: "URLNavigationFeature" }
      );

      // 验证参数
      const validation = URLParamsParser.validate(this.#parsedParams);
      if (!validation.isValid) {
        this.#logger.error("URL参数验证失败:", validation.errors);
        this.#emitNavigationFailed(
          new Error(validation.errors.join("; ")),
          "parse"
        );
        return;
      }

      if (validation.warnings.length > 0) {
        this.#logger.warn("URL参数警告:", validation.warnings);
      }
    } else {
      this.#logger.debug("未检测到URL导航参数，Feature待命");
    }

    // 5. 设置事件监听器
    this.#setupEventListeners();

    // 6. 设置导航门闸：仅在“标注数据加载完成”后执行跳转
    //    - 标注数据加载完成：AnnotationManager 完成加载后通过全局事件发出 annotation-data:load:success

    // 监听标注“数据加载完成”的作用域事件（使用 annotation 作用域的 ScopedEventBus 订阅）
    const annotationBus = createScopedEventBus(this.#eventBus, "annotation");
    annotationBus.on(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED, (data) => {
      this.#logger.info("[url-navigation] 捕获标注数据加载完成事件");
      try {
        const c = (data && typeof data.count === "number") ? data.count : undefined;
        toastInfo(`标注数据加载完成${typeof c === "number" ? `（${c} 条）` : ""}`);
      } catch (e) { void e; }
      this.#annotationDataLoaded = true;
      this.#tryExecuteGatedNavigation();
    }, { subscriberId: "URLNavigationFeature" });

    // 已移除渲染就绪门闸，不再需要 pdf-reader 作用域监听

    // 注意：不在这里触发PDF加载，因为Bootstrap会根据launcher.py传递的file参数自动加载PDF
    // URLNavigationFeature只需要监听FILE.LOAD.SUCCESS事件，等PDF加载完成后再执行导航即可

    this.#logger.info(`${this.name} Feature安装完成`);
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
    this.#navigationStartTime = null;

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
      { subscriberId: "URLNavigationFeature" }
    );

    // 监听PDF加载失败事件
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      this.#handlePDFLoadFailed.bind(this),
      { subscriberId: "URLNavigationFeature" }
    );

    // 监听手动触发的URL参数导航请求
    this.#eventBus.on(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      this.#handleNavigationRequested.bind(this),
      { subscriberId: "URLNavigationFeature" }
    );
  }

  /**
   * 处理PDF加载成功事件
   * @param {Object} data - 事件数据
   * @private
   */
  async #handlePDFLoadSuccess() {
    // 文件加载成功后，不直接导航；等待“标注数据加载完成”
    if (this.#hasProcessedParams) { return; }
    this.#logger.info("[url-navigation] 文件加载成功，等待标注数据加载门闸");
    try { toastInfo("文件加载成功：等待标注数据…"); } catch (e) { void e; }
  }

  async #tryExecuteGatedNavigation() {
    if (this.#gatedNavigationDone) { return; }
    if (!this.#annotationDataLoaded) { return; }

    const { pageAt, position, annotationId } = this.#parsedParams || {};
    const hasNav = !(pageAt === null && position === null);
    const hasAnn = !!annotationId;

    // 若两种参数都存在，优先用注释跳转（更精确）；否则使用页面导航
    try {
      this.#logger.info("[url-navigation] 门闸检查", {
        hasAnn,
        hasNav,
        pageAt,
        position,
        annotationId
      });
      try {
        toastInfo(`门闸检查: ann=${hasAnn} nav=${hasNav}${hasNav ? ` page=${pageAt ?? "-"} pos=${position ?? "-"}` : ""}`);
      } catch (e) { void e; }
      if (hasAnn) {
        this.#logger.info("[url-navigation] 门闸通过，触发标注跳转: %s", annotationId);
        let rid = null;
        try { rid = `urlnav_jump_${Date.now()}`; toastPending(rid, `执行标注跳转: ${annotationId}`, 0); } catch (e) { void e; }
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
          { id: annotationId },
          { actorId: "URLNavigationFeature" }
        );
        // 标注跳转由其他 Feature 完成，这里仅提示开始，成功/失败由对方再吐司；若无对方提示，这里给出轻量提示
        try { if (rid) { toastDismiss(rid); toastSuccess("已触发标注跳转"); } } catch (e) { void e; }
      } else if (hasNav) {
        const totalPages = this.#navigationService.getTotalPages();
        const normalizedParams = URLParamsParser.normalize(
          { pageAt, position },
          { maxPages: totalPages }
        );
        let rid = null;
        try {
          rid = `urlnav_nav_${Date.now()}`;
          const posText = (normalizedParams.position ?? "-") + "%";
          toastPending(rid, `开始导航: 第${normalizedParams.pageAt || 1}页 ${((normalizedParams.position !== null && normalizedParams.position !== undefined) ? posText : "")}`.trim(), 0);
        } catch (e) { void e; }
        const result = await this.#navigationService.navigateTo({
          pageAt: normalizedParams.pageAt || 1,
          position: normalizedParams.position,
        });
        if (result.success) {
          const totalDuration = this.#navigationStartTime
            ? Math.round(performance.now() - this.#navigationStartTime)
            : result.duration;
          this.#emitNavigationSuccess({
            pdfId: this.#parsedParams.pdfId,
            pageAt: result.actualPage,
            position: result.actualPosition,
            duration: totalDuration,
          });
          try { if (rid) { toastDismiss(rid); toastSuccess(`导航完成: 第${result.actualPage}页${((result.actualPosition !== null && result.actualPosition !== undefined) ? ` ${result.actualPosition}%` : "")}（${totalDuration}ms）`); } } catch (e) { void e; }
        } else {
          this.#emitNavigationFailed(new Error(result.error || "导航失败"), "navigate");
          try { if (rid) { toastDismiss(rid); toastError(`导航失败: ${result.error || "未知错误"}`); } } catch (e) { void e; }
        }
      } else {
        this.#logger.info("[url-navigation] 门闸通过，但无 page-at/position/annotation-id 参数，跳过自动跳转");
        try { toastInfo("无跳转参数（仅 pdf-id），跳过自动跳转"); } catch (e) { void e; }
      }
    } catch (error) {
      this.#logger.error("[url-navigation] 门闸导航执行失败:", error);
      try { toastError(`[URL导航] 执行失败: ${error?.message || "未知错误"}`); } catch (e) { void e; }
    } finally {
      this.#gatedNavigationDone = true;
      this.#hasProcessedParams = true;
    }
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
    this.#logger.info("收到手动导航请求:", params);

    const validation = URLParamsParser.validate(params);
    if (!validation.isValid) {
      this.#logger.error("导航参数验证失败:", validation.errors);
      this.#emitNavigationFailed(
        new Error(validation.errors.join("; ")),
        "parse"
      );
      return;
    }

    const startTime = performance.now();

    try {
      // 如果指定了pdfId，先加载PDF
      if (params.pdfId) {
        this.#eventBus.emit(
          PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
          { filename: params.pdfId, source: "url-navigation" },
          { actorId: "URLNavigationFeature" }
        );

        // 等待PDF加载（通过事件监听器处理后续导航）
        return;
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
      { actorId: "URLNavigationFeature" }
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
      { actorId: "URLNavigationFeature" }
    );
  }
}

export default URLNavigationFeature;
