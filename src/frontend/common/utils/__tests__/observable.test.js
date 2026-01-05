import { ObservableState } from "../observable.js";

describe("ObservableState", () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe("State Management", () => {
    test("should initialize with given state", () => {
      const state = new ObservableState({ count: 0 }, { logger: mockLogger });
      expect(state.get()).toEqual({ count: 0 });
    });

    test("should update state with set(partial)", () => {
      const state = new ObservableState({ count: 0, name: "test" }, { logger: mockLogger });
      state.set({ count: 1 });
      expect(state.get()).toEqual({ count: 1, name: "test" });
    });

    test("should update state with set(updaterFn)", () => {
      const state = new ObservableState({ count: 1 }, { logger: mockLogger });
      state.set((prev) => ({ count: prev.count + 1 }));
      expect(state.get()).toEqual({ count: 2 });
    });

    test("should replace state entirely with replace()", () => {
      const state = new ObservableState({ a: 1 }, { logger: mockLogger });
      state.replace({ b: 2 });
      expect(state.get()).toEqual({ b: 2 });
      expect(state.get().a).toBeUndefined();
    });

    test("should warn when set() receives non-object", () => {
      const state = new ObservableState({}, { logger: mockLogger });
      state.set(null);
      expect(mockLogger.warn).toHaveBeenCalled();
      state.set(123);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("Subscriptions", () => {
    test("should notify global listeners on change", () => {
      const state = new ObservableState({ val: 0 }, { logger: mockLogger });
      const listener = jest.fn();

      state.subscribe(listener);
      state.set({ val: 1 });

      expect(listener).toHaveBeenCalledWith({ val: 1 }, { val: 0 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("should unsubscribe correctly", () => {
      const state = new ObservableState({ val: 0 }, { logger: mockLogger });
      const listener = jest.fn();
      const unsubscribe = state.subscribe(listener);

      state.set({ val: 1 });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      state.set({ val: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Should not increase
    });

    test("should fire immediately if requested", () => {
      const state = new ObservableState({ val: 10 }, { logger: mockLogger });
      const listener = jest.fn();

      state.subscribe(listener, { fireImmediately: true });

      expect(listener).toHaveBeenCalledWith({ val: 10 }, undefined);
    });
  });

  describe("Selector Support (Granular Subscriptions)", () => {
    test("should only fire when selected slice changes", () => {
      const state = new ObservableState({
        user: { name: "Alice" },
        ui: { loading: false }
      }, { logger: mockLogger });

      const nameListener = jest.fn();
      // Subscribe only to user.name
      state.subscribe(s => s.user.name, nameListener);

      // Change unrelated part (ui.loading)
      state.set({ ui: { loading: true } });
      expect(nameListener).not.toHaveBeenCalled();

      // Change related part
      state.set({ user: { name: "Bob" } });
      expect(nameListener).toHaveBeenCalledWith("Bob", "Alice");
    });

    test("should support custom equality check", () => {
      const state = new ObservableState({ tags: ["a"] }, { logger: mockLogger });
      const listener = jest.fn();

      // Custom equality: compare array length
      state.subscribe(
        s => s.tags,
        listener,
        { equals: (a, b) => a.length === b.length }
      );

      // Change content but not length
      state.set({ tags: ["b"] });
      expect(listener).not.toHaveBeenCalled();

      // Change length
      state.set({ tags: ["a", "b"] });
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    test("should fail fast if set updater throws", () => {
      const state = new ObservableState({}, { logger: mockLogger });
      expect(() => {
        state.set(() => { throw new Error("Boom"); });
      }).toThrow("Boom");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test("should continue notifying other listeners if one fails", () => {
      const state = new ObservableState({ v: 0 }, { logger: mockLogger });
      const badListener = jest.fn(() => { throw new Error("Fail"); });
      const goodListener = jest.fn();

      state.subscribe(badListener);
      state.subscribe(goodListener);

      state.set({ v: 1 });

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
