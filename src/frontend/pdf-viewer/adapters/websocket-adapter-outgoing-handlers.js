import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { getCurrentPdfIdFromWindow } from "../shared/url-context.js";

export function installWebSocketAdapterOutgoingHandlers({ eventBus, wsClient, logger, subscriptions }) {
  const unsubscribe1 = eventBus.on(
    PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS,
    (data) => {
      logger.debug("File loaded successfully; legacy 'pdf_loaded' message suppressed", {
        filename: data?.filename,
        totalPages: data?.totalPages,
        url: data?.url
      });

      try {
        const pdfId = getCurrentPdfIdFromWindow();
        if (pdfId && typeof pdfId === "string" && pdfId.trim()) {
          const now = Date.now();
          const reqId = `update_visited_${now}_${Math.random().toString(36).slice(2, 8)}`;
          logger.info("[VisitedAt] Updating visited_at for pdf-id", { pdfId, now });
          wsClient.send({
            type: WEBSOCKET_MESSAGE_TYPES.PDF_LIBRARY_RECORD_UPDATE_REQUESTED,
            request_id: reqId,
            metadata: { version: "1.0.0" },
            data: {
              file_id: pdfId,
              updates: {
                visited_at: now,
                json_data: { last_accessed_at: now }
              }
            }
          });
        } else {
          logger.info("[VisitedAt] Skip update: pdf-id not present in URL");
        }
      } catch (e) {
        logger.warn("[VisitedAt] Failed to send visited_at update", e);
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubscribe2 = eventBus.on(
    PDF_VIEWER_EVENTS.NAVIGATION.CHANGED,
    (data) => {
      logger.debug("Page changed, sending notification to backend", data);
      wsClient.send({
        type: "page_changed",
        metadata: { version: "1.0.0" },
        data: {
          page_number: data.pageNumber,
          total_pages: data.totalPages
        }
      });
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubscribe3 = eventBus.on(
    PDF_VIEWER_EVENTS.ZOOM.CHANGED,
    (data) => {
      logger.debug("Zoom changed, sending notification to backend", data);
      wsClient.send({
        type: "zoom_changed",
        metadata: { version: "1.0.0" },
        data: {
          level: data.level,
          scale: data.scale
        }
      });
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const getPdfId = () => getCurrentPdfIdFromWindow();

  const unsubA1 = eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
    (data) => {
      try {
        const anchorId = data?.anchorId || null;
        const pdfId = data?.pdf_uuid || getPdfId();

        if (!pdfId) {
          logger.warn("[anchor] load aborted: missing pdf_uuid", { anchorId: anchorId || undefined });
          try {
            eventBus.emit(
              PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED,
              { error: { message: "缺少 pdf_uuid" } },
              { actorId: "WebSocketAdapter" }
            );
          } catch (e) {
            logger.warn("[anchor] emit ANCHOR.DATA.LOAD_FAILED failed (missing pdf_uuid path)", e);
          }
          return;
        }

        if (anchorId) {
          wsClient.request(
            WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET,
            { anchor_id: anchorId, pdf_uuid: pdfId },
            { metadata: { version: "1.0.0" } }
          );
        } else {
          wsClient.request(
            WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST,
            { pdf_uuid: pdfId },
            { metadata: { version: "1.0.0" } }
          );
        }
      } catch (e) {
        logger.warn("ANCHOR.DATA.LOAD bridge failed", e);
        try {
          eventBus.emit(
            PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED,
            { error: { message: e?.message || String(e) } },
            { actorId: "WebSocketAdapter" }
          );
        } catch (emitErr) {
          logger.warn("[anchor] emit ANCHOR.DATA.LOAD_FAILED failed (exception path)", emitErr);
        }
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubA2 = eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.CREATE,
    (data) => {
      const pdfId = data?.pdf_uuid || getPdfId();
      let anchor = data?.anchor;
      if (!anchor) {
        return;
      }
      try {
        const fromFeature = data && data.__fromFeature === true;
        const hasValidId = typeof anchor.uuid === "string" && /^pdfanchor-[a-f0-9]{12}$/i.test(anchor.uuid);
        if (!fromFeature && !hasValidId) {
          return;
        }
        if (!pdfId) {
          logger.warn("[anchor] create aborted: missing pdf_uuid", { source: fromFeature ? "feature" : "ui" });
          try {
            eventBus.emit(
              PDF_VIEWER_EVENTS.ANCHOR.CREATE_FAILED,
              { error: { message: "缺少 pdf_uuid" } },
              { actorId: "WebSocketAdapter" }
            );
          } catch (e) {
            logger.warn("[anchor] emit CREATE_FAILED failed (missing pdf_uuid path)", e);
          }
          return;
        }
        if (typeof anchor.position === "number") {
          anchor = { ...anchor, position: (anchor.position > 1 ? (anchor.position / 100) : anchor.position) };
        }
        logger.info("[anchor] create → WS request", { pdf_uuid: pdfId, id: anchor.uuid, name: anchor.name, page_at: anchor.page_at });
        wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE,
          { pdf_uuid: pdfId, anchor },
          { metadata: { version: "1.0.0" } }
        );
      } catch (e) {
        logger.warn("[anchor] create request failed", e);
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubA3 = eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.UPDATE,
    (data) => {
      const id = data?.anchorId || data?.uuid;
      let update = data?.update;
      if (!id || !update) {
        return;
      }
      try {
        if (typeof update.position === "number") {
          update = { ...update, position: (update.position > 1 ? (update.position / 100) : update.position) };
        }
        wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.ANCHOR_UPDATE,
          { anchor_id: id, update },
          { metadata: { version: "1.0.0" } }
        );
      } catch (e) {
        logger.warn("[anchor] update request failed", e);
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubA4 = eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.DELETE,
    (data) => {
      const id = data?.anchorId || data?.uuid;
      if (!id) {
        return;
      }
      try {
        wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_DELETE, { anchor_id: id }, { metadata: { version: "1.0.0" } });
      } catch (e) {
        logger.warn("[anchor] delete request failed", e);
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  const unsubA5 = eventBus.on(
    PDF_VIEWER_EVENTS.ANCHOR.ACTIVATE,
    (data) => {
      const id = data?.anchorId || data?.uuid;
      if (!id) {
        return;
      }
      const active = !!data?.active;
      try {
        wsClient.request(
          WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE,
          { anchor_id: id, active },
          { metadata: { version: "1.0.0" } }
        );
      } catch (e) {
        logger.warn("[anchor] activate request failed", e);
      }
    },
    { subscriberId: "WebSocketAdapter" }
  );

  subscriptions.add(unsubscribe1);
  subscriptions.add(unsubscribe2);
  subscriptions.add(unsubscribe3);
  subscriptions.add(unsubA1);
  subscriptions.add(unsubA2);
  subscriptions.add(unsubA3);
  subscriptions.add(unsubA4);
  subscriptions.add(unsubA5);
}
