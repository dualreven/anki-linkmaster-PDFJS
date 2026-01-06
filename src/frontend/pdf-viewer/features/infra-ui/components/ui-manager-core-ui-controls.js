import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { UIZoomControls } from "./ui-zoom-controls.js";
import { UILayoutControls } from "./ui-layout-controls.js";
// No longer importing Managers here, they are injected

function installZoomIntegration(ctx) {
  const { eventBus, logger, pdfViewerManager, zoomManager } = ctx;

  if (!pdfViewerManager) {
    logger.warn("PDFViewerManager not available, zoom integration disabled");
    return [];
  }

  if (!zoomManager) {
    logger.warn("ZoomManager not available, zoom integration disabled");
    return [];
  }

  const unsubs = [];

  // Command: EventBus -> ZoomManager(store)
  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, (data) => {
    const delta = typeof data?.delta === "number" ? data.delta : zoomManager.store.get().step;
    zoomManager.zoomIn(delta);
  }, { subscriberId: "UIManagerCore.ZoomIn" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, (data) => {
    const delta = typeof data?.delta === "number" ? data.delta : zoomManager.store.get().step;
    zoomManager.zoomOut(delta);
  }, { subscriberId: "UIManagerCore.ZoomOut" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
    zoomManager.actualSize();
  }, { subscriberId: "UIManagerCore.ZoomActualSize" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
    zoomManager.fitWidth();
  }, { subscriberId: "UIManagerCore.ZoomFitWidth" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
    zoomManager.fitHeight();
  }, { subscriberId: "UIManagerCore.ZoomFitHeight" }));

  // State: ZoomManager(store) -> PDFViewerManager(engine)
  let lastAppliedMode = null;
  let lastAppliedScale = null;
  unsubs.push(zoomManager.store.subscribe((state, oldState) => {
    if (!oldState) {
      lastAppliedMode = null;
      lastAppliedScale = null;
    }

    if (state.mode === "custom") {
      if (state.scale !== lastAppliedScale || lastAppliedMode !== "custom") {
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
  }, { fireImmediately: true }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, () => {
    const currentPage = pdfViewerManager.currentPageNumber;
    if (currentPage > 1) {
      pdfViewerManager.currentPageNumber = currentPage - 1;
      logger.info(`Navigate to previous page: ${currentPage - 1}`);
    }
  }, { subscriberId: "UIManagerCore.NavPrev" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, () => {
    const currentPage = pdfViewerManager.currentPageNumber;
    const totalPages = pdfViewerManager.pagesCount;
    if (currentPage < totalPages) {
      pdfViewerManager.currentPageNumber = currentPage + 1;
      logger.info(`Navigate to next page: ${currentPage + 1}`);
    }
  }, { subscriberId: "UIManagerCore.NavNext" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, (data) => {
    const targetPage = data?.pageNumber;
    const totalPages = pdfViewerManager.pagesCount;

    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      pdfViewerManager.currentPageNumber = targetPage;
      logger.info(`Navigate to page: ${targetPage}`);
    } else {
      logger.warn(`Invalid page number for GOTO: ${targetPage} (total: ${totalPages})`);
    }
  }, { subscriberId: "UIManagerCore.NavGoto" }));

  return unsubs;
}

/**
 * Initialize UI Controls
 * @param {Object} ctx
 * @param {EventBus} ctx.eventBus
 * @param {Logger} ctx.logger
 * @param {PDFViewerManager} ctx.pdfViewerManager
 * @param {ZoomManager} ctx.zoomManager - Injected
 * @param {LayoutManager} ctx.layoutManager - Injected
 * @returns {Promise<{uiZoomControls, uiLayoutControls, unsubs}>}
 */
export async function initializeUIManagerControls(ctx) {
  const { eventBus, logger, pdfViewerManager, zoomManager, layoutManager } = ctx;

  const unsubs = [];

  // Initialize UI with Manager
  const uiZoomControls = new UIZoomControls(eventBus, zoomManager);
  await uiZoomControls.setupZoomControls();
  logger.info("UIZoomControls initialized");

  let uiLayoutControls = null;
  if (pdfViewerManager) {
    uiLayoutControls = new UILayoutControls(eventBus, layoutManager); // Pass Manager
    uiLayoutControls.setup(pdfViewerManager);
    logger.info("UILayoutControls initialized");
  } else {
    logger.warn("PDFViewerManager not available, layout controls disabled");
  }

  // Install handlers that bridge Events -> PDFViewerManager
  unsubs.push(...installZoomIntegration({ eventBus, logger, pdfViewerManager, zoomManager }));

  // Interop: When PDF Engine changes scale (e.g. pinch), sync to store（不改变 mode）
  if (zoomManager) {
    unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
      if (typeof scale === "number") {
        zoomManager.applyEngineScale(scale);
      }
    }, { subscriberId: "UIManagerCore.SyncZoomState" }));
  }

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
    if (!pdfViewerManager) { return; }
    const totalPages = pdfViewerManager.pagesCount || 0;
    uiZoomControls.updatePageInfo(pageNumber, totalPages);
    logger.debug(`Page info updated: ${pageNumber}/${totalPages}`);
  }, { subscriberId: "UIManagerCore.PageSync" }));

  return { uiZoomControls, uiLayoutControls, unsubs };
}
