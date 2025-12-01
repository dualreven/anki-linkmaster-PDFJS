/**
 * @file PDF Resume Feature
 * @module PDFResumeFeature
 * @description 常驻"断点续读"能力：
 *              - 冷启动时从 json_data.resume 恢复阅读位置
 *              - 运行期持续追踪位置并节流更新到后端
 *
 * 重构版本：采用模块化设计，修复所有 Fail-Fast 违规
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { notifyDomainError } from "../../../common/utils/domain-error-notifier.js";

// 内部模块
import { loadResume, resolvePdfIdFromURL } from "./services/resume-loader.js";
import { applyResume } from "./services/resume-applier.js";
import { ResumeUpdater } from "./services/resume-updater.js";

// 共享模块
import { PositionTracker } from "../../shared/position-tracker.js";

/**
 * PDF Resume Feature - 断点续读功能
 */
export class PDFResumeFeature {
  #logger = getLogger("Feature.pdf-resume");

  /** @type {Object} */
  #eventBus = null;

  /** @type {Object} */
  #container = null;

  /** @type {Object} */
  #navigationService = null;

  /** @type {string|null} */
  #pdfId = null;

  /** @type {PositionTracker|null} */
  #positionTracker = null;

  /** @type {ResumeUpdater|null} */
  #resumeUpdater = null;

  /** @type {Function|null} */
  #beforeUnloadHandler = null;

  /** @type {Function|null} */
  #unsubscribeDiagnostic = null;

  /** @type {number|null} */
  #heartbeatTimer = null;

  /** @type {number|null} */
  #resumeLoadTimer = null;

  get name() { return "pdf-resume"; }
  get version() { return "2.0.0"; }
  get dependencies() {
    return ["infra-nav-core", "navigationService"];
  }

  /**
   * 安装 Feature
   * @param {Object} context - 上下文对象
   * @throws {Error} 当必要依赖缺失时抛出（Fail-Fast）
   */
  async install(context) {
    this.#container = context.container || context;

    // Fail-Fast: eventBus 是必须的
    this.#eventBus = context.globalEventBus || this.#container.get("eventBus");
    if (!this.#eventBus) {
      throw new Error("[pdf-resume] eventBus is required dependency");
    }

    // Fail-Fast: navigationService 是必须的
    this.#navigationService = this.#container.get("navigationService");
    if (!this.#navigationService) {
      throw new Error("[pdf-resume] navigationService is required dependency");
    }

    // 初始获取 pdf-id
    this.#pdfId = resolvePdfIdFromURL();
    if (!this.#pdfId) {
      throw new Error("[pdf-resume] pdfId not found in URL (expected ?pdf-id=xxx)");
    }

    // 初始化 ResumeUpdater
    this.#resumeUpdater = new ResumeUpdater({
      eventBus: this.#eventBus,
      container: this.#container,
      pdfId: this.#pdfId
    });

    // 设置事件监听
    this.#setupListeners();

    // 设置位置追踪
    this.#setupPositionTracker();

    // beforeunload 保存暂时关闭，改用心跳机制同步到 DB
    this.#setupBeforeUnload();

    // 启动心跳同步
    this.#startHeartbeat();

    this.#logger.info("[pdf-resume] installed", { pdfId: this.#pdfId });
  }

  /**
   * 卸载 Feature
   */
  async uninstall() {
    // 清理位置追踪器
    if (this.#positionTracker) {
      this.#positionTracker.deactivate();
      this.#positionTracker = null;
    }

    // 停止心跳
    if (this.#heartbeatTimer !== null) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
      this.#logger.info("[pdf-resume] heartbeat sync stopped");
    }

    // 取消延迟的 resume 加载
    if (this.#resumeLoadTimer !== null) {
      clearTimeout(this.#resumeLoadTimer);
      this.#resumeLoadTimer = null;
      this.#logger.info("[pdf-resume] delayed resume load cancelled");
    }

    // 停止心跳
    if (this.#heartbeatTimer !== null) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
      this.#logger.info("[pdf-resume] heartbeat sync stopped");
    }

    // 清理 beforeunload 处理器
    if (this.#beforeUnloadHandler) {
      try {
        window.removeEventListener("beforeunload", this.#beforeUnloadHandler);
      } catch {
        // 环境可能没有 window
      }
      this.#beforeUnloadHandler = null;
    }

    // 清理诊断订阅
    if (this.#unsubscribeDiagnostic) {
      try {
        this.#unsubscribeDiagnostic();
      } catch {
        // ignore
      }
      this.#unsubscribeDiagnostic = null;
    }

    this.#eventBus = null;
    this.#container = null;
    this.#navigationService = null;
    this.#resumeUpdater = null;

    this.#logger.info("[pdf-resume] uninstalled");
  }

  /**
   * 设置事件监听器
   */
  #setupListeners() {
    // 文件加载成功：作为兜底信号，防止某些环境下缺失 RENDER.READY 事件
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {
      // 作为fallback，在文件加载成功后按短延迟调度一次恢复
      this.#scheduleResumeLoad(500, "file-load-success-fallback");
    }, { subscriberId: "PDFResumeFeature" });

    // 渲染就绪事件：UI 已完成基础渲染（至少首页已渲染），此时执行恢复导航更安全
    if (PDF_VIEWER_EVENTS.RENDER?.READY) {
      this.#eventBus.on(PDF_VIEWER_EVENTS.RENDER.READY, () => {
        this.#scheduleResumeLoad(0, "render-ready");
      }, { subscriberId: "PDFResumeFeature" });
    }

    // 页面变更事件：仅用于日志 & 内部分析，不再直接写入 resume
    // 说明：为排查“滚动/跳转过程中多次写入导致的竞态问题”，
    // 这里暂时关闭 PAGE.CHANGING → ResumeUpdater.flush() 的实时写入通道，
    // 只依赖 PositionTracker + beforeunload 进行最终写入。
    this.#eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
      this.#logger.debug("[pdf-resume] PAGE.CHANGING", { pageNumber });

      // 调试阶段：不再在 PAGE.CHANGING 中更新 resume，避免与滚动追踪/关闭前 flush 产生写入竞态
    }, { subscriberId: "PDFResumeFeature" });

    // 缩放变更事件：仍然更新缩放信息，但不再在缩放时立即 flush，
    // 仅作为 beforeunload flush 的视图状态补充。
    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
      this.#logger.debug("[pdf-resume] ZOOM.CHANGING", { scale });

      // 检查冻结状态：恢复导航期间不应更新 resume
      if (this.#positionTracker?.isFrozen) {
        this.#logger.debug("[pdf-resume] ZOOM.CHANGING ignored (frozen)");
        return;
      }

      if (this.#resumeUpdater && Number.isFinite(scale)) {
        this.#resumeUpdater.setZoom(scale);
      }
    }, { subscriberId: "PDFResumeFeature" });

    // 诊断/观测：监听 WS 回包
    this.#unsubscribeDiagnostic = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (msg) => {
      const t = String(msg?.type || "");
      if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
        this.#logger.debug("[pdf-resume] info completed observed");
      } else if (t === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_COMPLETED) {
        this.#logger.debug("[pdf-resume] record-update completed");
      }
    }, { subscriberId: "PDFResumeFeature-diagnostic" });
  }

  /**
   * 设置位置追踪器
   */
  #setupPositionTracker() {
    this.#positionTracker = new PositionTracker({
      debounceMs: 200,
      onPositionChange: (pageAt, position) => {
        this.#logger.debug("[pdf-resume] position changed", { pageAt, position });
        // 为避免滚动过程中的多次写入，这里仅更新内存中的最新页码，
        // 实际持久化交给 beforeunload 阶段的 flushSync 统一处理。
        if (this.#resumeUpdater) {
          this.#resumeUpdater.setPage(pageAt);
        }
      }
    });

    // 激活追踪器需要 viewerContainer - 延迟到 DOM 准备好后
    this.#activateTrackerWhenReady();
  }

  /**
   * 等待 viewerContainer 准备好后激活追踪器
   */
  #activateTrackerWhenReady() {
    const container = document.getElementById("viewerContainer");
    if (container) {
      this.#positionTracker.activate(container);
      this.#logger.info("[pdf-resume] position tracker activated");
    } else {
      // 延迟重试
      this.#logger.warn("[pdf-resume] viewerContainer not ready, retrying...");
      setTimeout(() => {
        const retryContainer = document.getElementById("viewerContainer");
        if (retryContainer) {
          this.#positionTracker.activate(retryContainer);
          this.#logger.info("[pdf-resume] position tracker activated (retry)");
        } else {
          this.#logger.error("[pdf-resume] viewerContainer still not found after retry");
        }
      }, 500);
    }
  }

  /**
   * 设置 beforeunload 处理器
   */
  #setupBeforeUnload() {
    // 心跳模式下暂时不依赖 beforeunload 保存，以避免 Qt 关闭路径下的不确定性。
    this.#beforeUnloadHandler = null;
    this.#logger.info("[pdf-resume] beforeunload handler disabled (heartbeat mode)");
  }

  /**
   * 调度一次延迟的 resume 加载
   * @param {number} delayMs - 延迟毫秒数
   * @param {string} reason - 调度原因（用于日志）
   */
  #scheduleResumeLoad(delayMs, reason) {
    if (!Number.isInteger(delayMs) || delayMs < 0) {
      throw new Error(`[pdf-resume] invalid delayMs for scheduleResumeLoad: ${delayMs}`);
    }

    // 若已有尚未触发的定时器，先取消
    if (this.#resumeLoadTimer !== null) {
      clearTimeout(this.#resumeLoadTimer);
      this.#resumeLoadTimer = null;
    }

    this.#logger.info("[pdf-resume] scheduling resume load", { delayMs, reason });

    this.#resumeLoadTimer = setTimeout(() => {
      this.#resumeLoadTimer = null;
      this.#handleFileLoaded();
    }, delayMs);
  }

  /**
   * 启动心跳同步：定期采样当前位置并写入 DB
   */
  #startHeartbeat() {
    if (!this.#resumeUpdater) {
      return;
    }
    if (this.#heartbeatTimer !== null) {
      clearInterval(this.#heartbeatTimer);
    }

    const intervalMs = 3000;
    this.#heartbeatTimer = setInterval(() => {
      this.#performHeartbeatSync();
    }, intervalMs);

    this.#logger.info("[pdf-resume] heartbeat sync started", { intervalMs });
  }

  /**
   * 心跳周期内执行一次同步
   */
  #performHeartbeatSync() {
    if (!this.#resumeUpdater) {
      return;
    }

    // 恢复导航冻结期间不应写入 resume
    if (this.#positionTracker?.isFrozen) {
      this.#logger.debug("[pdf-resume] heartbeat skipped (frozen)");
      return;
    }

    let pageNumber = null;

    // 优先使用 PositionTracker 的快照（视口中心页）
    const pos = this.#positionTracker?.snapshot?.();
    if (pos && Number.isInteger(pos.pageAt) && pos.pageAt > 0) {
      pageNumber = pos.pageAt;
    } else {
      // 回退到 pdfViewerManager.currentPageNumber
      try {
        const mgr = this.#container?.get?.("pdfViewerManager");
        const current = mgr?.currentPageNumber;
        if (Number.isInteger(current) && current > 0) {
          pageNumber = current;
        }
      } catch (e) {
        this.#logger.warn("[pdf-resume] heartbeat failed to read currentPageNumber", e);
      }
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      this.#logger.debug("[pdf-resume] heartbeat skipped (no valid page)");
      return;
    }

    this.#resumeUpdater.setPage(pageNumber);
    this.#resumeUpdater.flush();
    this.#logger.debug("[pdf-resume] heartbeat flushed resume", { page: pageNumber });
  }

  /**
   * 处理文件加载完成事件
   */
  async #handleFileLoaded() {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.REQUESTED, {}, { actorId: "PDFResumeFeature" });

    try {
      const result = await loadResume(this.#eventBus, this.#pdfId);

      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.LOADED, {
        pdfId: this.#pdfId,
        hasResume: !!result.resume
      }, { actorId: "PDFResumeFeature" });

      if (result.resume) {
        await this.#applyLoadedResume(result.resume);
      } else {
        this.#logger.info("[pdf-resume] no resume found, starting fresh");
      }

      // 不论是否存在 resume，整个“断点续读初始化流程”在此视为完成
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.RESUME.FLOW.DONE,
        {
          pdfId: this.#pdfId,
          hasResume: !!result.resume,
          status: "success"
        },
        { actorId: "PDFResumeFeature" }
      );
    } catch (e) {
      this.#logger.error("[pdf-resume] load failed", e);

      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.LOAD_FAILED, {
        pdfId: this.#pdfId,
        error: e.message
      }, { actorId: "PDFResumeFeature" });

      notifyDomainError({
        message: "加载阅读位置失败",
        logger: this.#logger,
        scope: "pdf-viewer-resume-load",
        error: e
      });

      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.RESUME.FLOW.DONE,
        {
          pdfId: this.#pdfId,
          hasResume: false,
          status: "failed",
          error: e.message
        },
        { actorId: "PDFResumeFeature" }
      );
    }
  }

  /**
   * 应用加载的 Resume
   * @param {Object} resume - 规范化后的 resume 对象
   */
  async #applyLoadedResume(resume) {
    this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.REQUESTED, { resume }, { actorId: "PDFResumeFeature" });

    try {
      // 获取 pdfViewerManager（可选依赖）
      const pdfViewerManager = this.#container.get("pdfViewerManager");

      // 冻结位置追踪器（导航后 3 秒内不回写）
      if (this.#positionTracker) {
        this.#positionTracker.freezeFor(3000);
      }

      // 应用 resume
      await applyResume(resume, this.#navigationService, pdfViewerManager);

      this.#logger.info("[pdf-resume] resume applied successfully", { page: resume.page });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.SUCCESS, { resume }, { actorId: "PDFResumeFeature" });
    } catch (e) {
      this.#logger.error("[pdf-resume] apply failed", e);

      notifyDomainError({
        message: "恢复阅读位置失败",
        logger: this.#logger,
        scope: "pdf-viewer-resume-apply",
        error: e
      });

      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.FAILED, {
        error: e.message
      }, { actorId: "PDFResumeFeature" });
    }
  }
}

export default PDFResumeFeature;
