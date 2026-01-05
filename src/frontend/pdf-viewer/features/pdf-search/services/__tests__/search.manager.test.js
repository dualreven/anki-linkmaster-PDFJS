import { SearchManager } from "../search.manager.js";

describe("SearchManager", () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    manager = new SearchManager(mockLogger);
  });

  test("should initialize with default state", () => {
    const state = manager.store.get();
    expect(state.query).toBe("");
    expect(state.currentIndex).toBe(0);
    expect(state.totalMatches).toBe(0);
    expect(state.isSearching).toBe(false);
    expect(state.isVisible).toBe(false);
    expect(state.options.caseSensitive).toBe(false);
  });

  test("should update query", () => {
    manager.setQuery("test");
    expect(manager.store.get().query).toBe("test");
  });

  test("should update options", () => {
    manager.updateOptions({ caseSensitive: true });
    expect(manager.store.get().options.caseSensitive).toBe(true);
    expect(manager.store.get().options.wholeWords).toBe(false); // Preserves others
  });

  test("should update results", () => {
    manager.updateResults(1, 10);
    expect(manager.store.get().currentIndex).toBe(1);
    expect(manager.store.get().totalMatches).toBe(10);
    expect(manager.store.get().isSearching).toBe(false); // Usually stops searching
  });

  test("should set visibility", () => {
    manager.setVisible(true);
    expect(manager.store.get().isVisible).toBe(true);
  });

  test("should set searching state", () => {
    manager.setSearching(true);
    expect(manager.store.get().isSearching).toBe(true);
  });
});
