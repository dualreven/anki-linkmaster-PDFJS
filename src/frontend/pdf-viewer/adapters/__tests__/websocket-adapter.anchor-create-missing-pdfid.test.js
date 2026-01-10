/** @jest-environment jsdom */

import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

describe("WebSocketAdapter — pdfIdProvider 应被用于填充 pdf_uuid", () => {
  let eventBus;
  let wsClient;
  let adapter;

  beforeEach(() => {
    eventBus = new EventBus({ enableValidation: false });
    wsClient = { request: jest.fn(), send: jest.fn() };

    adapter = new WebSocketAdapter(wsClient, eventBus, () => "pdf-test-001");
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    try { adapter?.destroy?.(); } catch { /* ignore */ }
    try { eventBus?.destroy?.(); } catch { /* ignore */ }
  });

  test("ANCHOR.CREATE 未提供 pdf_uuid 时，应使用 provider 补齐并发送 WS 请求", () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.CREATE,
      {
        __fromFeature: true,
        anchor: {
          uuid: "pdfanchor-abc123def456",
          name: "t",
          page_at: 1,
          position: 0.5
        }
      },
      { actorId: "test" }
    );

    expect(wsClient.request).toHaveBeenCalledWith(
      WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE,
      expect.objectContaining({ pdf_uuid: "pdf-test-001" }),
      expect.any(Object)
    );
  });

  test("ANCHOR.DATA.LOAD 未提供 pdf_uuid 时，应使用 provider 补齐并发送 WS 请求", () => {
    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      { anchorId: "a1" },
      { actorId: "test" }
    );

    expect(wsClient.request).toHaveBeenCalledWith(
      WEBSOCKET_MESSAGE_TYPES.ANCHOR_GET,
      expect.objectContaining({ pdf_uuid: "pdf-test-001", anchor_id: "a1" }),
      expect.any(Object)
    );
  });
});
