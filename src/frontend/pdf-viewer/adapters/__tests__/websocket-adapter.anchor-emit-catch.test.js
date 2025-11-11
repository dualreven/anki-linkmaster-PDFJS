/**
 * @jest-environment jsdom
 */
import { WebSocketAdapter } from "../websocket-adapter.js";
import { WEBSOCKET_EVENTS, WEBSOCKET_MESSAGE_TYPES } from "../../../common/event/event-constants.js";

// 简易 EventBus stub：记录 on 的 handler，并让 emit 抛错以触发 catch 分支
class StubEventBus {
  constructor() { this.handlers = {}; }
  on(eventName, handler) {
    this.handlers[eventName] = handler;
    return () => {};
  }
  emit() { throw new Error("emit failed (test)"); }
  emitGlobal() {}
}

class StubWS {
  request() {}
}

test("ANCHOR_CREATE_COMPLETED → emit ANCHOR.CREATED 失败时应记录 warn 日志而不抛出", () => {
  const eventBus = new StubEventBus();
  const ws = new StubWS();
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

  const adapter = new WebSocketAdapter(ws, eventBus);
  adapter.setupMessageHandlers();

  // 触发 inbound 消息处理
  const handler = eventBus.handlers[WEBSOCKET_EVENTS.MESSAGE.RECEIVED];
  expect(typeof handler).toBe("function");

  const msg = { type: WEBSOCKET_MESSAGE_TYPES.ANCHOR_CREATE_COMPLETED, data: { uuid: "a1" } };
  // 不应抛出
  expect(() => handler(msg)).not.toThrow();

  // 应记录 warn（由 getLogger → console.warn 输出）
  expect(warnSpy).toHaveBeenCalled();
  warnSpy.mockRestore();
});

