import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { getCurrentPdfIdFromWindow } from "../shared/url-context.js";

export function handleViewerNavigateMessage({
  message,
  correlationId,
  eventBus,
  wsClient,
  logger,
  viewerInstanceId
}) {
  try {
    const to = message?.to || {};
    const data = message?.data || {};

    logger.info("[Navigate] 收到导航请求", {
      to: to,
      data_target: data?.target,
      request_id: correlationId,
      has_to_field: !!message?.to,
      has_data_field: !!message?.data
    });

    if (to.viewer_id || to.pdf_uuid) {
      logger.warn(
        "[Navigate] 收到已废弃的旧协议字段（viewer_id/pdf_uuid），建议迁移到新协议（client_id/routing_key）",
        { deprecated_fields: { viewer_id: to.viewer_id, pdf_uuid: to.pdf_uuid } }
      );

      const targetViewer = to.viewer_id || null;
      const targetPdf = to.pdf_uuid || null;

      if (targetViewer && targetViewer !== viewerInstanceId) {
        logger.warn("[Navigate] ignore message: viewer_id mismatch", { targetViewer, self: viewerInstanceId });
        wsClient.send({
          type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
          request_id: correlationId,
          error: {
            code: "VIEWER_ID_MISMATCH",
            message: "navigate ignored: viewer_id mismatch",
            target: String(targetViewer),
            self: String(viewerInstanceId)
          },
          data: { viewer_id: viewerInstanceId }
        });
        return;
      }

      const currentPdf = getCurrentPdfIdFromWindow();
      if (targetPdf && currentPdf && targetPdf !== currentPdf) {
        logger.warn("[Navigate] ignore message: pdf_uuid mismatch", { targetPdf, currentPdf });
        wsClient.send({
          type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
          request_id: correlationId,
          error: {
            code: "PDF_UUID_MISMATCH",
            message: "navigate ignored: pdf_uuid mismatch",
            target: String(targetPdf),
            current: String(currentPdf)
          },
          data: { viewer_id: viewerInstanceId, pdf_uuid: currentPdf }
        });
        return;
      }
    }

    const targetClientId = to.client_id || null;
    const routingKey = to.routing_key || null;

    if (targetClientId) {
      const currentPdf = getCurrentPdfIdFromWindow();
      const currentClientId = currentPdf ? `pdf-viewer-${currentPdf}` : null;

      if (currentClientId && targetClientId !== currentClientId) {
        logger.debug(
          "[Navigate] 消息目标不匹配，忽略（client_id 不匹配）",
          { target: targetClientId, current: currentClientId }
        );
        return;
      }

      logger.debug("[Navigate] 路由验证通过（client_id 匹配）", { client_id: targetClientId });
    } else if (routingKey) {
      logger.debug("[Navigate] 使用资源路由（routing_key）", { routing_key: routingKey });
    } else {
      logger.warn("[Navigate] 消息缺少路由字段（client_id 和 routing_key 都为空），假定为广播消息");
    }

    const mode = data?.target?.type || data?.mode || "page";
    const opts = data?.options || {};

    if (mode === "annotation") {
      const annotationId = data?.target?.annotation_id || data?.annotation_id;
      if (!annotationId) {
        throw new Error("annotation_id required for annotation mode");
      }
      try {
        logger.info(`[WS] 导航·标注：请求跳转 id=${annotationId}`, { toast: { type: "info", ms: 2000 } });
      } catch (e) {
        void e;
      }
      eventBus.emit(
        PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED,
        { id: annotationId, highlight: !!opts.highlight },
        { actorId: "WebSocketAdapter" }
      );
    } else if (mode === "anchor") {
      const anchorId = data?.target?.anchor_id || data?.anchor_id;
      if (!anchorId) {
        throw new Error("anchor_id required for anchor mode");
      }
      try {
        logger.info(`[WS] 导航·锚点：请求跳转 id=${anchorId}`, { toast: { type: "info", ms: 2000 } });
      } catch (e) {
        void e;
      }
      eventBus.emit(
        PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
        { anchorId },
        { actorId: "WebSocketAdapter" }
      );
    } else if (mode === "outline") {
      const outlineItemId =
        data?.target?.outline_item_id ||
        data?.outline_item_id ||
        data?.target?.id ||
        data?.id;
      if (!outlineItemId) {
        throw new Error("outline_item_id/id required for outline mode");
      }
      try {
        logger.info(`[WS] 导航·大纲：请求跳转 id=${outlineItemId}`, { toast: { type: "info", ms: 2000 } });
      } catch (e) {
        void e;
      }
      eventBus.emit(
        PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
        { outlineItemId },
        { actorId: "WebSocketAdapter" }
      );
    } else if (mode === "page" || mode === "xy") {
      const pageNumber = Number(data?.target?.page_number ?? data?.page_number);
      if (!Number.isFinite(pageNumber)) {
        throw new Error("page_number must be a number");
      }
      try {
        logger.info(`[WS] 导航·页面：跳转第 ${pageNumber} 页`, { toast: { type: "info", ms: 2000 } });
      } catch (e) {
        void e;
      }
      const pos = data?.target?.position || data?.position || null;
      let positionPercent = null;
      if (pos && typeof pos === "object" && typeof pos.y_percent === "number") {
        positionPercent = pos.y_percent;
      } else if (typeof pos === "number" && pos >= 0 && pos <= 100) {
        positionPercent = pos;
      }
      const req = { pageAt: pageNumber };
      const pdfId = to?.pdf_uuid || getCurrentPdfIdFromWindow();
      if (pdfId) {
        req.pdfId = pdfId;
      }
      if (positionPercent !== null) {
        req.position = positionPercent;
      }
      eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.URL_PARAMS.REQUESTED, req, { actorId: "WebSocketAdapter" });
    } else {
      throw new Error(`unsupported navigate mode: ${mode}`);
    }

    wsClient.send({
      type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_COMPLETED,
      request_id: correlationId,
      data: { viewer_id: viewerInstanceId }
    });
  } catch (error) {
    logger.error("[Navigate] failed", error);
    wsClient.send({
      type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED,
      request_id: correlationId,
      error: { message: error?.message || String(error) },
      data: { viewer_id: viewerInstanceId }
    });
  }
}

