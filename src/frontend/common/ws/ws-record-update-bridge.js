/**
 * @file WebSocket record-update → 领域事件桥接工具
 * @description
 * 将 pdf-library:record-update:completed/failed 映射为
 * PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED/FAILED 领域事件。
 */

import {
  WEBSOCKET_MESSAGE_TYPES,
  PDF_MANAGEMENT_EVENTS
} from "../event/event-constants.js";

/**
 * 将 record-update WS 消息桥接为 PDF 管理领域事件。
 *
 * @param {Object} params
 * @param {any} params.message - WebSocket 响应 payload（通常为 handleResponse(data) 中的 data）
 * @param {import("../event/event-bus.js").EventBus} params.eventBus
 * @param {import("../utils/logger.js").Logger} params.logger
 */
export function bridgeRecordUpdateMessage({ message, eventBus, logger }) {
  try {
    const respType = message?.type || message?.data?.type || null;

    if (respType === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_COMPLETED) {
      const payload = message?.data || {};
      const pdfId = payload?.pdf_id || payload?.id || null;
      logger.info("[WebSocketHandler] record-update completed", { pdfId });
      eventBus.emit(
        PDF_MANAGEMENT_EVENTS.EDIT.COMPLETED,
        { pdfId, payload },
        { actorId: "PDFManager" }
      );
    } else if (respType === WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_FAILED) {
      const payload = message?.data || {};
      const pdfId = payload?.pdf_id || payload?.id || null;
      const errorMessage =
        payload?.message ||
        message?.message ||
        payload?.error?.message ||
        "更新失败";
      logger.warn("[WebSocketHandler] record-update failed", { pdfId, errorMessage });
      eventBus.emit(
        PDF_MANAGEMENT_EVENTS.EDIT.FAILED,
        { pdfId, errorMessage, payload },
        { actorId: "PDFManager" }
      );
    }
  } catch (e) {
    logger.warn("[WebSocketHandler] record-update mapping failed", e);
  }
}

