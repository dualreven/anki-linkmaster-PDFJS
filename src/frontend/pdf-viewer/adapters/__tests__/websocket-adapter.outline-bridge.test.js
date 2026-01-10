/**
 * @file WebSocketAdapter — Outline 桥接回归测试
 * 覆盖点：
 * 1) 收到 outline:list:completed → 发射 OUTLINE.LOAD.SUCCESS（字段规范化）
 * 2) 收到 outline:create/update/delete/reorder:completed → 自动请求 outline:list
 * 3) FILE.LOAD.SUCCESS 不应自动请求 outline:list（由 OutlineFeature 编排初始化加载）
 */
import eventBus from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";
import { WebSocketAdapter } from "../../adapters/websocket-adapter.js";

describe("WebSocketAdapter — Outline inbound/outbound bridge", () => {
  let ws;
  let adapter;

  beforeEach(() => {
    try { eventBus.destroy(); } catch {}

    ws = {
      request: jest.fn(),
      send: jest.fn()
    };

    adapter = new WebSocketAdapter(ws, eventBus, () => "c83c60c58ad2");
    adapter.setupMessageHandlers();
    adapter.onInitialized();
  });

  afterEach(() => {
    try { adapter?.destroy?.(); } catch {}
  });

  test("outline:list:completed → 发 OUTLINE.LOAD.SUCCESS（规范化字段）", () => {
    const handler = jest.fn();
    eventBus.on(PDF_VIEWER_EVENTS.OUTLINE.LOAD.SUCCESS, handler);

    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST_COMPLETED,
      data: {
        outline_items: [
          { id: "o1", name: "A", page_at: 3, y_percent: 40, children: [{ id: "o1-1", name: "A.1", page_at: 4 }] }
        ]
      }
    };
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });
    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0];
    expect(Array.isArray(payload.outlineItems)).toBe(true);
    expect(payload.outlineItems[0]).toEqual(
      expect.objectContaining({ id: "o1", name: "A", pageAt: 3, position: 40 })
    );
    expect(payload.source).toBe("ws-backend");
  });

  test("outline:create:completed → 自动请求 outline:list", () => {
    const message = {
      type: WEBSOCKET_MESSAGE_TYPES.OUTLINE_CREATE_COMPLETED,
      data: { outline_id: "o2" }
    };
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, message, { actorId: "test" });
    expect(ws.request).toHaveBeenCalledWith(
      WEBSOCKET_MESSAGE_TYPES.OUTLINE_LIST,
      expect.objectContaining({ pdf_uuid: "c83c60c58ad2" }),
      expect.any(Object)
    );
  });

  test("FILE.LOAD.SUCCESS 后不应自动请求 outline:list", () => {
    ws.request.mockClear();
    eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.SUCCESS, { filename: "x.pdf", totalPages: 10 }, { actorId: "test" });
    expect(ws.request).not.toHaveBeenCalled();
  });
});
