import { SEARCH_EVENTS, WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

export function collectPdfEditFormUpdates({ formComponents }) {
  return {
    title: document.getElementById("edit-title").value.trim(),
    author: document.getElementById("edit-author").value.trim(),
    subject: document.getElementById("edit-subject").value.trim(),
    keywords: document.getElementById("edit-keywords").value.trim(),
    rating: formComponents.rating.getValue(),
    tags: formComponents.tags.getTags(),
    notes: document.getElementById("edit-notes").value.trim(),
  };
}

export async function sendPdfEditRequestToBackend({
  wsClient,
  scopedEventBus,
  fileId,
  updates,
  logger,
}) {
  logger.info("=== Sending edit request to backend ===", { fileId, updates });
  try {
    if (wsClient) {
      await wsClient.request(
        WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
        { file_id: fileId, updates },
        { timeout: 8000, metadata: { version: "1.0.0" } },
      );
      logger.info("PDF record update request sent via WSClient");
      return;
    }

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
      request_id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: { version: "1.0.0" },
      data: { file_id: fileId, updates },
    };
    scopedEventBus.emitGlobal(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: "PDFEditFeature" });
    logger.info("PDF record update emitted via EventBus");
  } catch (error) {
    logger.error("Failed to send edit request:", error);
    try { logger.error("Error details:", error.stack); } catch (e) { void e; }
    throw (error instanceof Error ? error : new Error(error?.message || "编辑请求失败"));
  }
}

export function requestPdfHomeSearchRefreshAfterEdit({ scopedEventBus, logger }) {
  try {
    const input = document.querySelector(".search-input");
    const searchText = (input && typeof input.value === "string") ? input.value.trim() : "";
    scopedEventBus.emitGlobal(SEARCH_EVENTS.QUERY.REQUESTED, { searchText });
  } catch (e) {
    logger?.warn?.("[PDFEditFeature] refresh after edit failed", e);
  }
}

export function runPdfEditSubmitFlow({
  currentRecord,
  formComponents,
  scopedEventBus,
  wsClient,
  logger,
  showInfo,
  showError,
  showSuccess,
  hideModal,
  emitEditStarted,
  getAwaitingSuccess,
  clearAwaitingSuccess,
  setAwaitingTimer,
}) {
  logger.info("=== FORM SUBMIT TRIGGERED ===");
  try {
    const updates = collectPdfEditFormUpdates({ formComponents });

    logger.info("Form data collected:", updates);
    logger.info("Submitting edit for:", currentRecord.pdf_id || currentRecord.id);

    emitEditStarted(updates);
    try { showInfo("更新中", 1200); } catch (e) { void e; }

    (async () => {
      try {
        await sendPdfEditRequestToBackend({
          wsClient,
          scopedEventBus,
          fileId: currentRecord.pdf_id || currentRecord.id,
          updates,
          logger,
        });

        requestPdfHomeSearchRefreshAfterEdit({ scopedEventBus, logger });

        const timer = setTimeout(() => {
          if (getAwaitingSuccess()) {
            clearAwaitingSuccess();
            try { showSuccess("更新完成", 3500); } catch (e) { void e; }
          }
        }, 1200);
        setAwaitingTimer(timer);
      } catch (err) {
        const msg = err?.message || "未知错误";
        try { showError(`更新失败-${msg}`, 5000); } catch (e) { void e; }
      }
    })();

    hideModal();
  } catch (error) {
    logger.error("Form submission failed:", error);
    try { showError(`更新失败-${error?.message || "表单提交异常"}`, 5000); } catch (e) { void e; }
  }
}
