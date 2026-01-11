import { AnnotationType } from "../../../../../common/models/annotation.js";

export class ScreenshotStoreReactiveMarkers {
  #markerQueue;
  #ensureOverlayFor;
  #removeMarker;
  #logger;
  #lastById = new Map(); // annotationId -> annotation
  #lastSigById = new Map(); // annotationId -> signature

  constructor({ markerQueue, ensureOverlayFor, removeMarker, logger }) {
    if (!markerQueue || typeof markerQueue.dropPending !== "function") {
      throw new Error("[ScreenshotStoreReactiveMarkers] markerQueue.dropPending is required");
    }
    if (typeof ensureOverlayFor !== "function") {
      throw new Error("[ScreenshotStoreReactiveMarkers] ensureOverlayFor must be a function");
    }
    if (typeof removeMarker !== "function") {
      throw new Error("[ScreenshotStoreReactiveMarkers] removeMarker must be a function");
    }
    if (!logger) {
      throw new Error("[ScreenshotStoreReactiveMarkers] logger is required");
    }

    this.#markerQueue = markerQueue;
    this.#ensureOverlayFor = ensureOverlayFor;
    this.#removeMarker = removeMarker;
    this.#logger = logger;
  }

  destroy() {
    this.#lastById.clear();
    this.#lastSigById.clear();
  }

  invalidateAll() {
    this.#lastSigById.clear();
  }

  invalidatePage(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      throw new Error("[ScreenshotStoreReactiveMarkers] pageNumber must be a positive number");
    }

    for (const [id, ann] of this.#lastById.entries()) {
      if (!ann) {
        continue;
      }
      if (Number(ann.pageNumber || 0) !== pn) {
        continue;
      }
      this.#lastSigById.delete(id);
    }
  }

  apply(currentScreenshots) {
    if (!Array.isArray(currentScreenshots)) {
      throw new Error("[ScreenshotStoreReactiveMarkers] currentScreenshots must be an array");
    }

    const nextById = new Map();
    for (const ann of currentScreenshots) {
      if (!ann || ann.type !== AnnotationType.SCREENSHOT) {
        continue;
      }
      if (!ann.id) {
        continue;
      }
      nextById.set(ann.id, ann);
    }

    // removals
    for (const oldId of Array.from(this.#lastById.keys())) {
      if (!nextById.has(oldId)) {
        this.#markerQueue.dropPending(oldId);
        this.#removeMarker(oldId);
        this.#lastById.delete(oldId);
        this.#lastSigById.delete(oldId);
      }
    }

    // additions/updates
    for (const [id, ann] of nextById.entries()) {
      const nextSig = this.#buildSignature(ann);
      const prevSig = this.#lastSigById.get(id) || null;
      this.#lastById.set(id, ann);

      if (prevSig === nextSig) {
        continue;
      }
      this.#lastSigById.set(id, nextSig);
      this.#ensureOverlayFor(ann);
    }

    this.#logger.debug(`[ScreenshotTool] Markers updated (diff). Current: ${nextById.size}`);
  }

  #buildSignature(annotation) {
    const pageNumber = Number(annotation?.pageNumber || 0);
    const rect = annotation?.data?.rectPercent || null;
    const markerColor = String(annotation?.data?.markerColor || "");
    const x = Number(rect?.xPercent ?? NaN);
    const y = Number(rect?.yPercent ?? NaN);
    const w = Number(rect?.widthPercent ?? NaN);
    const h = Number(rect?.heightPercent ?? NaN);

    return `p=${pageNumber}|x=${x}|y=${y}|w=${w}|h=${h}|c=${markerColor}`;
  }
}
