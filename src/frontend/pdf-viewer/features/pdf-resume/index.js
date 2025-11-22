/**
 * PDF Resume Feature
 * @module PDFResumeFeature
 * @description 常驻“断点续读”能力：拉取服务端 pdf_info.json_data.resume，按优先级在冷启动时应用；运行期按节流更新服务端。
 */

import { getLogger } from "../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES, WEBSOCKET_MESSAGE_EVENTS } from "../../../common/event/event-constants.js";
import { showError } from "../../../common/utils/notification.js";

export class PDFResumeFeature {
  #logger = getLogger("Feature.pdf-resume");
  #eventBus = null;
  #container = null;
  #navigationService = null;

  #pdfId = null;
  #explicitJumpSeen = false;
  #throttleMs = 2500;
  #pendingUpdateTimer = null;
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
    // URL 参数解析：拿到 pdfId，并感知是否有显式跳转请求
    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED, (data) => {
      try {
        if (data && typeof data.pdfId === "string") {
          this.#pdfId = data.pdfId;
        }
      } catch { /* no-op */ }
    }, { subscriberId: "PDFResumeFeature" });

    this.#eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, () => {
      this.#explicitJumpSeen = true;
    }, { subscriberId: "PDFResumeFeature" });

    // 文件加载成功：拉取 resume
    this.#eventBus.on(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, () => {
      this.#safeLoadResume();
    }, { subscriberId: "PDFResumeFeature" });

    // 页面变更与缩放变更：安排节流更新
    this.#eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
      this.#latestPage = pageNumber;
      this.#scheduleUpdate();
    }, { subscriberId: "PDFResumeFeature" });

    this.#eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
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
      const onWheel = () => {
        const pn = PDFResumeFeature.#detectCenterPageNumber(container);
        if (Number.isInteger(pn) && pn > 0) { this.#latestPage = pn; }
        this.#scheduleUpdate();
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
      container.addEventListener("wheel", onWheel, { passive: true });
      container.addEventListener("click", onClick, { passive: true });
      this.#uiDetachFns.push(() => container.removeEventListener("wheel", onWheel));
      this.#uiDetachFns.push(() => container.removeEventListener("click", onClick));
      this.#logger.info("[resume] UI listeners attached (wheel/click)");
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
    // 拉取详情
    const rid = PDFResumeFeature.#uuid();
    this.#eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
      request_id: rid,
      data: { pdf_id: pdfId },
      metadata: { version: "1.0.0" }
    }, { actorId: "PDFResumeFeature" });

    // 设置一次性监听：消费该 request 的 completed/failed
    const off = this.#eventBus.on(WEBSOCKET_MESSAGE_EVENTS.RESPONSE, (message) => {
      try {
        if (!message || message.request_id !== rid) { return; }
        const t = String(message.type || "");
        if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
          this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.LOAD.LOADED, { pdfId }, { actorId: "PDFResumeFeature" });
          const resume = message?.data?.json_data?.resume || null;
          this.#maybeApplyResume(resume, pdfId);
          off?.();
        } else if (t === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
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
      if (this.#explicitJumpSeen) {
        this.#logger.info("[resume] explicit jump detected; skip applying resume");
        return;
      }
      const parsed = PDFResumeFeature.#validateResume(resume);
      if (!parsed) { return; } // 无 resume，静默跳过
      // 发内部事件
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.REQUESTED, { resume: parsed }, { actorId: "PDFResumeFeature" });

      // 统一走 URL_PARAMS.REQUESTED，保持与 URL / WS 导航一致的闸门
      const req = { pdfId, pageAt: parsed.page, position: typeof parsed.y_percent === "number" ? parsed.y_percent : null };
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, req, { actorId: "PDFResumeFeature" });
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.SUCCESS, { resume: parsed }, { actorId: "PDFResumeFeature" });
    } catch (e) {
      this.#logger.error("[resume] apply failed", e);
      showError("恢复阅读位置失败");
      this.#eventBus.emit(PDF_VIEWER_EVENTS.RESUME.APPLY.FAILED, { error: String(e?.message || e) }, { actorId: "PDFResumeFeature" });
    }
  }

  #scheduleUpdate() {
    this.#stopPendingUpdate();
    this.#pendingUpdateTimer = setTimeout(() => {
      try { this.#flushUpdateNow(false); } catch (e) { this.#logger.warn("[resume] flush failed", e); }
    }, this.#throttleMs);
  }

  #stopPendingUpdate() {
    if (this.#pendingUpdateTimer) {
      clearTimeout(this.#pendingUpdateTimer);
      this.#pendingUpdateTimer = null;
    }
  }

  #flushUpdateNow(sync = false) {
    const pdfId = this.#pdfId || PDFResumeFeature.#resolvePdfIdFromURL();
    if (!pdfId) { return; }
    if (!Number.isInteger(this.#latestPage) || this.#latestPage < 1) { return; }
    const yPercent = PDFResumeFeature.#measureYPercent(this.#latestPage);
    const resume = {
      page: this.#latestPage,
      ...(Number.isFinite(yPercent) ? { y_percent: Math.max(0, Math.min(100, yPercent)) } : {}),
      ...(Number.isFinite(this.#latestZoom) ? { zoom: this.#latestZoom } : {}),
      rotation: 0,
      updated_at: Date.now()
    };
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
    const y = obj.y_percent;
    if (y !== undefined && (typeof y !== "number" || !isFinite(y) || y < 0 || y > 100)) {
      throw new Error(`invalid y_percent: ${y}`);
    }
    const zoom = obj.zoom;
    if (zoom !== undefined && (typeof zoom !== "number" || !isFinite(zoom) || zoom <= 0)) {
      throw new Error(`invalid zoom: ${zoom}`);
    }
    const rotation = obj.rotation;
    if (rotation !== undefined && !Number.isInteger(rotation)) {
      throw new Error(`invalid rotation: ${rotation}`);
    }
    return { page, ...(y !== undefined ? { y_percent: y } : {}), ...(zoom !== undefined ? { zoom } : {}), ...(rotation !== undefined ? { rotation } : {}) };
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
}

export default PDFResumeFeature;
