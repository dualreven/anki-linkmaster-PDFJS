import { AnnotationType } from "../../../../../common/models/annotation.js";

/**
 * ScreenshotTool 的 marker 队列（从 screenshot/index.js 抽离）
 * - 页面未就绪：入队
 * - pagerendered / RENDER.PAGE_COMPLETED：flush
 */
export class ScreenshotMarkerQueue {
  #pdfViewerManager;
  #logger;
  #logStep;
  #renderMarker;
  #pendingMarkersByPage = new Map(); // pageNumber -> Map<annotationId, annotation>

  constructor({ pdfViewerManager, logger, logStep, renderMarker }) {
    if (!pdfViewerManager) {
      throw new Error("[ScreenshotMarkerQueue] pdfViewerManager is required");
    }
    if (typeof pdfViewerManager.getPageView !== "function") {
      throw new Error("[ScreenshotMarkerQueue] pdfViewerManager.getPageView must be a function");
    }
    if (!logger) {
      throw new Error("[ScreenshotMarkerQueue] logger is required");
    }
    if (typeof logStep !== "function") {
      throw new Error("[ScreenshotMarkerQueue] logStep must be a function");
    }
    if (typeof renderMarker !== "function") {
      throw new Error("[ScreenshotMarkerQueue] renderMarker must be a function");
    }

    this.#pdfViewerManager = pdfViewerManager;
    this.#logger = logger;
    this.#logStep = logStep;
    this.#renderMarker = renderMarker;
  }

  clear() {
    this.#pendingMarkersByPage.clear();
  }

  enqueueOrRender(annotation) {
    try {
      if (!annotation || annotation.type !== AnnotationType.SCREENSHOT) {return;}

      const pageNumber = Number(annotation.pageNumber || 0);
      const pageView = (pageNumber > 0) ? this.#pdfViewerManager.getPageView(pageNumber) : null;
      const ready = !!(pageView && pageView.div);

      if (ready) {
        this.#logStep("03.1", "Page ready → render now", { id: annotation.id, page: pageNumber }, "success", 1500);
        this.#renderMarker(annotation);
        return;
      }

      let pageMap = this.#pendingMarkersByPage.get(pageNumber);
      if (!pageMap) {
        pageMap = new Map();
        this.#pendingMarkersByPage.set(pageNumber, pageMap);
      }
      pageMap.set(annotation.id, annotation);
      this.#logStep("03.2", "Page not ready → queued", { id: annotation.id, page: pageNumber }, "info", 1500);
    } catch (e) {
      this.#logger?.warn?.("[ScreenshotTool] enqueueOrRender failed", e);
    }
  }

  flushPendingForPage(pageNumber) {
    try {
      const pageMap = this.#pendingMarkersByPage.get(pageNumber);
      if (!pageMap || pageMap.size === 0) {return;}

      const items = Array.from(pageMap.values());
      this.#pendingMarkersByPage.delete(pageNumber);
      this.#logStep("04", "pagerendered → flush pending", { page: pageNumber, count: items.length }, "info", 1800);
      items.forEach((ann) => {
        try {
          this.#logStep("04.1", "Flushing item", { id: ann.id, page: pageNumber });
          this.#renderMarker(ann);
        } catch (e) { this.#logger?.debug?.("[ScreenshotTool] flush item failed", e); }
      });
      this.#logStep("04.done", "Flush completed", { page: pageNumber, count: items.length });
    } catch (e) {
      this.#logger?.warn?.("[ScreenshotTool] flushPendingForPage failed", e);
    }
  }
}
