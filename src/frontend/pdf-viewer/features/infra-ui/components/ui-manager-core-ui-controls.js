import { UIZoomControls } from "./ui-zoom-controls.js";
import { UILayoutControls } from "./ui-layout-controls.js";

export class UIControls {
  #logger;
  #pdfViewerManager;
  #zoomManager;
  #uiZoomControls;
  #isGoToPageInProgress = false;

  constructor(
    logger,
    pdfViewerManager,
    zoomManager,
    uiZoomControls
  ) {
    this.#logger = logger;
    this.#pdfViewerManager = pdfViewerManager;
    this.#zoomManager = zoomManager;
    this.#uiZoomControls = uiZoomControls;
  }

  zoomIn(data) {
    if (!this.#zoomManager) {return;}
    const delta =
      typeof data?.delta === "number"
        ? data.delta
        : this.#zoomManager.store.get().step;
    this.#zoomManager.zoomIn(delta);
  }

  zoomOut(data) {
    if (!this.#zoomManager) {return;}
    const delta =
      typeof data?.delta === "number"
        ? data.delta
        : this.#zoomManager.store.get().step;
    this.#zoomManager.zoomOut(delta);
  }

  actualSize() {
    if (!this.#zoomManager) {return;}
    this.#zoomManager.actualSize();
  }

  fitWidth() {
    if (!this.#zoomManager) {return;}
    this.#zoomManager.fitWidth();
  }

  fitHeight() {
    if (!this.#zoomManager) {return;}
    this.#zoomManager.fitHeight();
  }

  previousPage() {
    if (!this.#pdfViewerManager) {return;}
    const currentPage = this.#pdfViewerManager.currentPageNumber;
    if (currentPage > 1) {
      this.#pdfViewerManager.currentPageNumber = currentPage - 1;
      this.#logger.info(`Navigate to previous page: ${currentPage - 1}`);
    }
  }

  nextPage() {
    if (!this.#pdfViewerManager) {return;}
    const currentPage = this.#pdfViewerManager.currentPageNumber;
    const totalPages = this.#pdfViewerManager.pagesCount;
    if (currentPage < totalPages) {
      this.#pdfViewerManager.currentPageNumber = currentPage + 1;
      this.#logger.info(`Navigate to next page: ${currentPage + 1}`);
    }
  }

  goToPage(data) {
    if (!this.#pdfViewerManager) {return;}
    const targetPage = data?.pageNumber;
    const totalPages = this.#pdfViewerManager.pagesCount;

    if (this.#isGoToPageInProgress) {
      return;
    }

    // 防止同步递归闭环：当上游已在目标页时，不应再次 set currentPageNumber
    // （某些环境下 set currentPageNumber 可能会触发同步事件链，再次 emit NAVIGATION.GOTO）
    try {
      if (Number.isInteger(targetPage) && this.#pdfViewerManager.currentPageNumber === targetPage) {
        return;
      }
    } catch (e) {
      void e; /* logger-guard */
    }

    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      this.#isGoToPageInProgress = true;
      try {
        this.#pdfViewerManager.currentPageNumber = targetPage;
      } finally {
        this.#isGoToPageInProgress = false;
      }
      this.#logger.info(`Navigate to page: ${targetPage}`);
    } else {
      this.#logger.warn(
        `Invalid page number for GOTO: ${targetPage} (total: ${totalPages})`
      );
    }
  }

  syncZoomState(scale) {
    if (!this.#zoomManager) {return;}
    if (typeof scale === "number") {
      this.#zoomManager.applyEngineScale(scale);
    }
  }

  updatePageInfo(pageNumber) {
    if (!this.#pdfViewerManager) {
      return;
    }
    const totalPages = this.#pdfViewerManager.pagesCount || 0;
    this.#uiZoomControls.updatePageInfo(pageNumber, totalPages);
    this.#logger.debug(`Page info updated: ${pageNumber}/${totalPages}`);
  }
}

/**
 * Initialize UI Controls
 * @param {Object} ctx
 * @param {EventBus} ctx.eventBus
 * @param {Logger} ctx.logger
 * @param {PDFViewerManager} ctx.pdfViewerManager
 * @param {ZoomManager} ctx.zoomManager - Injected
 * @param {LayoutManager} ctx.layoutManager - Injected
 * @returns {Promise<{uiZoomControls, uiLayoutControls, unsubs, uiControls}>}
 */
export async function initializeUIManagerControls(ctx) {
  const { eventBus, logger, pdfViewerManager, zoomManager, layoutManager } =
    ctx;

  // Initialize UI with Manager
  const uiZoomControls = new UIZoomControls(eventBus, zoomManager);
  await uiZoomControls.setupZoomControls();
  logger.info("UIZoomControls initialized");

  let uiLayoutControls = null;
  if (pdfViewerManager) {
    uiLayoutControls = new UILayoutControls(layoutManager); // Pass Manager
    uiLayoutControls.setup(pdfViewerManager);
    logger.info("UILayoutControls initialized");
  } else {
    logger.warn("PDFViewerManager not available, layout controls disabled");
  }

  const uiControls = new UIControls(
    logger,
    pdfViewerManager,
    zoomManager,
    uiZoomControls
  );

  const unsubs = [];

  if (zoomManager) {
    let lastAppliedMode = null;
    let lastAppliedScale = null;
    unsubs.push(
      zoomManager.store.subscribe(
        (state, oldState) => {
          if (!oldState) {
            lastAppliedMode = null;
            lastAppliedScale = null;
          }

          if (state.mode === "custom") {
            if (
              state.scale !== lastAppliedScale ||
              lastAppliedMode !== "custom"
            ) {
              pdfViewerManager.currentScale = state.scale;
              lastAppliedMode = "custom";
              lastAppliedScale = state.scale;
            }
            return;
          }

          if (state.mode === "page-width") {
            if (lastAppliedMode !== "page-width") {
              pdfViewerManager.currentScaleValue = "page-width";
              lastAppliedMode = "page-width";
            }
            return;
          }

          if (state.mode === "page-height") {
            if (lastAppliedMode !== "page-height") {
              pdfViewerManager.currentScaleValue = "page-height";
              lastAppliedMode = "page-height";
            }
            return;
          }
        },
        { fireImmediately: true }
      )
    );
  }

  return { uiZoomControls, uiLayoutControls, unsubs, uiControls };
}
