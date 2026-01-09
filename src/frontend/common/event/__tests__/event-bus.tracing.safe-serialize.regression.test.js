import { EventBus } from "../event-bus.js";
import { PDF_VIEWER_EVENTS } from "../pdf-viewer-constants.js";

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    event: jest.fn(),
  };
}

describe("EventBus tracing — safe serialize (regression)", () => {
  test("enableTracing=true: emit with circular payload does not throw", () => {
    const logger = createLogger();
    const bus = new EventBus({ enableValidation: false, enableTracing: true, logger, moduleName: "TestBus" });

    bus.on(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, () => {}, { subscriberId: "t" });

    const payload = { a: 1 };
    payload.self = payload;

    expect(() => bus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, payload, { actorId: "test" })).not.toThrow();
  });

  test("enableTracing=true: stringify failure is fail-closed and still records trace", () => {
    const logger = createLogger();
    const bus = new EventBus({ enableValidation: false, enableTracing: true, logger, moduleName: "TestBus" });

    bus.on(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, () => {}, { subscriberId: "t" });

    const spy = jest.spyOn(JSON, "stringify").mockImplementation(() => {
      throw new RangeError("Maximum call stack size exceeded");
    });

    const traceInfo = bus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, { a: 1 }, { actorId: "test" });
    expect(traceInfo?.messageId).toBeTruthy();

    const trace = bus.getMessageTrace(traceInfo.messageId);
    expect(typeof trace?.data).toBe("string");
    expect(trace.data).toContain("[Unserializable payload:");

    spy.mockRestore();
  });
});
