import { PositionTracker } from "../../shared/position-tracker.js";
import { normalizePercentToStoredPosition } from "./anchor-utils.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

export function setupAnchorPositionTracker({
  logger,
  container,
  eventBus,
  getAnchorsById,
  getActiveAnchorId,
  setLastUpdateAt,
  getLastUpdateAt,
}) {
  let domEventHub = null;
  try {
    if (container?.has?.("domEventHub")) {
      domEventHub = container.get("domEventHub");
    }
  } catch (e) {
    logger.warn("[pdf-anchor] domEventHub not available, fallback to direct DOM listeners", e);
    domEventHub = null;
  }

  const tracker = new PositionTracker({
    debounceMs: 200,
    domEventHub,
    onPositionChange: (pageAt, position) => {
      handlePositionChanged({ logger, eventBus, getAnchorsById, getActiveAnchorId, setLastUpdateAt, getLastUpdateAt }, pageAt, position);
    },
  });

  activateTrackerWhenReady({ logger, tracker });

  return tracker;
}

function activateTrackerWhenReady({ logger, tracker }) {
  let container = null;
  try {
    container = document.getElementById("viewerContainer");
  } catch (e) {
    logger.warn("[pdf-anchor] getElementById(viewerContainer) failed", e);
  }

  if (container) {
    try {
      tracker.activate(container);
      logger.info("[pdf-anchor] position tracker activated");
    } catch (e) {
      logger.error("[pdf-anchor] failed to activate position tracker", e);
    }
    return;
  }

  logger.warn("[pdf-anchor] viewerContainer not ready, retrying position tracker activation...");
  setTimeout(() => {
    let retryContainer = null;
    try {
      retryContainer = document.getElementById("viewerContainer");
    } catch (e) {
      logger.warn("[pdf-anchor] getElementById(viewerContainer) failed on retry", e);
    }
    if (!retryContainer) {
      logger.error("[pdf-anchor] viewerContainer still not found after retry");
      return;
    }
    try {
      tracker.activate(retryContainer);
      logger.info("[pdf-anchor] position tracker activated (retry)");
    } catch (e) {
      logger.error("[pdf-anchor] failed to activate position tracker on retry", e);
    }
  }, 500);
}

function handlePositionChanged(ctx, pageAt, position) {
  const activeAnchorId = ctx.getActiveAnchorId();
  if (!activeAnchorId) {
    return;
  }

  const now = Date.now();
  const lastUpdateAt = ctx.getLastUpdateAt();
  if (lastUpdateAt !== null && (now - lastUpdateAt) < 1000) {
    ctx.logger.debug("[pdf-anchor] position change ignored by throttle", {
      anchorId: activeAnchorId,
      pageAt,
      position,
      sinceLastMs: now - lastUpdateAt
    });
    return;
  }

  ctx.setLastUpdateAt(now);
  try {
    updateActiveAnchorPosition(ctx, activeAnchorId, pageAt, position);
  } catch (e) {
    ctx.logger.warn("[pdf-anchor] handlePositionChanged failed", e);
  }
}

function updateActiveAnchorPosition(ctx, anchorId, pageAt, position) {
  const id = String(anchorId || "").trim();
  if (!id) {
    return;
  }

  const pageAtNum = parseInt(pageAt || 1, 10) || 1;
  let posNum = null;
  if (typeof position === "number" && Number.isFinite(position)) {
    posNum = Math.round(Math.max(0, Math.min(100, position)));
  }

  const anchorsById = ctx.getAnchorsById();
  const anchor = anchorsById.get(id) || { uuid: id };
  anchor.page_at = pageAtNum;
  anchor.position = normalizePercentToStoredPosition(posNum);
  anchorsById.set(id, anchor);

  ctx.eventBus.emit(
    PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
    { anchorId: id, update: { page_at: pageAtNum, position: posNum } },
    { actorId: "PDFAnchorFeature" }
  );

  ctx.eventBus.emit(
    PDF_VIEWER_EVENTS.ANCHOR.UPDATED,
    { anchorId: id, page_at: pageAtNum, position: posNum },
    { actorId: "PDFAnchorFeature" }
  );
}
