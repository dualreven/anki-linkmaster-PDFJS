/**
 * @file WebSocketAdapter — Outline null 回执防回归测试
 * 场景：收到 outline:list:completed 且 data.outline_items === null
 * 期望：不桥接 OUTLINE.LOAD.SUCCESS（交由 OutlineFeature 处理“从PDF导入→保存→再拉取”）
 */
import eventBus from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { WebSocketAdapter } from "../../adapters/websocket-adapter.js";

describe("WebSocketAdapter — outline:list:completed(null) 不应桥接空态", () => {
  let ws;
  let adapter;

  let OriginalURLSearchParams;
  beforeEach(() => {
    try { eventBus.destroy(); } catch {}
    // 固定 URL 参数返回 pdf-id
    OriginalURLSearchParams = global.URLSearchParams;
    // @ts-ignore
    global.URLSearchParams = function () {
      return { get: (k) => (k === "pdf-id" ? "c83c60c58ad2" : null) };
    };

    ws = {
      request: jest.fn(),
      send: jest.fn()
    };
    adapter = new WebSocketAdapter(ws, eventBus);
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    try { adapter?.destroy?.(); } catch {}
    if (OriginalURLSearchParams) {
      // @ts-ignore
      global.URLSearchParams = OriginalURLSearchParams;
    }
  });

  test("outline_items === null 时不应发出 OUTLINE.LOAD.SUCCESS", () => {
    const handler = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, handler);

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: { outline_items: null }
    };
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });

    expect(handler).not.toHaveBeenCalled();
  });
});

