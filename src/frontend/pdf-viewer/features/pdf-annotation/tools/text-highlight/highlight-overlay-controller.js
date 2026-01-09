import { PendingHighlightQueue } from "./pending-highlight-queue.js";

export class HighlightOverlayController {
  /** @type {any} */
  #logger;
  /** @type {any} */
  #pdfViewerManager;
  /** @type {any} */
  #highlightRenderer;
  /** @type {any} */
  #actionMenu;

  /** @type {Map<string, { annotation: any, container: HTMLElement, boundingBox: any }>} */
  #records = new Map();

  /** @type {PendingHighlightQueue} */
  #pendingQueue = new PendingHighlightQueue();

  /** @type {Map<number, any[]>} */
  #latestHighlightsByPage = new Map();

  constructor({ logger, pdfViewerManager, highlightRenderer, actionMenu }) {
    this.#logger = logger ?? console;
    this.#pdfViewerManager = pdfViewerManager ?? null;
    this.#highlightRenderer = highlightRenderer;
    this.#actionMenu = actionMenu;
  }

  clear() {
    this.#records.clear();
    this.#pendingQueue.clear();
    this.#latestHighlightsByPage.clear();
  }

  /**
   * 订阅 AnnotationManager.store 后，用 snapshot/diff 驱动 overlay 增删改。
   * @param {any[]|undefined|null} annotations
   */
  applyAnnotationsSnapshot(annotations) {
    const list = Array.isArray(annotations) ? annotations : [];
    const highlightAnnotations = list.filter((ann) => ann?.type === "text-highlight" && ann?.id);

    const nextIds = new Set(highlightAnnotations.map((a) => a.id));

    // 删除：records 中存在但 snapshot 中不存在的高亮
    for (const id of Array.from(this.#records.keys())) {
      if (!nextIds.has(id)) {
        this.handleAnnotationDeleted(id);
      }
    }

    // 删除：pending queue 中存在但 snapshot 中不存在的高亮
    this.#pendingQueue.pruneNotIn(nextIds);

    // 更新：按 snapshot 逐条渲染/刷新（render 内部会处理“已存在且容器仍有效”的快路径）
    highlightAnnotations.forEach((annotation) => {
      this.renderHighlightForAnnotation(annotation);
    });

    // 缓存：用于 page render/scale 恢复时按页重建
    const byPage = new Map();
    highlightAnnotations.forEach((annotation) => {
      const pn = Number(annotation?.pageNumber || 0);
      if (!pn) {
        return;
      }
      let bucket = byPage.get(pn);
      if (!bucket) {
        bucket = [];
        byPage.set(pn, bucket);
      }
      bucket.push(annotation);
    });
    this.#latestHighlightsByPage = byPage;
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
    this.applyAnnotationsSnapshot(Array.isArray(data?.annotations) ? data.annotations : []);
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
      const list = this.#latestHighlightsByPage.get(pn) || [];
      list.forEach((ann) => this.renderHighlightForAnnotation(ann));
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
