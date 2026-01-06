/**
 * @file pdf-viewer WebSocket 入站桥接工具
 * @description
 * 将部分 WebSocket 消息（outline/anchor 域）转换为 PDF_VIEWER_EVENTS.* 领域事件，
 * 以组合方式供 WebSocketAdapter 调用，避免在适配器类中堆叠复杂分支。
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../common/event/event-constants.js";
import { runWsInboundHandlers } from "../../common/ws/ws-inbound-executor.js";

const inboundHandlers = [
  {
    match: ({ type }) => type.startsWith("pdf-viewer:outline-"),
    handle: ({ message, eventBus, wsClient, logger }) => {
      const type = String(message?.type || "");
      if (type === WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED) {
        try {
          // 去重：同一条 WS message 只允许发射一次 OUTLINE.LOAD.SUCCESS。
          // 说明：WebSocketAdapter 与 OutlineFeature 都可能消费 OUTLINE_LIST_COMPLETED，
          // 这里通过在 message 上打标记实现顺序无关的去重。
          if (message && message.__pdf_outline_load_success_emitted) {
            return;
          }
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

          // 若为 null（统一语义：数据库当前无大纲记录），不在适配器层桥接给 UI，交由 OutlineFeature 执行“从PDF导入→保存→再拉取”流程
          if (data?.outline_items === null) {
            logger.info("[outline] inbound list is null → skip bridging, defer to OutlineFeature");
            return;
          }

          const items = Array.isArray(data?.outline_items) ? data.outline_items
            : (Array.isArray(data?.items) ? data.items : []);
          const normalize = (nodes) => {
            if (!Array.isArray(nodes)) { return []; }
            return nodes.map((n) => ({
              id: String(n.id ?? n.outline_id ?? ""),
              name: String(n.name ?? n.title ?? "(Untitled)"),
              pageAt: Number.isFinite(n.pageAt) ? n.pageAt : (Number.isFinite(n.page_at) ? n.page_at : null),
              position: (typeof n.position === "number") ? n.position
                : (typeof n.y_percent === "number" ? Math.max(0, Math.min(100, Math.round(n.y_percent))) : null),
              children: normalize(n.children || n.items || [])
            }));
          };
          const outlineItems = normalize(items);
          logger.info(`[outline] inbound list → emit OUTLINE.LOAD.SUCCESS (count=${outlineItems.length})`);
          if (message) { message.__pdf_outline_load_success_emitted = true; }
          eventBus.emit(
            PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS,
            { outlineItems, source: "ws-backend" },
            { actorId: "WebSocketAdapter" }
          );
        } catch {
          logger.warn("[outline] list completed handling failed");
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
        // 其他操作完成后主动拉取最新列表
        try {
          const params = new URLSearchParams(window.location.search);
          const pdfId = params.get("pdf-id");
          if (pdfId) {
            wsClient.request(WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
          }
        } catch (e) { logger.warn("[outline] request list after completed failed", e); }
      }
    }
  },
  {
    match: ({ type }) => type.startsWith("anchor:"),
    handle: ({ message, eventBus, wsClient, logger }) => {
      const type = String(message?.type || "");
      if (type.endsWith(":completed")) {
        if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET_COMPLETED || type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST_COMPLETED) {
          const anchors = message?.data?.anchors || (message?.data?.anchor ? [message.data.anchor] : []);
          logger.info("[anchor] inbound completed -> emit ANCHOR.DATA.LOADED", { type, count: Array.isArray(anchors) ? anchors.length : 0 });
          eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, { anchors }, { actorId: "WebSocketAdapter" });
        } else if (type === WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_COMPLETED) {
          const id = message?.data?.uuid || message?.data?.anchor_id || null;
          logger.info("[anchor] create completed", { id });
          try { eventBus.emit(PDF_VIEWER_EVENTS.ANCHOR.CREATED, { anchorId: id }, { actorId: "WebSocketAdapter" }); } catch (e) { logger.warn("[anchor] emit ANCHOR.CREATED failed", e); }

          // 创建成功后刷新列表
          try {
            const params = new URLSearchParams(window.location.search);
            const pdfId = params.get("pdf-id");
            if (pdfId) {
              wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
            }
          } catch (e) { logger.warn("[anchor] request list after create completed failed", e); }
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
          try {
            const params = new URLSearchParams(window.location.search);
            const pdfId = params.get("pdf-id");
            if (pdfId) {
              wsClient.request(WEBSOCKET_MESSAGE_TYPES.ANCHOR_LIST, { pdf_uuid: pdfId }, { metadata: { version: "1.0.0" } });
            }
          } catch (e) { logger.warn("[anchor] request list after completed failed", e); }
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
 */
export function handleViewerWsInbound({ message, eventBus, wsClient, logger }) {
  runWsInboundHandlers({
    message,
    handlers: inboundHandlers,
    eventBus,
    wsClient,
    logger
  });
}
