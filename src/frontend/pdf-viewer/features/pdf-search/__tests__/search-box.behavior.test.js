/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
import { SearchBox } from "../components/search-box.js";

function createMockEventBus() {
  return {
    on: jest.fn(() => jest.fn()),
    emit: jest.fn(),
    off: jest.fn(),
  };
}

function createMockSearchManager() {
  return {
    store: {
      subscribe: jest.fn((selector, listener) => {
        // Return mock unsubscribe
        return jest.fn();
      }),
      get: jest.fn(() => ({
        isVisible: false,
        query: "",
        currentIndex: 0,
        totalMatches: 0
      }))
    },
    setQuery: jest.fn(),
    setVisible: jest.fn()
  };
}

describe("SearchBox — UI 行为（最小回归）", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("输入后触发防抖搜索事件（execute:query）", async () => {
    const eventBus = createMockEventBus();
    const searchManager = createMockSearchManager();
    const box = new SearchBox(eventBus, searchManager);
    await box.initialize();

    const input = document.getElementById("pdf-search-input");
    expect(input).not.toBeNull();

    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    jest.advanceTimersByTime(300);

    expect(eventBus.emit).toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY,
      expect.objectContaining({
        query: "hello",
        options: expect.objectContaining({
          caseSensitive: false,
          wholeWords: false,
          highlightAll: true,
          useRegex: false,
        }),
      }),
      { actorId: "SearchBox" }
    );

    box.destroy();
    expect(document.getElementById("pdf-search-box")).toBeNull();
  });
});
