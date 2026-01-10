/**
 * @file WebSocketAdapter 入站契约（Anchor域）样板测试
 */

import { WebSocketAdapter } from "../websocket-adapter.js";
import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";

describe("WebSocketAdapter Anchor 入站消息契约", () => {
  let bus;
  let adapter;
  const wsMock = {
    send: jest.fn(),
    request: jest.fn()
  };

  beforeEach(() => {
    bus = new EventBus({ enableValidation: true, moduleName: "TestBus" });
    adapter = new WebSocketAdapter(wsMock, bus, () => "pdf-test-001");
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    bus?.destroy();
    bus = null;
    adapter = null;
    jest.clearAllMocks();
  });

  test("anchor:list:completed → PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED", () => {
    const onLoaded = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOADED, onLoaded, { subscriberId: "assert" });

    // 模拟 WSClient 层广播的通用“收到消息”事件
    bus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: "anchor:list:completed",
      data: { anchors: [{ id: "a1" }, { id: "a2" }] }
    }, { actorId: "Test" });

    expect(onLoaded).toHaveBeenCalledTimes(1);
    const payload = onLoaded.mock.calls[0][0];
    expect(Array.isArray(payload.anchors)).toBe(true);
    expect(payload.anchors.length).toBe(2);
  });

  test("anchor:list:failed → PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED", () => {
    const onFailed = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.ANCHOR.DATA.LOAD_FAILED, onFailed, { subscriberId: "assert" });

    bus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, {
      type: "anchor:list:failed",
      error: { message: "boom" }
    }, { actorId: "Test" });

    expect(onFailed).toHaveBeenCalledTimes(1);
    const payload = onFailed.mock.calls[0][0];
    expect(payload?.error?.message || "").toContain("boom");
  });
});
