/* @jest-environment jsdom */
// UTF-8, \n
import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { clearWsGateStatusStore } from "../../../common/ws/ws-gate-status-store.js";

function createAdapter() {
  clearWsGateStatusStore();
  const eventBus = new EventBus({ moduleName: "TestBus" });
  const sent = [];
  const wsClient = {
    send: (msg) => { sent.push(msg); },
    request: jest.fn()
  };
  const adapter = new WebSocketAdapter(wsClient, eventBus, () => "pdf-test-001");
  adapter.setupMessageHandlers();
  adapter.onInitialized();
  return { adapter, eventBus, sent };
}

test("VIEWER_NAVIGATE_REQUESTED without gate executes immediately", () => {
  const { adapter, eventBus } = createAdapter();

  const got = { outlineReq: null };
  const off = eventBus.on(
    PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
    (data) => { got.outlineReq = data; },
    { subscriberId: "test" }
  );

  adapter.handleMessage({
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    data: { target: { type: "outline", outline_item_id: "outlineItem-1" } },
    request_id: "g1"
  });

  expect(got.outlineReq).toEqual({ outlineItemId: "outlineItem-1" });
  off?.();
});

test("VIEWER_NAVIGATE_REQUESTED with gate.once waits for RENDER.READY", async () => {
  const { eventBus, sent } = createAdapter();

  const got = { outlineReq: null };
  const off = eventBus.on(
    PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED,
    (data) => { got.outlineReq = data; },
    { subscriberId: "test" }
  );

  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    request_id: "g2",
    gate: { once: PDF_VIEWER_EVENTS.RENDER.READY, timeout_ms: 200 },
    data: { target: { type: "outline", outline_item_id: "outlineItem-2" } }
  };

  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "ws" });

  // 立刻不应触发导航
  expect(got.outlineReq).toBeNull();

  // 触发 RENDER.READY 后才执行
  eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, { firstPage: 1, totalPages: 10 }, { actorId: "test" });

  // 等待微任务与事件循环
  await new Promise((r) => setTimeout(r, 0));

  expect(got.outlineReq).toEqual({ outlineItemId: "outlineItem-2" });
  // 成功执行后不应发送 GATE_FAILED 回执
  const failed = sent.find(m => m?.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED && m?.request_id === "g2");
  expect(failed).toBeUndefined();

  off?.();
});

test("VIEWER_NAVIGATE_REQUESTED with gate timeout sends VIEWER_NAVIGATE_FAILED", async () => {
  const { eventBus, sent } = createAdapter();

  const message = {
    type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
    request_id: "g3",
    gate: { once: PDF_VIEWER_EVENTS.RENDER.READY, timeout_ms: 10 },
    data: { target: { type: "outline", outline_item_id: "outlineItem-3" } }
  };

  eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "ws" });

  // 等待超时
  await new Promise((r) => setTimeout(r, 30));

  const failed = sent.find(m => m?.type === WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_FAILED && m?.request_id === "g3");
  expect(failed).toBeTruthy();
  expect(failed.error?.code).toBe("GATE_FAILED");
});
