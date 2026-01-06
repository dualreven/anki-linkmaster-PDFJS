/** @jest-environment jsdom */

import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";

describe("WebSocketAdapter — ANCHOR.CREATE 缺少 pdf_uuid 必须显式失败", () => {
  let eventBus;
  let wsClient;
  let adapter;

  beforeEach(() => {
    try {
      window.history.pushState({}, "", "http://localhost/pdf-viewer/?page-at=1");
    } catch {
      // ignore
    }

    eventBus = new EventBus({ enableValidation: false });
    wsClient = { request: jest.fn(), send: jest.fn() };

    adapter = new WebSocketAdapter(wsClient, eventBus);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    try { adapter?.destroy?.(); } catch { /* ignore */ }
    try { eventBus?.destroy?.(); } catch { /* ignore */ }
  });

  test("缺少 pdf_uuid 时应 emit ANCHOR.CREATE_FAILED，且不发送 WS 请求", () => {
    const onFailed = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANCHOR.CREATE_FAILED, onFailed);

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

    expect(wsClient.request).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "缺少 pdf_uuid"
        })
      })
    );
  });

  test("ANCHOR.DATA.LOAD 缺少 pdf_uuid 时应 emit LOAD_FAILED，且不发送 WS 请求", () => {
    const onLoadFailed = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED, onLoadFailed);

    eventBus.emit(
      PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD,
      { anchorId: "a1" },
      { actorId: "test" }
    );

    expect(wsClient.request).not.toHaveBeenCalled();
    expect(onLoadFailed).toHaveBeenCalledTimes(1);
    expect(onLoadFailed.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "缺少 pdf_uuid"
        })
      })
    );
  });
});
