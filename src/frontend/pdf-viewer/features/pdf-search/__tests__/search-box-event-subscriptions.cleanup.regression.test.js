import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { subscribeSearchBoxEvents } from "../components/search-box-event-subscriptions.js";

function createMockEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /** @param {string} event */
  const getSet = (event) => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    return set;
  };

  return {
    on: jest.fn((event, handler) => {
      const set = getSet(event);
      set.add(handler);
      return () => set.delete(handler);
    }),
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) {
        return;
      }
      for (const handler of Array.from(set)) {
        handler(payload);
      }
    },
  };
}

describe("subscribeSearchBoxEvents — cleanup 契约回归", () => {
  test("cleanup 后不再触发 UI 行为（open/close/toggle/result）", () => {
    const eventBus = createMockEventBus();
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const onToggle = jest.fn();
    const onResult = jest.fn();

    const cleanup = subscribeSearchBoxEvents({
      eventBus,
      subscriberId: "test",
      onOpen,
      onClose,
      onToggle,
      onResult,
    });

    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.CLOSE, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.TOGGLE, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED, { current: 1, total: 2 });
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND, {});

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(2);

    cleanup();

    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.CLOSE, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.UI.TOGGLE, {});
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED, { current: 2, total: 3 });
    eventBus.emit(PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND, {});

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  test("cleanup 幂等：重复调用不应抛错", () => {
    const eventBus = createMockEventBus();
    const cleanup = subscribeSearchBoxEvents({
      eventBus,
      subscriberId: "test",
      onOpen: () => {},
      onClose: () => {},
      onToggle: () => {},
    });

    expect(() => cleanup()).not.toThrow();
    expect(() => cleanup()).not.toThrow();
  });
});

