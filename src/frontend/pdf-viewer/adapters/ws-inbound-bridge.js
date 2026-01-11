/**
 * @file pdf-viewer WebSocket 入站桥接工具
 * @description
 * 将部分 WebSocket 消息（outline/anchor 域）转换为 PDF_VIEWER_EVENTS.* 领域事件，
 * 以组合方式供 WebSocketAdapter 调用，避免在适配器类中堆叠复杂分支。
 */

import { runWsInboundHandlers } from "../../common/ws/ws-inbound-executor.js";
import { pdfViewerInboundHandlers } from "./ws-inbound-handlers.js";
import { pdfViewerInboundDomainHandlers } from "./ws-inbound-domain-handlers.js";
import { setInboundDestroySignal } from "./ws-inbound-destroy-signal.js";

/**
 * 处理 pdf-viewer 相关的 WS 入站消息（outline / anchor 域）。
 *
 * @param {Object} params
 * @param {any} params.message
 * @param {import("../../common/event/event-bus.js").EventBus} params.eventBus
 * @param {import("../../common/ws/ws-client.js").WSClient} params.wsClient
 * @param {import("../../common/utils/logger.js").Logger} params.logger
 * @param {() => string | null} params.pdfIdProvider
 * @param {AbortSignal} params.destroySignal
 */
export function handleViewerWsInbound({ message, eventBus, wsClient, logger, pdfIdProvider, destroySignal }) {
  setInboundDestroySignal(eventBus, destroySignal || null);

  runWsInboundHandlers({
    message,
    handlers: [...pdfViewerInboundHandlers, ...pdfViewerInboundDomainHandlers],
    eventBus,
    wsClient,
    logger,
    pdfIdProvider
  });
}
