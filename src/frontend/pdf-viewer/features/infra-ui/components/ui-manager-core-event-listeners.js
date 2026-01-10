import { WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";

export class EventListeners {
  #ctx;
  #pendingPageInfoInit = null; // { pdfDocument: any } | null

  constructor(ctx) {
    this.#ctx = ctx;
  }

  onZoomChanged(data) {
    const { logger, zoomManager, getCurrentPdfId } = this.#ctx;
    if (zoomManager && typeof data.scale === "number") {
      zoomManager.applyEngineScale(data.scale);
    }
    try {
      if (!getCurrentPdfId() && data && typeof data.filename === "string" && data.filename.trim()) {
        // 禁止兜底：filename→pdfId 的隐式推断会制造“悄悄吞错”的回潮点
        logger.error(
          "[EventListeners] Missing pdfId: filename fallback is forbidden",
          { filename: data.filename },
          { toast: { type: "error", ms: 6000 } }
        );
      }
    } catch (e) {
      logger.warn("[EventListeners] Missing pdfId guard failed", e);
    }
  }

  onFileLoadRequested() {
    const { viewerManager, domManager } = this.#ctx;
    this.#pendingPageInfoInit = null;
    if (viewerManager) {
      viewerManager.setLoading(true, false);
    }
    domManager.setLoadingState(true);
  }

  onFileLoadSuccess(payload) {
    const { logger, viewerManager, domManager, getPdfViewerManager } = this.#ctx;
    const pdfDocument = payload?.pdfDocument;
    if (viewerManager) {
      viewerManager.setLoading(false, true);
    }
    domManager.setLoadingState(false);

    const pdfViewerManager = getPdfViewerManager();
    if (pdfViewerManager && pdfDocument) {
      logger.info("Loading PDF document into PDFViewerManager");
      pdfViewerManager.load(pdfDocument);

      // 基于明确事件进行一次性初始化（避免 setTimeout 竞态）
      this.#pendingPageInfoInit = { pdfDocument };
    } else {
      logger.warn("Cannot load PDF: pdfViewerManager or pdfDocument is missing");
    }
  }

  onFileLoadFailed(data) {
    const { viewerManager, domManager } = this.#ctx;
    this.#pendingPageInfoInit = null;
    if (viewerManager) {
      viewerManager.setError(data.error?.message || "Load Failed");
    }
    domManager.setLoadingState(false);
  }

  onRenderReady(data) {
    const { logger, viewerManager, getPdfViewerManager, getUIZoomControls } = this.#ctx;
    const pending = this.#pendingPageInfoInit;
    if (!pending) {
      return;
    }
    this.#pendingPageInfoInit = null;

    const mgr = getPdfViewerManager();
    if (!mgr) {
      logger.error("[EventListeners] PDFViewerManager missing on RENDER.READY");
      return;
    }

    const pdfDocument = pending.pdfDocument;
    const totalPages = mgr.pagesCount || Number(data?.totalPages || 0) || pdfDocument?.numPages || 0;
    const currentPage = mgr.currentPageNumber || Number(data?.firstPage || 0) || 1;

    if (viewerManager) {
      viewerManager.setPageInfo(currentPage, totalPages);
    }
    const uiZoomControls = getUIZoomControls();
    if (uiZoomControls) {
      uiZoomControls.updatePageInfo(currentPage, totalPages);
    }
    logger.info(`Page info initialized (RENDER.READY): ${currentPage}/${totalPages}`);
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
