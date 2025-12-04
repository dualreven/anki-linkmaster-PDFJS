/**
 * @file WebSocketAdapter - 标注管理器窗口打开消息用例
 */

import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

describe("WebSocketAdapter 标注管理器窗口打开消息", () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    // 模拟 URL 参数，包含有效的 pdf-id
    const path = "/pdf-viewer/?pdf-id=anno-pdf-123";
    window.history.pushState({}, "", path);

    eventBus = new EventBus({ enableValidation: false });
    mockWSClient = { send: jest.fn(), isConnected: jest.fn(() => true) };
    adapter = new WebSocketAdapter(mockWSClient, eventBus);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    adapter && adapter.destroy();
    eventBus && eventBus.destroy();
  });

  it("在收到 ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED 时发送 app-window:open:requested 消息", () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANNOTATION.MANAGER.OPEN_WINDOW_REQUESTED,
      { pdfId: "anno-pdf-123" }
    );

    const calls = mockWSClient.send.mock.calls.map((c) => c[0]);
    const msg = calls.find((m) => m && m.type === WEBSOCKET_MESSAGE_TYPES.APP_WINDOW_OPEN_REQUESTED);
    expect(msg).toBeTruthy();
    expect(msg.data).toEqual(
      expect.objectContaining({
        client_id: "anno-manager",
        window_type: "anno-manager",
        params: expect.objectContaining({
          pdf_id: "anno-pdf-123"
        })
      })
    );
  });
});

