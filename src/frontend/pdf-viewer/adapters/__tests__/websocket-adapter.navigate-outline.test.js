/**
 * WebSocketAdapter - outline 导航消息处理测试
 */
// stub logger to avoid import.meta in jest（配合 moduleNameMapper 去掉 .js 扩展）
jest.mock("../../common/utils/logger", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });
jest.mock("../../../common/utils/logger", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });

let WebSocketAdapter;
const { PDF_VIEWER_EVENTS } = require("../../../common/event/pdf-viewer-constants.js");

describe("WebSocketAdapter navigate (outline)", () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    jest.isolateModules(() => {
      WebSocketAdapter = require("../websocket-adapter.js").WebSocketAdapter;
    });
    eventBus = {
      _h: {},
      on: function (evt, fn) { this._h[evt] = fn; return () => {}; },
      onGlobal: function (evt, fn) { this._h[evt] = fn; return () => {}; },
      emit: function (evt, data, meta) { if (this._h[evt]) {this._h[evt](data, meta);} },
      destroy: function () { this._h = {}; }
    };
    mockWSClient = {
      send: jest.fn(),
      isConnected: jest.fn(() => true)
    };
    adapter = new WebSocketAdapter(mockWSClient, eventBus);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    adapter?.destroy();
    eventBus?.destroy();
  });

  test("应当把 pdf-viewer:navigate:requested (outline) 转为 OUTLINE.NAVIGATE_BY_ID.REQUESTED [NEW PROTOCOL]", () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, spy);

    // ✅ 新协议：to 在顶层，使用 client_id/routing_key
    adapter.handleMessage({
      type: "pdf-viewer:navigate:requested",
      request_id: "req-1",
      to: {
        client_id: "pdf-viewer-deadbeefcafe",
        target_type: "pdf-viewer",
        routing_key: "pdf:deadbeefcafe"
      },
      data: {
        target: { type: "outline", outline_item_id: "outline-123" },
        options: {}
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { outlineItemId: "outline-123" },
      expect.any(Object)
    );
  });

  test("[DEPRECATED] 旧协议仍然支持 (backward compat)", () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED, spy);

    // ⚠️ 旧协议：to 包含 pdf_uuid
    adapter.handleMessage({
      type: "pdf-viewer:navigate:requested",
      request_id: "req-1-old",
      to: {
        pdf_uuid: "deadbeefcafe"  // 旧字段
      },
      data: {
        target: { type: "outline", outline_item_id: "outline-123" },
        options: {}
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { outlineItemId: "outline-123" },
      expect.any(Object)
    );
  });
});

