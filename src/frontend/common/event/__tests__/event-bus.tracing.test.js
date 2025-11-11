/**
 * 目的：EventBus 追踪能力测试
 * - setTracing(true) 后 emit 返回 messageId/traceId
 * - getMessageTrace 能取回记录，且包含订阅者执行结果
 */
import { EventBus } from "../event-bus.js";
import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";

describe("EventBus 消息追踪", () => {
  test("开启追踪后返回 trace 信息并可查询", () => {
    const bus = new EventBus({ moduleName: "TraceBus", enableValidation: true });
    bus.setTracing(true, { maxTraceSize: 100 });
    const cb = jest.fn();
    bus.on(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, cb, { subscriberId: "s1" });
    const info = bus.emit(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED, { t: 1 }, { actorId: "tester" });
    expect(info).toEqual(expect.objectContaining({ messageId: expect.any(String), traceId: expect.any(String) }));
    const trace = bus.getMessageTrace(info.messageId);
    expect(trace).not.toBeNull();
    expect(trace.event).toBe(PDF_VIEWER_EVENTS.NAVIGATION.CHANGED);
  });
});
