import { PDF_VIEWER_EVENTS } from "../../../../../common/event/pdf-viewer-constants.js";

export function installCommentToolPageRendering({
  pdfjsEventBus,
  eventBus,
  logger,
  pdfViewerManager,
  commentMarker,
  flushPendingForPage,
  restoreMarkersForPage
}) {
  const unsubs = [];

  if (!pdfjsEventBus) {
    logger.warn("❌ Cannot setup page rendering listener: pdfjsEventBus not available");
    logger.warn("PDFViewerManager status:", pdfViewerManager);
    return unsubs;
  }

  logger.info("✅ PDF.js EventBus available, setting up page render listeners...");

  const onPdfjsPageRendered = (evt) => {
    const pageNumber = Number(evt?.pageNumber || 0);
    if (!pageNumber) {
      return;
    }
    flushPendingForPage(pageNumber);
    logger.info(`📄 [PageRendered Event] Page ${pageNumber} rendered, restoring markers...`);
    restoreMarkersForPage(pageNumber);
  };

  pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, onPdfjsPageRendered);
  unsubs.push(() => {
    try {
      pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.PAGE.RENDERED, onPdfjsPageRendered);
    } catch (e) {
      void e; /* logger-guard */
    }
  });

  const onScaleChanging = () => {
    try {
      commentMarker?.clear?.();
    } catch (e) {
      void e; /* logger-guard */
    }
  };
  pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, onScaleChanging);
  unsubs.push(() => {
    try {
      pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGING, onScaleChanging);
    } catch (e) {
      void e; /* logger-guard */
    }
  });

  const onScaleChanged = () => {
    try {
      const pn = Number(pdfViewerManager?.currentPageNumber || 0);
      if (pn) {
        restoreMarkersForPage(pn);
      }
    } catch (e) {
      void e; /* logger-guard */
    }
  };
  pdfjsEventBus.on(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, onScaleChanged);
  unsubs.push(() => {
    try {
      pdfjsEventBus.off(PDF_VIEWER_EVENTS.PDFJS_EVENTS.SCALE.CHANGED, onScaleChanged);
    } catch (e) {
      void e; /* logger-guard */
    }
  });

  try {
    const unsub = eventBus.onGlobal(
      PDF_VIEWER_EVENTS.RENDER.PAGE_COMPLETED,
      (data) => {
        const pn = Number(data?.pageNumber || 0);
        if (!pn) {
          return;
        }
        flushPendingForPage(pn);
        logger.info(`📄 [PageRendered Event - bridged] Page ${pn} rendered, restoring markers...`);
        restoreMarkersForPage(pn);
      },
      { subscriberId: "CommentTool" }
    );
    if (typeof unsub !== "function") {
      throw new Error("[CommentTool] eventBus.onGlobal must return an unsubscribe function");
    }
    unsubs.push(unsub);
  } catch (e) {
    logger.warn("[CommentTool] Failed to install bridged render listener", e);
  }

  logger.info("✅ Page rendering listener setup complete");
  return unsubs;
}

