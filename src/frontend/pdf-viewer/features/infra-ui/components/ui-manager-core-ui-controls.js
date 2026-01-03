import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { UIZoomControls } from "./ui-zoom-controls.js";
import { UILayoutControls } from "./ui-layout-controls.js";

function installZoomIntegration(ctx) {
  const { eventBus, logger, pdfViewerManager } = ctx;

  if (!pdfViewerManager) {
    logger.warn("PDFViewerManager not available, zoom integration disabled");
    return [];
  }

  const unsubs = [];

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, (data) => {
    const delta = data?.delta || 0.25;
    const newScale = Math.min((pdfViewerManager.currentScale || 1.0) + delta, 5.0);
    pdfViewerManager.currentScale = newScale;
    logger.info(`Zoom in: ${newScale.toFixed(2)}`);
  }, { subscriberId: "UIManagerCore.ZoomIn" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, (data) => {
    const delta = data?.delta || 0.25;
    const newScale = Math.max((pdfViewerManager.currentScale || 1.0) - delta, 0.25);
    pdfViewerManager.currentScale = newScale;
    logger.info(`Zoom out: ${newScale.toFixed(2)}`);
  }, { subscriberId: "UIManagerCore.ZoomOut" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
    pdfViewerManager.currentScale = 1.0;
    logger.info("Zoom reset to actual size (100%)");
  }, { subscriberId: "UIManagerCore.ZoomActualSize" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
    pdfViewerManager.currentScaleValue = "page-width";
    logger.info("Zoom to fit width");
  }, { subscriberId: "UIManagerCore.ZoomFitWidth" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
    pdfViewerManager.currentScaleValue = "page-height";
    logger.info("Zoom to fit height");
  }, { subscriberId: "UIManagerCore.ZoomFitHeight" }));

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

export async function initializeUIManagerControls(ctx) {
  const { eventBus, logger, pdfViewerManager } = ctx;

  const unsubs = [];

  const uiZoomControls = new UIZoomControls(eventBus);
  await uiZoomControls.setupZoomControls();
  logger.info("UIZoomControls initialized");

  let uiLayoutControls = null;
  if (pdfViewerManager) {
    uiLayoutControls = new UILayoutControls(eventBus);
    uiLayoutControls.setup(pdfViewerManager);
    logger.info("UILayoutControls initialized");
  } else {
    logger.warn("PDFViewerManager not available, layout controls disabled");
  }

  unsubs.push(...installZoomIntegration({ eventBus, logger, pdfViewerManager }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGING, ({ scale }) => {
    uiZoomControls.setScale(scale);
  }, { subscriberId: "UIManagerCore" }));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.PAGE.CHANGING, ({ pageNumber }) => {
    if (!pdfViewerManager) { return; }
    const totalPages = pdfViewerManager.pagesCount || 0;
    uiZoomControls.updatePageInfo(pageNumber, totalPages);
    logger.debug(`Page info updated: ${pageNumber}/${totalPages}`);
  }, { subscriberId: "UIManagerCore.PageSync" }));

  return { uiZoomControls, uiLayoutControls, unsubs };
}

