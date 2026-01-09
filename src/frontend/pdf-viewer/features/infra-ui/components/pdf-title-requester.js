import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../../common/event/event-constants.js";
import { showError } from "../../../../common/utils/notification.js";

export function requestPdfTitleFromDB({
  eventBus,
  logger,
  pdfId,
  setPendingDetailRequestId,
}) {
  if (!pdfId || typeof pdfId !== "string" || !pdfId.trim()) {
    logger.error("[UIManagerCore] 无法请求标题：缺少有效 pdfId");
    showError("❌ 缺少有效的 PDF ID，无法获取标题", 5000);
    return;
  }

  const rid = `info_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  setPendingDetailRequestId(rid);

  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.PDF_DETAIL_REQUEST,
    request_id: rid,
    metadata: { version: "1.0.0" },
    data: { pdf_id: pdfId },
  };

  logger.info("[UIManagerCore] 请求数据库标题", { pdfId, request_id: rid });
  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.SEND, message, { actorId: "UIManagerCore" });
}

