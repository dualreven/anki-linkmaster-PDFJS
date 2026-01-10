/* @jest-environment jsdom */
/**
 * UTF-8; 严格 \n
 * 目的：验证 WebSocketAdapter 对 anchor 导航的入站桥接，
 *       应发出 ANCHOR.NAVIGATE.REQUESTED，且不触发 ACTIVATE/ACTIVATED。
 */
import { jest } from "@jest/globals";
jest.mock("../../../common/utils/logger.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import eventBus from "../../../common/event/event-bus.js";
import { WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WebSocketAdapter } from "../websocket-adapter.js";

describe("WebSocketAdapter - anchor navigate inbound", () => {
  beforeEach(() => {
    try { eventBus.destroy(); } catch {}
    document.body.innerHTML = "<div id=\"viewerContainer\"></div>";
  });

  test("收到 viewer:navigate(anchor) → 发出 ANCHOR.NAVIGATE.REQUESTED；不触发 ACTIVATED", () => {
    const sent = [];
    const wsClient = {
      send: (msg) => sent.push(msg),
      request: jest.fn(),
    };
    const adapter = new WebSocketAdapter(wsClient, eventBus, () => "pdf-test-001");
    adapter.setupMessageHandlers();
    adapter.onInitialized();

    const anchorId = "pdfanchor-abcdef123456";
    const got = { navigateReq: null, activated: [] };
    const off1 = eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED,
      (data) => { got.navigateReq = data; },
      { subscriberId: "test" }
    );
    const off2 = eventBus.on(
      PDF_VIEWER_EVENTS.ANCHOR.ACTIVATED,
      (data) => { got.activated.push(data); },
      { subscriberId: "test" }
    );

    adapter.handleMessage({
      type: WEBSOCKET_MESSAGE_TYPES.VIEWER_NAVIGATE_REQUESTED,
      data: { target: { type: "anchor", anchor_id: anchorId } },
      request_id: "r1"
    });

    expect(got.navigateReq).toEqual({ anchorId });
    expect(got.activated.length).toBe(0); // 不应立即激活
    off1?.(); off2?.();
  });
});
