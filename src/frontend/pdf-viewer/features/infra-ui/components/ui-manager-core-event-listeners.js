import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import {
  WEBSOCKET_MESSAGE_EVENTS,
  WEBSOCKET_MESSAGE_TYPES,
} from "../../../../common/event/event-constants.js";

export function installUIManagerCoreEventListeners(ctx) {
  const {
    eventBus,
    logger,
    viewerManager, // New
    zoomManager,   // New
    domManager,
    getPdfViewerManager,
    getUIZoomControls,
    getCurrentPdfId,
    setCurrentPdfId,
    getPendingDetailRequestId,
    setPendingDetailRequestId,
    updateCopyButtonVisibility,
    requestPdfTitleFromDB,
    updateHeaderTitle,
  } = ctx;

  const unsubs = [];

  // 缩放变更事件
  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.ZOOM.CHANGED,
    (data) => {
      if (zoomManager && typeof data.scale === "number") {
        zoomManager.setScale(data.scale);
      }

      // Fallback: 从文件名回填 pdfId（仅当 URL 尚未提供时）
      try {
        if (!getCurrentPdfId() && data && typeof data.filename === "string" && data.filename.trim()) {
          const base = data.filename.replace(/\.[^.]+$/, "");
          if (base) {
            setCurrentPdfId(base);
            updateCopyButtonVisibility();
            logger.info(`[UIManagerCore] Fallback PDF ID from filename: ${base}`);
          }
        }
      } catch (e) {
        logger.warn("[UIManagerCore] Fallback PDF ID from filename failed", e);
      }
    },
    { subscriberId: "UIManagerCore" }
  ));

  // 加载请求事件
  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.FILE.LOAD.REQUESTED,
    () => {
      if (viewerManager) {
        viewerManager.setLoading(true, false);
      }
      domManager.setLoadingState(true);
    },
    { subscriberId: "UIManagerCore" }
  ));

  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
    (payload) => {
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

            // Update State
            if (viewerManager) {
              viewerManager.setPageInfo(currentPage, totalPages);
            }

            // Update UI (Legacy direct drive)
            if (uiZoomControls) {
              uiZoomControls.updatePageInfo(currentPage, totalPages);
            }

            logger.info(`Page info initialized: ${currentPage}/${totalPages}`);
          }
        }, 100);
      } else {
        logger.warn("Cannot load PDF: pdfViewerManager or pdfDocument is missing");
      }
    },
    { subscriberId: "UIManagerCore" }
  ));

  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.FILE.LOAD.FAILED,
    (data) => {
      if (viewerManager) {
        viewerManager.setError(data.error?.message || "Load Failed");
      }
      // Also notify DOMManager directly for now (View Logic)
      // Ideally DOMManager subscribes to ViewerManager
      // But UIManagerCore handles DOMManager.
      // UIManagerCore logic: domManager.setLoadingState(false)
      domManager.setLoadingState(false);
      // domManager doesn't have showError?
      // UIManagerCore has showError. But here we don't have reference to UIManagerCore instance.
      // We have domManager.
      // Let's assume UIManagerCore subscribes to ViewerManager error state to show it.
    },
    { subscriberId: "UIManagerCore" }
  ));

  // 监听 URL 参数解析事件，获取 pdf-id
  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.PARSED,
    (data) => {
      logger.info("[UIManagerCore] URL_PARAMS.PARSED event received:", data);
      if (data?.pdfId) {
        setCurrentPdfId(data.pdfId);
        updateCopyButtonVisibility();
        logger.info(`✅ PDF ID captured and button shown: ${getCurrentPdfId()}`);
        try { requestPdfTitleFromDB(getCurrentPdfId()); } catch (e) { logger.error("requestPdfTitleFromDB failed", e); }
      } else {
        logger.warn("[UIManagerCore] URL_PARAMS.PARSED event has no pdfId");
      }
    },
    { subscriberId: "UIManagerCore" }
  ));

  // 监听 WS 回执：严格匹配 request_id，仅处理当前 pending 的详情回执
  unsubs.push(eventBus.on(
    WEBSOCKET_MESSAGE_EVENTS.RESPONSE,
    (message) => {
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
            logger.info("[UIManagerCore] 标题已从数据库更新");
          } else {
            logger.error("数据库记录缺少标题，请补全后重试", { toast: { type: "error", ms: 6000 } });
          }
        }
      } catch (e) {
        logger.error("处理详情回执失败", e);
      }
    },
    { subscriberId: "UIManagerCore" }
  ));

  unsubs.push(eventBus.on(
    WEBSOCKET_MESSAGE_EVENTS.ERROR,
    (message) => {
      try {
        const rid = message?.request_id;
        const type = message?.type || message?.received_type;
        if (!rid || rid !== getPendingDetailRequestId()) {return;}
        setPendingDetailRequestId(null);
        if (type === WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_FAILED) {
          const msg = message?.message || message?.error?.message || "获取PDF信息失败";
          logger.error(`获取PDF信息失败：${msg}`, { toast: { type: "error", ms: 6000 } });
        }
      } catch (e) {
        logger.error("处理详情失败回执异常", e);
      }
    },
    { subscriberId: "UIManagerCore" }
  ));

  return unsubs;
}
