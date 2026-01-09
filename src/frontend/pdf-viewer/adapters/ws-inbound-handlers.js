/**
 * @file ws-inbound-handlers.js
 * @description Centralized inbound WebSocket message handlers for PDF Viewer specific logic.
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { runWithGate } from "../utils/event-gate-runner.js";
import { getWsGateStatusStore } from "../../common/ws/ws-gate-status-store.js";
import { handleLoadPdfFileMessage } from "./websocket-adapter-load-pdf-file.js";
import { handleViewerNavigateMessage } from "./websocket-adapter-viewer-navigate.js";

/**
 * Handles "load_pdf_file" message.
 */
const handleLoadPdfFile = {
  match: ({ type }) => type === "load_pdf_file",
  handle: ({ message, eventBus, logger }) => {
    handleLoadPdfFileMessage({
      data: message.data,
      eventBus,
      logger
    });
  }
};

/**
 * Handles "navigate_page" message.
 */
const handleNavigatePage = {
  match: ({ type }) => type === "navigate_page",
  handle: ({ message, eventBus, logger, pdfIdProvider }) => {
    const { page_number } = message.data;

    if (typeof page_number !== "number") {
      logger.warn("Invalid navigate_page message: page_number must be a number", message.data);
      return;
    }

    const pdfId = pdfIdProvider();
    eventBus.emit(
      PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED,
      { pdfId: pdfId || undefined, pageAt: page_number },
      { actorId: "WebSocketAdapter" }
    );
  }
};

/**
 * Handles "set_zoom" message.
 */
const handleSetZoom = {
  match: ({ type }) => type === "set_zoom",
  handle: ({ message, eventBus, logger }) => {
    const { level, scale } = message.data;

    if (level === undefined && scale === undefined) {
      logger.warn("Invalid set_zoom message: must provide either level or scale", message.data);
      return;
    }

    eventBus.emit(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      { level, scale },
      { actorId: "WebSocketAdapter" }
    );
  }
};

/**
 * Handles "VIEWER_NAVIGATE_REQUESTED" message.
 */
const handleViewerNavigateRequested = {
  match: ({ type }) => type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
  handle: ({ message, eventBus, wsClient, logger, viewerInstanceId, pdfIdProvider }) => {
    const correlationId = message?.request_id || null;
    const eventStatusStore = getWsGateStatusStore(); // Re-use existing gate store

    void runWithGate({
      eventBus,
      store: eventStatusStore,
      rawGate: message?.gate,
      run: async () => {
        handleViewerNavigateMessage({
          message,
          correlationId,
          eventBus,
          wsClient,
          logger,
          viewerInstanceId,
          pdfIdProvider
        });
      }
    }).catch((error) => {
      try {
        logger.warn("[Navigate] gate execution failed", error);
      } catch (e) {
        void e;
      }
      try {
        wsClient.send({
          type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
          request_id: correlationId,
          error: {
            code: "GATE_FAILED",
            message: error?.message || String(error)
          },
          data: { viewer_id: viewerInstanceId }
        });
      } catch (e) {
        logger.warn("[Navigate] failed to send gate failure response", e);
      }
    });
  }
};

export const pdfViewerInboundHandlers = [
  handleLoadPdfFile,
  handleNavigatePage,
  handleSetZoom,
  handleViewerNavigateRequested
];
