import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";

export class EventListeners {
  #ctx;

  constructor(ctx) {
    this.#ctx = ctx;
  }

  onZoomChanged(data) {
    const { logger, zoomManager, getCurrentPdfId, setCurrentPdfId, updateCopyButtonVisibility } = this.#ctx;
    if (zoomManager && typeof data.scale === "number") {
      zoomManager.applyEngineScale(data.scale);
    }
    try {
      if (!getCurrentPdfId() && data && typeof data.filename === "string" && data.filename.trim()) {
        const base = data.filename.replace(/\.[^.]+$/, "");
        if (base) {
          setCurrentPdfId(base);
          updateCopyButtonVisibility();
          logger.info(`[EventListeners] Fallback PDF ID from filename: ${base}`);
        }
      }
    } catch (e) {
      logger.warn("[EventListeners] Fallback PDF ID from filename failed", e);
    }
  }

  onFileLoadRequested() {
    const { viewerManager, domManager } = this.#ctx;
    if (viewerManager) {
      viewerManager.setLoading(true, false);
    }
    domManager.setLoadingState(true);
  }

  onFileLoadSuccess(payload) {
    const { logger, viewerManager, domManager, getPdfViewerManager, getUIZoomControls } = this.#ctx;
    const pdfDocument = payload?.pdfDocument;
    if (viewerManager) {
      viewerManager.setLoading(false, true);
    }
    domManager.setLoadingState(false);

    const pdfViewerManager = getPdfViewerManager();
    if (pdfViewerManager && pdfDocument) {
      logger.info("Loading PDF document into PDFViewerManager");
      pdfViewerManager.load(pdfDocument);

      setTimeout(() => {
        const uiZoomControls = getUIZoomControls();
        const mgr = getPdfViewerManager();
        if (mgr) {
          const totalPages = mgr.pagesCount || pdfDocument.numPages;
          const currentPage = mgr.currentPageNumber || 1;
          if (viewerManager) {
            viewerManager.setPageInfo(currentPage, totalPages);
          }
          if (uiZoomControls) {
            uiZoomControls.updatePageInfo(currentPage, totalPages);
          }
          logger.info(`Page info initialized: ${currentPage}/${totalPages}`);
        }
      }, 100);
    } else {
      logger.warn("Cannot load PDF: pdfViewerManager or pdfDocument is missing");
    }
  }

  onFileLoadFailed(data) {
    const { viewerManager, domManager } = this.#ctx;
    if (viewerManager) {
      viewerManager.setError(data.error?.message || "Load Failed");
    }
    domManager.setLoadingState(false);
  }

  onUrlParamsParsed(data) {
    const { logger, setCurrentPdfId, updateCopyButtonVisibility, getCurrentPdfId, requestPdfTitleFromDB } = this.#ctx;
    logger.info("[EventListeners] URL_PARAMS.PARSED event received:", data);
    if (data?.pdfId) {
      setCurrentPdfId(data.pdfId);
      updateCopyButtonVisibility();
      logger.info(`✅ PDF ID captured and button shown: ${getCurrentPdfId()}`);
      try {
        requestPdfTitleFromDB(getCurrentPdfId());
      } catch (e) {
        logger.error("requestPdfTitleFromDB failed", e);
      }
    } else {
      logger.warn("[EventListeners] URL_PARAMS.PARSED event has no pdfId");
    }
  }

  onWebSocketResponse(message) {
    const { logger, getPendingDetailRequestId, setPendingDetailRequestId, getCurrentPdfId, updateHeaderTitle } = this.#ctx;
    try {
      const type = message?.type || message?.received_type;
      if (type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_COMPLETED) {
        if (getPendingDetailRequestId() && message?.request_id === getPendingDetailRequestId()) {
          setPendingDetailRequestId(null);
        }
        const data = message?.data || {};
        const respId = (data.id || data.pdf_id || "").toString();
        const title = (data.title || "").toString().trim();
        const currentPdfId = getCurrentPdfId();
        if (currentPdfId && respId && respId !== currentPdfId) {
          return;
        }
        if (title) {
          updateHeaderTitle(title);
          logger.info("[EventListeners] 标题已从数据库更新");
        } else {
          logger.error("数据库记录缺少标题，请补全后重试", { toast: { type: "error", ms: 6000 } });
        }
      }
    } catch (e) {
      logger.error("处理详情回执失败", e);
    }
  }

  onWebSocketError(message) {
    const { logger, getPendingDetailRequestId, setPendingDetailRequestId } = this.#ctx;
    try {
      const rid = message?.request_id;
      const type = message?.type || message?.received_type;
      if (!rid || rid !== getPendingDetailRequestId()) {
        return;
      }
      setPendingDetailRequestId(null);
      if (type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
        const msg = message?.message || message?.error?.message || "获取PDF信息失败";
        logger.error(`获取PDF信息失败：${msg}`, { toast: { type: "error", ms: 6000 } });
      }
    } catch (e) {
      logger.error("处理详情失败回执异常", e);
    }
  }
}

export function installUIManagerCoreEventListeners(ctx) {
  const eventListeners = new EventListeners(ctx);
  // All subscriptions are now moved to the coordinator.
  // This function just returns the handler object.
  return { eventListeners, unsubs: [] };
}
