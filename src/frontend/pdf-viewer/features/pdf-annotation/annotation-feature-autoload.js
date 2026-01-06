import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { getWsGateEventStatus } from "../../../common/ws/ws-gate-status-store.js";

export function setupAnnotationAutoLoadOnFileLoad({
  eventBus,
  logger,
  annotationManager,
  ensureAllOverlays,
  getCurrentPdfId,
  setCurrentPdfId,
  getHasLoadedOnce,
  setHasLoadedOnce,
}) {
  if (!eventBus) {
    throw new Error("[AnnotationFeature] setupAnnotationAutoLoadOnFileLoad: eventBus is required");
  }
  if (!logger) {
    throw new Error("[AnnotationFeature] setupAnnotationAutoLoadOnFileLoad: logger is required");
  }

  const unsubs = [];
  const onGlobal = (event, handler, options) => {
    const off = eventBus.onGlobal(event, handler, options);
    if (typeof off !== "function") {
      throw new Error(`[AnnotationFeature] setupAnnotationAutoLoadOnFileLoad: onGlobal must return unsubscribe for ${String(event)}`);
    }
    unsubs.push(off);
    return off;
  };

  const isResumeDone = (pdfId) => {
    const st = getWsGateEventStatus(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE);
    return Boolean(st?.fired && st.lastPayload?.pdfId === pdfId);
  };

  const tryLoad = (pdfId, reason) => {
    if (typeof pdfId !== "string" || !pdfId.trim()) {
      throw new Error("[AnnotationFeature] invalid pdfId for autoload");
    }
    if (getHasLoadedOnce()) {return;}
    logger.info(`[AnnotationFeature] 自动加载标注（pdfId=${pdfId}）`, { reason });
    eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD, { pdfId }, { actorId: "AnnotationFeature" });
  };

  onGlobal(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, (data) => {
    try {
      const pdfId = typeof data?.pdfId === "string" ? data.pdfId.trim() : "";
      if (!pdfId) {
        const msg = "missing pdfId in FILE.LOAD.SUCCESS";
        logger.error(
          "[AnnotationFeature] 标注自动加载失败：缺少 pdfId（需由加载链路显式提供）",
          { filename: data?.filename ?? null, url: data?.url ?? null },
          { toast: { type: "error", ms: 5000 } },
        );
        eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, { error: msg }, { actorId: "AnnotationFeature" });
        return;
      }
      const prev = getCurrentPdfId();
      const same = prev === pdfId;
      setCurrentPdfId(pdfId);
      if (!same) { setHasLoadedOnce(false); }
      annotationManager?.setPdfId?.(pdfId);
      if (isResumeDone(pdfId)) { tryLoad(pdfId, "file-load-success+resume-done"); }
    } catch (err) {
      logger.warn("[AnnotationFeature] 自动加载标注失败", err);
    }
  }, { subscriberId: "AnnotationFeature" });

  onGlobal(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE, (data) => {
    try {
      const pdfId = typeof data?.pdfId === "string" ? data.pdfId.trim() : "";
      if (!pdfId) {
        const msg = "missing pdfId in RESUME.FLOW.DONE";
        logger.error(
          "[AnnotationFeature] 标注自动加载失败：resume 完成事件缺少 pdfId",
          { data },
          { toast: { type: "error", ms: 5000 } },
        );
        eventBus.emit(PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOAD_FAILED, { error: msg }, { actorId: "AnnotationFeature" });
        return;
      }
      setCurrentPdfId(pdfId);
      annotationManager?.setPdfId?.(pdfId);
      tryLoad(pdfId, "resume-flow-done");
    } catch (e) {
      logger.warn("[AnnotationFeature] resume-flow-done handler failed", e);
    }
  }, { subscriberId: "AnnotationFeature" });

  onGlobal(WEBSOCKET_EVENTS.CONNECTION.ESTABLISHED, () => {
    try {
      const pdfId = getCurrentPdfId();
      if (pdfId && isResumeDone(pdfId)) { tryLoad(pdfId, "ws-established"); }
    } catch (e) {
      logger.warn("[AnnotationFeature] ws-established handler failed", e);
    }
  }, { subscriberId: "AnnotationFeature" });

  onGlobal(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED, (data) => {
    try {
      const pdfId = getCurrentPdfId();
      if (data?.sidebarId === "annotation" && pdfId) {
        if (!getHasLoadedOnce() && isResumeDone(pdfId)) { tryLoad(pdfId, "sidebar-opened"); }
        ensureAllOverlays();
      }
    } catch (e) {
      logger.warn("[AnnotationFeature] sidebar-opened handler failed", e);
    }
  }, { subscriberId: "AnnotationFeature" });

  try {
    const st = getWsGateEventStatus(PDF_VIEWER_EVENTS.RESUME.FLOW.DONE);
    const pdfId = typeof st?.lastPayload?.pdfId === "string" ? st.lastPayload.pdfId.trim() : "";
    if (pdfId) { setCurrentPdfId(pdfId); tryLoad(pdfId, "resume-history"); }
  } catch (e) {
    logger.warn("[AnnotationFeature] resume-history autoload failed", e);
  }

  return unsubs;
}
