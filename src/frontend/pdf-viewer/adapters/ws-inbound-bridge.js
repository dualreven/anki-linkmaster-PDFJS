/**
 * @file pdf-viewer WebSocket 入站桥接工具
 * @description
 * 将部分 WebSocket 消息（outline/anchor 域）转换为 PDF_VIEWER_EVENTS.* 领域事件，
 * 以组合方式供 WebSocketAdapter 调用，避免在适配器类中堆叠复杂分支。
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { runWsInboundHandlers } from "../../common/ws/ws-inbound-executor.js";
import { shouldEmitWsInboundDomainEventOnce } from "./ws-inbound-bridge-contract.js";
import { pdfViewerInboundHandlers } from "./ws-inbound-handlers.js";
import { setInboundDestroySignal } from "./ws-inbound-destroy-signal.js";

const domainInboundHandlers = [
  {
    match: ({ type }) => type.startsWith("pdf-viewer:outline-"),
    handle: ({ message, eventBus, wsClient, logger, pdfIdProvider }) => {
      const type = String(message?.type || "");
      if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
        try {
          const data = message?.data || {};
          // 诊断：记录原始 outline_items 的类型与取值片段，便于确认后端回包
          try {
            const raw = data?.outline_items;
            const rawType = raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw;
            const rawPreview = (() => {
              try { return JSON.stringify(raw)?.slice(0, 200); } catch (e) {
                // logger-guard
                void e;
                return String(raw);
              }
            })();
            logger.info(`[outline] inbound list (raw) outline_items_type=${rawType} preview=${rawPreview}`);
          } catch (e) { void e; }

          // 若为 null（统一语义：数据库当前无大纲记录），桥接为 OUTLINE.LOAD.EMPTY，交由 OutlineFeature 执行“从PDF导入→保存→再拉取”流程
          if (data?.outline_items === null) {
            logger.info("[outline] inbound list is null → emit OUTLINE.LOAD.EMPTY");
            if (shouldEmitWsInboundDomainEventOnce({ message, eventName: PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY })) {
              eventBus.emit(
                PDF_VIEWER_EVENTS.OUTLINE.LOAD.EMPTY,
                { source: "ws-backend" },
                { actorId: "WebSocketAdapter" }
              );
            }
            return;
          }

          const items = Array.isArray(data?.outline_items) ? data.outline_items
            : (Array.isArray(data?.items) ? data.items : []);
          const normalize = (nodes) => {
            if (!Array.isArray(nodes)) { return []; }
            const clampInt = (value, min, max) => {
              if (typeof value !== "number" || !Number.isFinite(value)) { return null; }
              const v = Math.round(value);
              return Math.max(min, Math.min(max, v));
            };
            const normalizePageAt = (value) => {
              const v = Number(value);
              if (!Number.isFinite(v)) { return 1; }
              return Math.max(1, Math.trunc(v));
            };
            return nodes.map((n) => ({
              id: String(n.id ?? n.outline_id ?? "").trim(),
              name: String(n.name ?? n.title ?? "(Untitled)").trim(),
              pageAt: normalizePageAt(n.pageAt ?? n.page_at ?? 1),
              position: clampInt(
                (typeof n.position === "number") ? n.position
                  : (typeof n.y_percent === "number" ? n.y_percent : null),
                0,
                100
              ),
              children: normalize(n.children || n.items || [])
            }));
          };
          const outlineItems = normalize(items);
          logger.info(`[outline] inbound list → emit OUTLINE.LOAD.SUCCESS (count=${outlineItems.length})`);
          if (shouldEmitWsInboundDomainEventOnce({ message, eventName: PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS })) {
            eventBus.emit(
              PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
              { outlineItems, source: "ws-backend" },
              { actorId: "WebSocketAdapter" }
            );
          }
        } catch {
          logger.warn("[outline] list completed handling failed");
        }
      } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_FAILED) {
        const err = message?.error || message?.data?.error || message?.data || { message: "unknown error" };
        logger.warn("[outline] inbound list failed -> emit OUTLINE.LOAD.FAILED", { err: err?.message || err });
        if (shouldEmitWsInboundDomainEventOnce({ message, eventName: PDF_VIEWER_EVENTS.OUTLINE.LOAD.FAILED })) {
          eventBus.emit(
            PDF_VIEWER_EVENTS.OUTLINE.LOAD.FAILED,
            { error: err, type, source: "ws-backend" },
            { actorId: "WebSocketAdapter" }
          );
        }
      } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_UPDATE_FAILED) {
        const err = message?.error || message?.data || { message: "unknown" };
        logger.error("[outline] update failed", err, { toast: { type: "error", ms: 5000 } });
      } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE_FAILED) {
        const err = message?.error || message?.data || { message: "unknown" };
        logger.error("[outline] create failed", err, { toast: { type: "error", ms: 5000 } });
      } else if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_DELETE_FAILED) {
        const err = message?.error || message?.data || { message: "unknown" };
        logger.error("[outline] delete failed", err, { toast: { type: "error", ms: 5000 } });
      } else if (type.endsWith(":complete")) {
        // bulk-save 完成后由 OutlineFeature 的 init flow 主动拉取列表，避免重复请求
        if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_BULK_SAVE_COMPLETED) {
          return;
        }
        // 其他操作完成后主动拉取最新列表
        const pdfId = pdfIdProvider();
        wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
      }
    }
  },
  {
    match: ({ type }) => type.startsWith("anchor:"),
    handle: ({ message, eventBus, wsClient, logger, pdfIdProvider }) => {
      const type = String(message?.type || "");
      if (type.endsWith(":completed")) {
        if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET_COMPLETED || type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_COMPLETED) {
          const anchors = message?.data?.anchors || (message?.data?.anchor ? [message.data.anchor] : []);
          logger.info("[anchor] inbound completed -> emit ANCHOR.DATA.LOADED", { type, count: Array.isArray(anchors) ? anchors.length : 0 });
          if (shouldEmitWsInboundDomainEventOnce({ message, eventName: PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED })) {
            eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "WebSocketAdapter" });
          }
        } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_COMPLETED) {
          const id = message?.data?.uuid || message?.data?.anchor_id || null;
          logger.info("[anchor] create completed", { id });
          try { eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATED, { anchorId: id }, { actorId: "WebSocketAdapter" }); } catch (e) { logger.warn("[anchor] emit ANCHOR.CREATED failed", e); }

          // 创建成功后刷新列表
          const pdfId = pdfIdProvider();
          wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_ACTIVATE_COMPLETED) {
          // 更新当前项状态：仅通过 ANCHOR.ACTIVATED 通知前端，由特性层维护单选语义
          try {
            const id = message?.data?.anchor_id || message?.data?.uuid || null;
            const active = !!(message?.data?.active ?? true);
            if (id) {
              eventBus.emit(
                PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
                { anchorId: String(id), active },
                { actorId: "WebSocketAdapter" }
              );
            }
          } catch {
            logger.warn("anchor activate inbound mapping failed");
          }
        } else {
          // 其他完成事件后请求刷新列表（若可获取pdfId）
          const pdfId = pdfIdProvider();
          wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
        }
      } else if (type.endsWith(":failed")) {
        if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET_FAILED || type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_FAILED) {
          const err = message?.error || message?.data?.error || message?.data || { message: "unknown error" };
          logger.warn("[anchor] inbound failed -> emit ANCHOR.DATA.LOAD_FAILED", { type, err: (err?.message || err) });
          eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED, { error: err, type }, { actorId: "WebSocketAdapter" });
        } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_FAILED) {
          const err = message?.error || message?.data?.error || message?.data || { message: "unknown error" };
          logger.warn("[anchor] create failed", { err: (err?.message || err) });
          try { eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATE_FAILED, { error: err }, { actorId: "WebSocketAdapter" }); } catch (e) { logger.warn("[anchor] emit ANCHOR.CREATE_FAILED failed", e); }
        }
      }
    }
  }
];

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
    handlers: [...pdfViewerInboundHandlers, ...domainInboundHandlers],
    eventBus,
    wsClient,
    logger,
    pdfIdProvider
  });
}
