import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";
import * as wsInboundBridge from "../ws-inbound-bridge.js";

describe("WebSocketAdapter - inbound uninstall regression", () => {
  let eventBus;
  let wsClient;
  let pdfIdProvider;
  let adapter;
  let inboundSpy;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });
    wsClient = { send: jest.fn(), request: jest.fn() };
    pdfIdProvider = jest.fn(() => "mock-pdf-id-123");

    inboundSpy = jest.spyOn(wsInboundBridge, "handleViewerWsInbound");

    adapter = new WebSocketAdapter(wsClient, eventBus, pdfIdProvider);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    try {
      adapter?.destroy();
    } catch (e) {
      void e;
    }
    eventBus?.destroy();
    inboundSpy?.mockRestore();
  });

  test("destroy 后不再处理 WEBSOCKET_EVENTS.MESSAGE.RECEIVED 入站消息（无残留订阅）", () => {
    adapter.destroy();

    expect(adapter.getState().activeListeners).toBe(0);

    eventBus.emit(
      WEBSOCKET_EVENTS.MESSAGE.RECEIVED,
      { type: "navigate_page", data: { page_number: 1 } },
      { actorId: "test" }
    );

    expect(inboundSpy).not.toHaveBeenCalled();
  });
});

