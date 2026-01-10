import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

export function installPageInfoInitSubscriptions({
  on,
  logger,
  viewerManager,
  getPdfViewerManager,
  getUIZoomControls,
}) {
  if (typeof on !== "function") {
    throw new Error("[infra-ui] on is required");
  }
  if (!logger) {
    throw new Error("[infra-ui] logger is required");
  }
  if (!viewerManager || typeof viewerManager.setPageInfo !== "function") {
    throw new Error("[infra-ui] viewerManager.setPageInfo is required");
  }
  if (typeof getPdfViewerManager !== "function") {
    throw new Error("[infra-ui] getPdfViewerManager is required");
  }
  if (typeof getUIZoomControls !== "function") {
    throw new Error("[infra-ui] getUIZoomControls is required");
  }

  let pendingPdfDocument = null;

  const clearPending = () => {
    pendingPdfDocument = null;
  };

  const unsubs = [];

  unsubs.push(
    on(
      PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
      () => clearPending(),
      { subscriberId: "InfraUICoordinator.PageInfoInit.FileLoadRequested" }
    )
  );

  unsubs.push(
    on(
      PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
      () => clearPending(),
      { subscriberId: "InfraUICoordinator.PageInfoInit.FileLoadFailed" }
    )
  );

  unsubs.push(
    on(
      PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
      (payload) => {
        const pdfDocument = payload?.pdfDocument || null;
        if (!pdfDocument) {
          throw new Error("[infra-ui] FILE.LOAD.SUCCESS missing pdfDocument");
        }
        pendingPdfDocument = pdfDocument;
      },
      { subscriberId: "InfraUICoordinator.PageInfoInit.FileLoadSuccess" }
    )
  );

  unsubs.push(
    on(
      PDF_VIEWER_EVENTS.RENDER.READY,
      () => {
        const pdfDocument = pendingPdfDocument;
        if (!pdfDocument) {
          return;
        }
        pendingPdfDocument = null;

        const mgr = getPdfViewerManager();
        if (!mgr) {
          throw new Error("[infra-ui] PDFViewerManager missing on RENDER.READY");
        }

        const totalPages = Number(mgr.pagesCount);
        const currentPage = Number(mgr.currentPageNumber);

        if (!Number.isFinite(totalPages) || totalPages <= 0) {
          throw new Error(`[infra-ui] Invalid PDFViewerManager.pagesCount: ${String(mgr.pagesCount)}`);
        }
        if (!Number.isFinite(currentPage) || currentPage <= 0) {
          throw new Error(
            `[infra-ui] Invalid PDFViewerManager.currentPageNumber: ${String(mgr.currentPageNumber)}`
          );
        }

        viewerManager.setPageInfo(currentPage, totalPages);

        const uiZoomControls = getUIZoomControls();
        if (!uiZoomControls || typeof uiZoomControls.updatePageInfo !== "function") {
          throw new Error("[infra-ui] UIZoomControls.updatePageInfo is required");
        }
        uiZoomControls.updatePageInfo(currentPage, totalPages);
        logger.info(
          `[infra-ui] Page info initialized (RENDER.READY): ${currentPage}/${totalPages}`
        );
      },
      { subscriberId: "InfraUICoordinator.PageInfoInit.RenderReady" }
    )
  );

  return unsubs;
}
