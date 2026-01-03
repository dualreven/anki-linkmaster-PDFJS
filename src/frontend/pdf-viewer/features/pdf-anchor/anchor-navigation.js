import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { showError, showInfo } from "../../../common/utils/notification.js";
import { normalizeStoredPositionToPercent } from "./anchor-utils.js";

export function navigateToAnchor({
  logger,
  eventBus,
  anchorsById,
  positionTracker,
  anchorId,
  setLastNav,
  setLastUpdateAt,
}) {
  const id = String(anchorId || "").trim();
  if (!id) {
    return;
  }

  const a = anchorsById.get(id);
  if (!a) {
    try { showError("锚点导航失败：未找到锚点"); } catch (e) { logger.debug("[pdf-anchor] showError failed (anchor not found)", e); }
    logger.warn("[pdf-anchor] navigateToAnchor: anchor not found", { anchorId: id });
    return;
  }

  const pageAt = parseInt(a.page_at || 1, 10);
  if (!Number.isFinite(pageAt) || pageAt < 1) {
    try { showError("锚点导航失败：无效页码"); } catch (e) { logger.debug("[pdf-anchor] showError failed (invalid page)", e); }
    logger.warn("[pdf-anchor] navigateToAnchor: invalid page_at", { anchorId: id, page_at: a.page_at });
    return;
  }

  let pos = null;
  if (typeof a.position === "number" && !Number.isNaN(a.position)) {
    pos = normalizeStoredPositionToPercent(a.position);
  }

  try {
    const posText = (pos === null || Number.isNaN(pos)) ? "(未提供)" : `${pos}%`;
    showInfo(`执行跳转: 第${pageAt}页 ${posText}`);
  } catch (e) { void e; /* logger-guard */ }

  const t0 = Date.now();
  setLastNav({ pageAt, position: pos, anchorId: id, t0, method: "url" });

  let pdfId = null;
  try { pdfId = new URLSearchParams(window.location.search).get("pdf-id"); } catch { /* noop */ }
  const payload = { pdfId, anchorId: id, pageAt };
  if (typeof pos === "number" && !Number.isNaN(pos)) {
    payload.position = pos;
  }

  try {
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
      { anchorId: id, active: true },
      { actorId: "PDFAnchorFeature" }
    );
  } catch (e) {
    logger.debug("[pdf-anchor] emit ANCHOR.ACTIVATE failed (navigateToAnchor)", e);
  }

  eventBus.emit(
    PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
    payload,
    { actorId: "PDFAnchorFeature" }
  );

  if (positionTracker) {
    try {
      positionTracker.freezeFor(3000);
    } catch (e) {
      logger.debug("[pdf-anchor] position tracker freeze failed", e);
    }
  }

  setLastUpdateAt(null);
}

