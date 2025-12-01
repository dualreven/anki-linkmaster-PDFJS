import { EventBus } from "../../../common/event/event-bus.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { createEventStatusStore, markEventFired, runWithGate } from "../../utils/event-gate-runner.js";

describe("event-gate-runner", () => {
  let eventBus;
  let store;

  beforeEach(() => {
    eventBus = new EventBus();
    store = createEventStatusStore();
  });

  test("gate.once 已有历史事件时立即执行", async () => {
    const payload = { foo: 1 };
    markEventFired(store, PDF_VIEWER_EVENTS.RENDER.READY, payload);

    const run = jest.fn();
    await runWithGate({
      eventBus,
      store,
      rawGate: { once: PDF_VIEWER_EVENTS.RENDER.READY },
      run
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(payload);
  });

  test("gate.once 等待下一次事件", async () => {
    const run = jest.fn();
    const promise = runWithGate({
      eventBus,
      store,
      rawGate: { once: PDF_VIEWER_EVENTS.RENDER.READY },
      run
    });

    const payload = { bar: 2 };
    eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, payload, { actorId: "test" });

    await promise;
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(payload);
  });

  test("gate.on 只关注下一次事件", async () => {
    const oldPayload = { old: true };
    markEventFired(store, PDF_VIEWER_EVENTS.RENDER.READY, oldPayload);

    const run = jest.fn();
    const promise = runWithGate({
      eventBus,
      store,
      rawGate: { on: PDF_VIEWER_EVENTS.RENDER.READY },
      run
    });

    const newPayload = { fresh: true };
    eventBus.emit(PDF_VIEWER_EVENTS.RENDER.READY, newPayload, { actorId: "test" });

    await promise;
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(newPayload);
  });

  test("gate timeout 会抛错", async () => {
    const run = jest.fn();
    await expect(
      runWithGate({
        eventBus,
        store,
        rawGate: { once: PDF_VIEWER_EVENTS.RENDER.READY, timeout_ms: 10 },
        run
      })
    ).rejects.toThrow(/timeout waiting for event/);
    expect(run).not.toHaveBeenCalled();
  });
});

