import { subscribeSearchBoxEvents } from "../components/search-box-event-subscriptions.js";

describe("subscribeSearchBoxEvents — Fail-Fast 参数校验", () => {
  test("params 必须是 plain object", () => {
    // @ts-expect-error - intentional invalid input for test
    expect(() => subscribeSearchBoxEvents(null)).toThrow("subscribeSearchBoxEvents: params must be a plain object");
    // @ts-expect-error - intentional invalid input for test
    expect(() => subscribeSearchBoxEvents([])).toThrow("subscribeSearchBoxEvents: params must be a plain object");
  });

  test("eventBus.on 必须是函数", () => {
    expect(() => subscribeSearchBoxEvents({
      // @ts-expect-error - intentional invalid input for test
      eventBus: {},
      onOpen: () => {},
      onClose: () => {},
      onToggle: () => {},
      subscriberId: "test",
    })).toThrow("subscribeSearchBoxEvents: eventBus.on must be a function");
  });

  test("subscriberId 必须是非空字符串", () => {
    expect(() => subscribeSearchBoxEvents({
      eventBus: { on: () => () => {} },
      onOpen: () => {},
      onClose: () => {},
      onToggle: () => {},
      subscriberId: "",
    })).toThrow("subscribeSearchBoxEvents: subscriberId must be a non-empty string");
  });

  test("onOpen/onClose/onToggle 必须是函数", () => {
    expect(() => subscribeSearchBoxEvents({
      eventBus: { on: () => () => {} },
      // @ts-expect-error - intentional invalid input for test
      onOpen: null,
      onClose: () => {},
      onToggle: () => {},
      subscriberId: "test",
    })).toThrow("subscribeSearchBoxEvents: onOpen must be a function");

    expect(() => subscribeSearchBoxEvents({
      eventBus: { on: () => () => {} },
      onOpen: () => {},
      // @ts-expect-error - intentional invalid input for test
      onClose: 123,
      onToggle: () => {},
      subscriberId: "test",
    })).toThrow("subscribeSearchBoxEvents: onClose must be a function");

    expect(() => subscribeSearchBoxEvents({
      eventBus: { on: () => () => {} },
      onOpen: () => {},
      onClose: () => {},
      // @ts-expect-error - intentional invalid input for test
      onToggle: undefined,
      subscriberId: "test",
    })).toThrow("subscribeSearchBoxEvents: onToggle must be a function");
  });

  test("onResult 若提供必须是函数", () => {
    expect(() => subscribeSearchBoxEvents({
      eventBus: { on: () => () => {} },
      onOpen: () => {},
      onClose: () => {},
      onToggle: () => {},
      // @ts-expect-error - intentional invalid input for test
      onResult: "nope",
      subscriberId: "test",
    })).toThrow("subscribeSearchBoxEvents: onResult must be a function");
  });
});

