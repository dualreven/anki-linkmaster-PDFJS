/**
 * PDF Resume Feature
 * @module PDFResumeFeature
 * @description 常驻“断点续读”能力：拉取服务端 pdf_info.json_data.resume，按优先级在冷启动时应用；运行期按节流更新服务端。
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { notifyDomainError } from "../../../common/utils/domain-error-notifier.js";

export class PDFResumeFeature {
  #logger = getLogger("Feature.pdf-resume");
  #eventBus = null;
  #container = null;
  #navigationService = null;

  #pdfId = null;
  #latestPage = null;
  #latestZoom = null;

  get name() { return "pdf-resume"; }
  get version() { return "1.0.0"; }
  get dependencies() {
    return ["infra-nav-core", "navigationService"];
  }

  async install(context) {
    this.#container = context.container || context;
    this.#eventBus = context.globalEventBus || this.#container.get("eventBus");
    if (!this.#eventBus) { throw new Error("[pdf-resume] eventBus not found"); }
    this.#navigationService = this.#container.get("navigationService");
    if (!this.#navigationService) { this.#logger.warn("navigationService not found, will use URL_PARAMS route"); }

    this.#setupListeners();
    this.#attachUserInputListeners();
    // 初始获取 pdf-id（兜底从 URL）
    this.#pdfId = this.#pdfId || PDFResumeFeature.#resolvePdfIdFromURL();
    this.#logger.info("PDFResumeFeature installed");
  }

  async uninstall() {
    this.#stopPendingUpdate();
    this.#detachUserInputListeners();
    this.#eventBus = null;
    this.#container = null;
    this.#navigationService = null;
  }

  #setupListeners() {
    // 文件加载成功：拉取 resume
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {
      this.#safeLoadResume();
    }, { subscriberId: "PDFResumeFeature" });

    // 页面变更与缩放变更：安排节流更新
    this.#eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
      this.#logger.info("[resume] PAGE.CHANGING captured", { pageNumber });
      this.#latestPage = pageNumber;
      this.#scheduleUpdate();
    }, { subscriberId: "PDFResumeFeature" });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
      this.#logger.info("[resume] ZOOM.CHANGING captured", { scale });
      this.#latestZoom = Number.isFinite(scale) ? scale : this.#latestZoom;
      this.#scheduleUpdate();
    }, { subscriberId: "PDFResumeFeature" });

    // beforeunload 最后一跳
    try {
      window.addEventListener("beforeunload", () => {
        try { this.#flushUpdateNow(true); } catch { /* no-op */ }
      });
    } catch { /* env without window */ }

    // 监听 WS 回包（仅用于诊断/观测）
    this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (msg) => {
      const t = String(msg?.type || "");
      if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
        this.#logger.info("[resume] info completed observed");
      } else if (t === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_COMPLETED) {
        this.#logger.debug("[resume] record-update completed");
      }
    }, { subscriberId: "PDFResumeFeature-diagnostic" });
  }

  #uiDetachFns = [];
  #attachUserInputListeners() {
    try {
      const container = document?.getElementById?.("viewerContainer");
      if (!container) { this.#logger.warn("[resume] viewerContainer not found; skip UI listeners"); return; }

      const updateFromContainerCenter = () => {
        const pn = PDFResumeFeature.#detectCenterPageNumber(container);
        if (Number.isInteger(pn) && pn > 0) { this.#latestPage = pn; }
        this.#scheduleUpdate();
      };

      const onWheel = () => {
        updateFromContainerCenter();
      };
      const onClick = (evt) => {
        try {
          const pageEl = evt?.target?.closest?.(".page[data-page-number]");
          let pn = null;
          if (pageEl) {
            const v = Number(pageEl.getAttribute("data-page-number"));
            if (Number.isFinite(v) && v > 0) { pn = v; }
          }
          if (!pn) { pn = PDFResumeFeature.#detectCenterPageNumber(container); }
          if (Number.isInteger(pn) && pn > 0) { this.#latestPage = pn; }
        } catch { /* no-op */ }
        this.#scheduleUpdate();
      };
      const onScroll = () => {
        updateFromContainerCenter();
      };

      container.addEventListener("wheel", onWheel, { passive: true });
      container.addEventListener("click", onClick, { passive: true });
      container.addEventListener("scroll", onScroll, { passive: true });
      this.#uiDetachFns.push(() => container.removeEventListener("wheel", onWheel));
      this.#uiDetachFns.push(() => container.removeEventListener("click", onClick));
      this.#uiDetachFns.push(() => container.removeEventListener("scroll", onScroll));

      // 同时在 window 层监听滚轮（防止某些环境下事件只在更高层触发）
      const onGlobalWheel = () => {
        try {
          updateFromContainerCenter();
        } catch (e) {
          this.#logger.warn("[resume] global wheel handler failed", e);
        }
      };
      window.addEventListener("wheel", onGlobalWheel, { passive: true });
      this.#uiDetachFns.push(() => window.removeEventListener("wheel", onGlobalWheel));

      this.#logger.info("[resume] UI listeners attached (wheel/click/scroll/global-wheel)");
    } catch (e) {
      this.#logger.warn("[resume] attach UI listeners failed", e);
    }
  }

  #detachUserInputListeners() {
    try {
      this.#uiDetachFns.forEach(fn => { try { fn(); } catch { /* no-op */ } });
    } finally {
      this.#uiDetachFns = [];
    }
  }

  #safeLoadResume() {
    // 先发内部观测事件
    this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.REQUESTED, {}, { actorId: "PDFResumeFeature" });
    const pdfId = this.#pdfId || PDFResumeFeature.#resolvePdfIdFromURL();
    if (!pdfId) { this.#logger.warn("[resume] pdfId missing; skip load"); return; }
    // 拉取详情（不依赖 request_id 过滤，仅根据 pdfId 匹配首个 info:completed）
    const rid = PDFResumeFeature.#uuid();
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: rid,
      data: { pdf_id: pdfId },
      metadata: { version: "1.0.0" }
    }, { actorId: "PDFResumeFeature" });

    // 设置一次性监听：捕获首个针对当前 pdfId 的详情回包
    const off = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        if (!message) { return; }
        const t = String(message.type || message.received_type || "");
        if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
          const data = message.data || {};
          const mid = String(data.id || data.pdf_id || "");
          if (!mid || mid !== pdfId) { return; }
          this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.LOADED, { pdfId }, { actorId: "PDFResumeFeature" });
          const resume = data?.json_data?.resume || null;
          this.#maybeApplyResume(resume, pdfId);
          off?.();
        } else if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
          const data = message.data || {};
          const mid = String(data.id || data.pdf_id || "");
          if (!mid || mid !== pdfId) { return; }
          this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.LOAD_FAILED, { pdfId, error: message?.error }, { actorId: "PDFResumeFeature" });
          off?.();
        }
      } catch (e) {
        this.#logger.warn("[resume] process info response failed", e);
        off?.();
      }
    }, { subscriberId: `PDFResumeFeature-load-${rid}` });
  }

  #maybeApplyResume(resume, pdfId) {
    try {
      const parsed = PDFResumeFeature.#validateResume(resume);
      if (!parsed) { return; } // 无 resume，静默跳过
      // 发内部事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.REQUESTED, { resume: parsed }, { actorId: "PDFResumeFeature" });

      // 先恢复视图状态（缩放/布局/旋转），不依赖导航是否执行
      this.#applyViewStateFromResume(parsed);

      // 直接使用核心导航服务执行跳转（不再经由 URL 导航模块）；若服务不可用则仅恢复视图状态
      if (this.#navigationService) {
        const pos = typeof parsed.y_percent === "number" ? parsed.y_percent : null;
        this.#navigationService.navigateTo({ pageAt: parsed.page, position: pos })
          .catch((e) => {
            this.#logger.warn("[resume] navigation via NavigationService failed", e);
          });
      }

      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.SUCCESS, { resume: parsed }, { actorId: "PDFResumeFeature" });
    } catch (e) {
      this.#logger.error("[resume] apply failed", e);
      notifyDomainError({
        message: "恢复阅读位置失败",
        logger: this.#logger,
        scope: "pdf-viewer-resume-apply",
        error: e
      });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.FAILED, { error: String(e?.message || e) }, { actorId: "PDFResumeFeature" });
    }
  }

  #scheduleUpdate() {
    this.#logger.info("[resume] scheduleUpdate", {
      latestPage: this.#latestPage,
      latestZoom: this.#latestZoom
    });
    this.#flushUpdateNow(false);
  }

  #stopPendingUpdate() {
    // no-op: 不再使用节流计时器，保留方法以兼容卸载流程
  }

  #flushUpdateNow(sync = false) {
    const pdfId = this.#pdfId || PDFResumeFeature.#resolvePdfIdFromURL();
    if (!pdfId) {
      const err = new Error("[resume] pdfId missing when flushing resume");
      this.#logger.error(err.message);
      throw err;
    }
    let pageNumber = this.#latestPage;
    // 若尚未捕获最新页码，则尝试从 pdfViewerManager 读取当前页
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      try {
        const mgr = this.#container?.get?.("pdfViewerManager");
        const current = mgr?.currentPageNumber;
        if (Number.isInteger(current) && current > 0) {
          pageNumber = current;
        }
      } catch (e) {
        this.#logger.error("[resume] failed to read currentPageNumber from pdfViewerManager", e);
        throw e;
      }
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      const err = new Error(`[resume] invalid pageNumber when flushing resume: ${pageNumber}`);
      this.#logger.error(err.message);
      throw err;
    }
    const yPercent = PDFResumeFeature.#measureYPercent(pageNumber);
    const viewState = this.#captureViewState();

    const resume = {
      page: pageNumber,
      ...(Number.isFinite(yPercent) ? { y_percent: Math.max(0, Math.min(100, yPercent)) } : {}),
      ...(Number.isFinite(viewState.zoom) ? { zoom: viewState.zoom } : {}),
      ...(viewState.scrollMode !== null ? { scroll_mode: PDFResumeFeature.#scrollModeToString(viewState.scrollMode) } : {}),
      ...(viewState.spreadMode !== null ? { spread_mode: PDFResumeFeature.#spreadModeToString(viewState.spreadMode) } : {}),
      ...(viewState.rotation !== null ? { rotation: viewState.rotation } : {}),
      updated_at: Date.now()
    };
    this.#logger.info("[resume] flush resume payload", { pdfId, resume });
    this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.UPDATE.REQUESTED, { resume }, { actorId: "PDFResumeFeature" });
    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
      request_id: PDFResumeFeature.#uuid(),
      data: {
        file_id: pdfId,
        updates: {
          visited_at: resume.updated_at,
          json_data: { resume }
        }
      }
    };
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: "PDFResumeFeature" });
    if (sync) {
      // 同步场景仅发送一次；无需等待回包
      this.#logger.info("[resume] sent final sync update");
    }
  }

  static #resolvePdfIdFromURL() {
    try {
      return new URLSearchParams(window.location.search).get("pdf-id") || null;
    } catch {
      return null;
    }
  }

  static #validateResume(obj) {
    if (!obj || typeof obj !== "object") { return null; }
    const page = obj.page;
    if (!Number.isInteger(page) || page < 1) { return null; }
    const normalized = { page };

    const y = obj.y_percent;
    if (y !== undefined) {
      if (typeof y !== "number" || !Number.isFinite(y) || y < 0 || y > 100) {
        throw new Error(`invalid y_percent: ${y}`);
      }
      normalized.y_percent = y;
    }

    const zoom = obj.zoom;
    if (zoom !== undefined) {
      if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) {
        throw new Error(`invalid zoom: ${zoom}`);
      }
      normalized.zoom = zoom;
    }

    const rotation = obj.rotation;
    if (rotation !== undefined) {
      if (!Number.isInteger(rotation) || ![0, 90, 180, 270].includes(rotation)) {
        throw new Error(`invalid rotation: ${rotation}`);
      }
      normalized.rotation = rotation;
    }

    const scrollMode = obj.scroll_mode;
    if (scrollMode !== undefined) {
      if (typeof scrollMode !== "string") {
        throw new Error(`invalid scroll_mode: ${scrollMode}`);
      }
      // 会在应用阶段通过 #scrollModeFromString 进一步校验
      normalized.scroll_mode = scrollMode;
    }

    const spreadMode = obj.spread_mode;
    if (spreadMode !== undefined) {
      if (typeof spreadMode !== "string") {
        throw new Error(`invalid spread_mode: ${spreadMode}`);
      }
      normalized.spread_mode = spreadMode;
    }

    return normalized;
  }

  static #measureYPercent(pageNumber) {
    try {
      const container = document?.getElementById?.("viewerContainer");
      if (!container) { return null; }
      const pageEl = container.querySelector(`.page[data-page-number="${pageNumber}"]`);
      if (!pageEl) { return null; }
      const pageTop = pageEl.offsetTop;
      const pageHeight = pageEl.offsetHeight || 1;
      const centerY = container.scrollTop + (container.clientHeight / 2);
      const rel = centerY - pageTop;
      const pct = (rel / pageHeight) * 100;
      return Math.max(0, Math.min(100, pct));
    } catch {
      return null;
    }
  }

  static #detectCenterPageNumber(container) {
    try {
      const centerY = container.scrollTop + (container.clientHeight / 2);
      const pages = Array.from(container.querySelectorAll(".page[data-page-number]"));
      let best = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const el of pages) {
        const top = el.offsetTop || 0;
        const h = el.offsetHeight || 1;
        const mid = top + h / 2;
        const dist = Math.abs(mid - centerY);
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }
      if (!best) { return null; }
      const v = Number(best.getAttribute("data-page-number"));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  static #uuid() {
    return "rid_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  #captureViewState() {
    const state = {
      zoom: Number.isFinite(this.#latestZoom) ? this.#latestZoom : null,
      scrollMode: null,
      spreadMode: null,
      rotation: null
    };
    try {
      const c = this.#container;
      if (!c || typeof c.get !== "function") { return state; }
      let mgr = null;
      try {
        mgr = c.get("pdfViewerManager");
      } catch {
        mgr = null;
      }
      if (!mgr) { return state; }

      try {
        const z = mgr.currentScale;
        if (typeof z === "number" && Number.isFinite(z) && z > 0) {
          state.zoom = z;
        }
      } catch { /* ignore */ }

      try {
        const sm = mgr.scrollMode;
        if (Number.isInteger(sm)) {
          state.scrollMode = sm;
        }
      } catch { /* ignore */ }

      try {
        const sp = mgr.spreadMode;
        if (Number.isInteger(sp)) {
          state.spreadMode = sp;
        }
      } catch { /* ignore */ }

      try {
        const rot = mgr.pagesRotation;
        if (Number.isInteger(rot)) {
          state.rotation = rot;
        }
      } catch { /* ignore */ }
    } catch {
      // 保持 state 默认值
    }
    return state;
  }

  static #scrollModeToString(mode) {
    if (!Number.isInteger(mode)) {
      throw new Error(`invalid scrollMode value: ${mode}`);
    }
    switch (mode) {
    case 0:
      return "vertical";
    case 1:
      return "horizontal";
    case 2:
      return "wrapped";
    case 3:
      return "page";
    default:
      throw new Error(`unsupported scrollMode value: ${mode}`);
    }
  }

  static #spreadModeToString(mode) {
    if (!Number.isInteger(mode)) {
      throw new Error(`invalid spreadMode value: ${mode}`);
    }
    switch (mode) {
    case 0:
      return "none";
    case 1:
      return "odd";
    case 2:
      return "even";
    default:
      throw new Error(`unsupported spreadMode value: ${mode}`);
    }
  }

  static #scrollModeFromString(name) {
    const v = String(name || "").toLowerCase();
    switch (v) {
    case "vertical":
      return 0;
    case "horizontal":
      return 1;
    case "wrapped":
      return 2;
    case "page":
      return 3;
    default:
      throw new Error(`unsupported scroll_mode: ${name}`);
    }
  }

  static #spreadModeFromString(name) {
    const v = String(name || "").toLowerCase();
    switch (v) {
    case "none":
      return 0;
    case "odd":
      return 1;
    case "even":
      return 2;
    default:
      throw new Error(`unsupported spread_mode: ${name}`);
    }
  }

  #applyViewStateFromResume(resume) {
    const c = this.#container;
    if (!c || typeof c.get !== "function") { return; }
    let mgr = null;
    try {
      mgr = c.get("pdfViewerManager");
    } catch {
      mgr = null;
    }
    if (!mgr) { return; }

    // 缩放
    if (typeof resume.zoom === "number" && Number.isFinite(resume.zoom) && resume.zoom > 0) {
      try { mgr.currentScale = resume.zoom; } catch { /* ignore */ }
    }

    // 滚动模式
    if (typeof resume.scroll_mode === "string") {
      const scrollValue = PDFResumeFeature.#scrollModeFromString(resume.scroll_mode);
      mgr.scrollMode = scrollValue;
    }

    // 跨页模式
    if (typeof resume.spread_mode === "string") {
      const spreadValue = PDFResumeFeature.#spreadModeFromString(resume.spread_mode);
      mgr.spreadMode = spreadValue;
    }

    // 旋转
    if (typeof resume.rotation === "number" && Number.isInteger(resume.rotation)) {
      try { mgr.pagesRotation = resume.rotation; } catch { /* ignore */ }
    }
  }

}

export default PDFResumeFeature;
