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
  const wsClient = {
    send: jest.fn(),
    request: jest.fn()
  };
  const adapter = new WebSocketAdapter(wsClient, eventBus, () => "pdf-test-001");
  adapter.setupMessageHandlers();
  adapter.onInitialized();
  return { adapter, eventBus, wsClient };
}

test("gate 等待期间 destroy：不触发副作用且不残留定时器", async () => {
  jest.useFakeTimers();
  const { adapter, eventBus, wsClient } = createAdapter();

  const onNavigate = jest.fn();
  eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, onNavigate, { subscriberId: "test" });

  eventBus.emit(
    WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
    {
      type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
      request_id: "gd1",
      gate: { once: PDF_VIEWER_EVENTS.RENDER.READY, timeout_ms: 60_000 },
      data: { target: { type: "outline", outline_item_id: "outlineItem-1" } }
    },
    { actorId: "ws" }
  );

  adapter.destroy();

  if (typeof jest.getTimerCount === "function") {
    expect(jest.getTimerCount()).toBe(0);
  }
  jest.advanceTimersByTime(60_000);
  await Promise.resolve();
  expect(wsClient.send).not.toHaveBeenCalled();

  eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, { ok: true }, { actorId: "test" });
  await Promise.resolve();

  expect(onNavigate).not.toHaveBeenCalled();
  expect(wsClient.send).not.toHaveBeenCalled();

  eventBus.destroy();
  jest.useRealTimers();
});
