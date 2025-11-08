/**
 * 回归bug测试（负向）：禁止 bookmark 旧字段/旧事件名
 * - 发送旧事件名或旧字段时，适配器不应发出任何 OUTLINE 事件
 * - 用于防止外部系统混入旧契约导致的“我这边全绿、你那边全红”
 */

import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { WEBSOCKET_EVENTS } from "../../../common/event/event-constants.js";

describe("WebSocketAdapter — 旧字段/旧事件名应被拒绝", () => {
  let eventBus;
  let emitted = [];
  const sendInbound = (msg) => {
    eventBus.emit(WEBSOCKET_EVENTS.MESSAGE.RECEIVED, msg, { actorId: "test" });
  };

  beforeEach(async () => {
    emitted = [];
    eventBus = new EventBus({ enableValidation: false, moduleName: "pdf-viewer" });
    const origEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (evt, data, ctx) => {
      emitted.push({ evt, data });
      return origEmit(evt, data, ctx);
    };
    // 动态加载适配器，完成订阅
    const { WebSocketAdapter } = await import("../websocket-adapter.js");
    const mockWSClient = {
      send: () => {},
      request: () => {}
    };
    const adapter = new WebSocketAdapter(mockWSClient, eventBus);
    adapter.setupMessageHandlers();
  });

  test("收到旧事件名 'pdf-viewer:bookmark-navigate-by-id:requested' 不应触发任何 OUTLINE 事件", () => {
    sendInbound({
      type: "pdf-viewer:bookmark-navigate-by-id:requested",
      data: { bookmarkId: "outlineItem-ABCD1234" },
    });
    const anyOutline = emitted.find((e) => String(e.evt).startsWith("pdf-viewer:outline-"));
    expect(anyOutline).toBeUndefined();
  });

  test("收到新事件名但旧字段 'bookmarkId' 不应触发 OUTLINE.NAVIGATE_BY_ID.REQUESTED", () => {
    sendInbound({
      type: PDF_VIEWER_EVENTS.NAVIGATION.GOTO, // 无关导航事件，混入旧字段
      data: { bookmarkId: "outlineItem-ABCD1234" },
    });
    const byId = emitted.find((e) => e.evt === PDF_VIEWER_EVENTS.OUTLINE.NAVIGATE_BY_ID.REQUESTED);
    expect(byId).toBeUndefined();
  });
});
