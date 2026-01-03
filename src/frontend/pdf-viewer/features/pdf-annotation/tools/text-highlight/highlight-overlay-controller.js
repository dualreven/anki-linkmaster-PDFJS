import { PendingHighlightQueue } from "./pending-highlight-queue.js";

export class HighlightOverlayController {
  /** @type {any} */
  #logger;
  /** @type {any} */
  #pdfViewerManager;
  /** @type {any} */
  #container;
  /** @type {any} */
  #highlightRenderer;
  /** @type {any} */
  #actionMenu;

  /** @type {Map<string, { annotation: any, container: HTMLElement, boundingBox: any }>} */
  #records = new Map();

  /** @type {PendingHighlightQueue} */
  #pendingQueue = new PendingHighlightQueue();

  constructor({ logger, pdfViewerManager, container, highlightRenderer, actionMenu }) {
    this.#logger = logger ?? console;
    this.#pdfViewerManager = pdfViewerManager ?? null;
    this.#container = container ?? null;
    this.#highlightRenderer = highlightRenderer;
    this.#actionMenu = actionMenu;
  }

  clear() {
    this.#records.clear();
    this.#pendingQueue.clear();
  }

  /**
   * @param {string} annotationId
   * @returns {any|null}
   */
  getLatestAnnotationById(annotationId) {
    const rec = annotationId ? this.#records.get(annotationId) : null;
    return rec?.annotation ?? null;
  }

  /**
   * @param {any} annotation
   * @param {string} color
   */
  updateHighlightColor(annotation, color) {
    if (!annotation?.id) {
      return;
    }

    this.#highlightRenderer.updateHighlightColor(annotation.id, color);
    this.#actionMenu?.updateColor?.(annotation.id, color);

    const rec = this.#records.get(annotation.id);
    if (rec) {
      rec.annotation = {
        ...annotation,
        data: {
          ...annotation.data,
          highlightColor: color
        }
      };
    }
  }

  /**
   * @param {any} annotation
   */
  handleAnnotationUpdated(annotation) {
    if (!annotation?.id) {
      return;
    }
    const rec = this.#records.get(annotation.id);
    if (!rec) {
      return;
    }
    rec.annotation = annotation;
    if (annotation.data?.highlightColor) {
      this.#highlightRenderer.updateHighlightColor(annotation.id, annotation.data.highlightColor);
      this.#actionMenu?.updateColor?.(annotation.id, annotation.data.highlightColor);
    }
  }

  /**
   * @param {string} annotationId
   * @param {number|undefined} pageNumber
   */
  handleAnnotationDeleted(annotationId, pageNumber) {
    if (!annotationId) {
      return;
    }
    this.#highlightRenderer.removeHighlight(annotationId);
    this.#actionMenu?.detach?.(annotationId);

    const rec = this.#records.get(annotationId);
    const pn = Number(pageNumber || rec?.annotation?.pageNumber || 0);
    if (pn) {
      this.#pendingQueue.remove(annotationId, pn);
    }
    this.#records.delete(annotationId);
  }

  /**
   * @param {{ annotations?: any[] }} data
   */
  handleAnnotationsLoaded(data) {
    const annotations = Array.isArray(data?.annotations) ? data.annotations : [];
    const highlightAnnotations = annotations.filter((ann) => ann?.type === "text-highlight");

    this.#actionMenu?.destroy?.();
    this.#highlightRenderer.clearAllHighlights();
    this.clear();

    highlightAnnotations.forEach((annotation) => {
      this.renderHighlightForAnnotation(annotation);
    });
  }

  /**
   * @param {number} pageNumber
   */
  restoreHighlightsForPage(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      return;
    }

    try {
      const mgr = this.#container?.get ? this.#container.get("annotationManager") : null;
      if (!mgr || typeof mgr.getAnnotationsByPage !== "function") {
        return;
      }
      const list = mgr.getAnnotationsByPage(pn) || [];
      list.forEach((ann) => {
        if (ann?.type === "text-highlight") {
          this.renderHighlightForAnnotation(ann);
        }
      });
    } catch (e) {
      this.#logger?.warn?.("[TextHighlightTool] restoreHighlightsForPage failed", e);
    }
  }

  /**
   * @param {number} pageNumber
   */
  flushPendingHighlightsForPage(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      return;
    }
    const entries = this.#pendingQueue.drainPage(pn);
    if (entries.length === 0) {
      return;
    }
    entries.forEach((annotation) => {
      const rendered = this.renderHighlightForAnnotation(annotation, { allowQueue: false });
      if (rendered) {
        this.#pendingQueue.remove(annotation.id, pn);
      }
    });
  }

  /**
   * @param {any} annotation
   */
  ensureOverlayFor(annotation) {
    try {
      if (!annotation || annotation.type !== "text-highlight") {
        return;
      }
      this.renderHighlightForAnnotation(annotation);
    } catch (e) {
      this.#logger?.warn?.("[TextHighlightTool] ensureOverlayFor failed", e);
    }
  }

  /**
   * @param {any} annotation
   * @param {{ allowQueue?: boolean }} [options]
   * @returns {boolean}
   */
  renderHighlightForAnnotation(annotation, options = {}) {
    const { allowQueue = true } = options;
    try {
      if (!annotation || annotation.type !== "text-highlight") {
        return false;
      }

      if (this.#records.has(annotation.id)) {
        const rec = this.#records.get(annotation.id);
        const container = rec?.container || null;
        let stillValid = false;
        try {
          if (container && container.isConnected) {
            const pageEl = container.closest?.(".page") || null;
            const pageNo = pageEl ? Number(pageEl.dataset.pageNumber || 0) : 0;
            stillValid = (pageNo === Number(annotation.pageNumber || 0));
          }
        } catch (e) {
          this.#logger?.debug?.("[TextHighlightTool] validate existing highlight container failed", e);
          stillValid = false;
        }

        if (stillValid) {
          if (annotation.data?.highlightColor) {
            this.#highlightRenderer.updateHighlightColor(annotation.id, annotation.data.highlightColor);
            this.#actionMenu?.updateColor?.(annotation.id, annotation.data.highlightColor);
          }
          this.#records.set(annotation.id, { ...rec, annotation });
          return true;
        }

        try { this.#highlightRenderer.removeHighlight(annotation.id); } catch (e) { this.#logger?.debug?.("[TextHighlightTool] removeHighlight for stale container failed", e); }
      }

      if (!this.#isTextLayerReady(annotation.pageNumber)) {
        if (allowQueue) {
          this.#pendingQueue.enqueue(annotation);
        }
        return false;
      }

      const result = this.#highlightRenderer.renderHighlight(
        annotation.pageNumber,
        annotation.data?.textRanges || [],
        annotation.data?.highlightColor,
        annotation.id,
        annotation.data?.lineRects || null
      );

      if (!result) {
        if (allowQueue) {
          this.#pendingQueue.enqueue(annotation);
        }
        return false;
      }

      this.#records.set(annotation.id, {
        annotation,
        container: result.container,
        boundingBox: result.boundingBox,
      });
      this.#pendingQueue.remove(annotation.id, annotation.pageNumber);
      this.#actionMenu?.attach?.(result.container, annotation, { boundingBox: result.boundingBox });
      return true;
    } catch (e) {
      this.#logger?.warn?.("[TextHighlightTool] renderHighlightForAnnotation failed", e);
      if (allowQueue) {
        this.#pendingQueue.enqueue(annotation);
      }
      return false;
    }
  }

  /**
   * @param {number} pageNumber
   * @returns {boolean}
   */
  #isTextLayerReady(pageNumber) {
    const pn = Number(pageNumber || 0);
    if (!pn) {
      return false;
    }

    let pageElement = null;
    if (this.#pdfViewerManager?.getPageView) {
      try {
        const pageView = this.#pdfViewerManager.getPageView(pn);
        pageElement = pageView?.div || null;
      } catch (e) {
        this.#logger?.debug?.("[TextHighlightTool] getPageView failed", e);
      }
    }

    if (!pageElement && typeof document !== "undefined") {
      pageElement = document
        ?.getElementById("viewerContainer")
        ?.querySelector(`.page[data-page-number="${pn}"]`) || null;
    }

    if (!pageElement) {
      return false;
    }

    return !!pageElement.querySelector(".textLayer");
  }
}
