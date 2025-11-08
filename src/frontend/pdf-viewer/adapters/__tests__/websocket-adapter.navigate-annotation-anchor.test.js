/**
 * WebSocketAdapter - annotation/anchor 导航消息处理测试
 */
// 避免 logger 内 import.meta 在 Jest 中报错：用最小 stub 替代（配合 moduleNameMapper 去掉 .js 扩展）
jest.mock("../../common/utils/logger", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });
jest.mock("../../../common/utils/logger", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}), { virtual: true });

let WebSocketAdapter;
const { PDF_VIEWER_EVENTS } = require("../../../common/event/pdf-viewer-constants.js");

describe("WebSocketAdapter navigate (annotation/anchor)", () => {
  let eventBus;
  let mockWSClient;
  let adapter;

  beforeEach(() => {
    // 按需加载被测模块（确保先完成 jest.mock）
    jest.isolateModules(() => {
      WebSocketAdapter = require("../websocket-adapter.js").WebSocketAdapter;
    });
    // 让待测适配器生成的 viewer_id 与测试消息中的 to.viewer_id 一致
    // WebSocketAdapter 会优先从 sessionStorage 读取稳定的实例ID
    try { window.sessionStorage.setItem("pdf_viewer_instance_id", "vwr_x"); } catch {}
    // 轻量事件总线 stub（避免引入真实 EventBus 触发 import.meta）
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

  test("annotation 模式应发射 ANNOTATION.NAVIGATION.JUMP_REQUESTED（id）", () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.NAVIGATION.JUMP_REQUESTED, spy);

    adapter.handleMessage({
      type: "pdf-viewer:navigate:requested",
      request_id: "req-2",
      data: {
        to: { viewer_id: "vwr_x" },
        target: { type: "annotation", annotation_id: "ann-xyz" },
        options: { highlight: true }
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { id: "ann-xyz", highlight: true },
      expect.any(Object)
    );
  });

  test("anchor 模式应发射 ANCHOR.NAVIGATE.REQUESTED（anchorId）", () => {
    const spy = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.ANCHOR.NAVIGATE.REQUESTED, spy);

    adapter.handleMessage({
      type: "pdf-viewer:navigate:requested",
      request_id: "req-3",
      data: {
        to: { pdf_uuid: "deadbeefcafe" },
        target: { type: "anchor", anchor_id: "pdfanchor-aaaaaaaaaaaa" }
      }
    });

    expect(spy).toHaveBeenCalledWith(
      { anchorId: "pdfanchor-aaaaaaaaaaaa" },
      expect.any(Object)
    );
  });
});

