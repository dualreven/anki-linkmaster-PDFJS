/* @jest-environment jsdom */
// UTF-8, \n
import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

function createAdapterWith(wsUrlPdfId = "jest-pdf") {
  const eventBus = new EventBus({ moduleName: "TestBus" });
  // minimal wsClient with send spy
  const sent = [];
  const wsClient = { send: (msg) => { sent.push(msg); } };
  // set URL ?pdf-id=
  try { window.history.pushState({}, "", `/?pdf-id=${wsUrlPdfId}`); } catch {}
  const adapter = new WebSocketAdapter(wsClient, eventBus);
  adapter.setupMessageHandlers();
  adapter.onInitialized();
  return { adapter, eventBus, sent };
}

test("client_id mismatch should silently ignore (multicast filter)", () => {
  const { eventBus, sent } = createAdapterWith("pdf-A");
  // ✅ 新协议：to 在顶层，client_id 不匹配
  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    request_id: "rid-1",
    to: {
      client_id: "pdf-viewer-pdf-B",  // 不匹配当前 viewer (pdf-A)
      target_type: "pdf-viewer",
      routing_key: "pdf:pdf-B"
    },
    data: {
      target: { type: "outline", outline_item_id: "outlineItem-XYZ" }
    }
  };
  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "ws" });

  // ✅ 预期：组播场景下静默忽略，不发送错误（避免污染日志）
  const failed = sent.find(m => m?.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED && m?.request_id === "rid-1");
  expect(failed).toBeUndefined();
});

test("[DEPRECATED] viewer_id mismatch should send VIEWER_NAVIGATE_FAILED (backward compat)", () => {
  const { eventBus, sent } = createAdapterWith("pdf-A");
  // ⚠️ 旧协议：仍然支持但会给出警告
  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    request_id: "rid-1-old",
    to: {
      viewer_id: "other_viewer",  // 旧字段
      pdf_uuid: "pdf-A"           // 旧字段
    },
    data: {
      target: { type: "outline", outline_item_id: "outlineItem-XYZ" }
    }
  };
  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "ws" });
  const failed = sent.find(m => m?.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED && m?.request_id === "rid-1-old");
  expect(failed).toBeTruthy();
  expect(failed?.error?.code).toBe("VIEWER_ID_MISMATCH");
});

test("[DEPRECATED] pdf_uuid mismatch should send VIEWER_NAVIGATE_FAILED (backward compat)", () => {
  const { eventBus, sent } = createAdapterWith("pdf-A");
  // ⚠️ 旧协议：仍然支持但会给出警告
  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    request_id: "rid-2",
    to: {
      pdf_uuid: "pdf-B"  // 旧字段
    },
    data: {
      target: { type: "outline", outline_item_id: "outlineItem-XYZ" }
    }
  };
  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "ws" });
  const failed = sent.find(m => m?.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED && m?.request_id === "rid-2");
  expect(failed).toBeTruthy();
  expect(failed?.error?.code).toBe("PDF_UUID_MISMATCH");
});
