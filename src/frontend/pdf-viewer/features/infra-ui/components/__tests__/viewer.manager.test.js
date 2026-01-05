import { ViewerManager } from "../viewer.manager.js";

describe("ViewerManager", () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    manager = new ViewerManager(null, mockLogger); // eventBus optional
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.currentPage).toBe(1);
    expect(state.totalPages).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.isLoaded).toBe(false);
    expect(state.hasError).toBe(false);
  });

  test("should set loading state", () => {
    manager.setLoading(true);
    expect(manager.store.get().isLoading).toBe(true);

    manager.setLoading(false, true); // Loaded
    expect(manager.store.get().isLoading).toBe(false);
    expect(manager.store.get().isLoaded).toBe(true);
  });

  test("should set error state", () => {
    manager.setError("Failed");
    expect(manager.store.get().hasError).toBe(true);
    expect(manager.store.get().errorMessage).toBe("Failed");
    expect(manager.store.get().isLoading).toBe(false);
  });

  test("should clear error", () => {
    manager.setError("Failed");
    manager.clearError();
    expect(manager.store.get().hasError).toBe(false);
    expect(manager.store.get().errorMessage).toBe("");
  });

  test("should update page info", () => {
    manager.setPageInfo(5, 100);
    expect(manager.store.get().currentPage).toBe(5);
    expect(manager.store.get().totalPages).toBe(100);

    manager.setPageInfo(6); // Keep total
    expect(manager.store.get().currentPage).toBe(6);
    expect(manager.store.get().totalPages).toBe(100);
  });
});
