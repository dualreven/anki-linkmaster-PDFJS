import { AnnotationType } from "../../../../../common/models/annotation.js";

/**
 * ScreenshotTool 的 marker 队列（从 screenshot/index.js 抽离）
 * - 页面未就绪：入队
 * - 页面就绪信号到达：清空 pending（渲染由 storeReactiveMarkers 统一驱动）
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

  dropPending(annotationId) {
    if (!annotationId) {
      return;
    }

    this.#pendingMarkersByPage.forEach((pageMap, pageNumber) => {
      if (!pageMap || typeof pageMap.delete !== "function") {
        return;
      }
      pageMap.delete(annotationId);
      if (pageMap.size === 0) {
        this.#pendingMarkersByPage.delete(pageNumber);
      }
    });
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

  clearPendingForPage(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      throw new Error("[ScreenshotMarkerQueue] pageNumber must be a positive number");
    }

    const pageMap = this.#pendingMarkersByPage.get(pn);
    const count = pageMap?.size || 0;
    this.#pendingMarkersByPage.delete(pn);
    if (count > 0) {
      this.#logStep("04.qclr", "Page ready → clear pending queue", { page: pn, count }, "info", 1600);
    }
    return count;
  }
}
