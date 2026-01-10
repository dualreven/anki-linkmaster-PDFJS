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
      subscribe: jest.fn(() => jest.fn()),
      get: jest.fn(() => ({
        isVisible: false,
        query: "",
        currentIndex: 0,
        totalMatches: 0,
      })),
    },
    setQuery: jest.fn(),
    setVisible: jest.fn(),
  };
}

describe("SearchBox — debounce cancel regression", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("destroy cancels pending debounced search (no emit after timers advance)", async () => {
    const eventBus = createMockEventBus();
    const searchManager = createMockSearchManager();
    const box = new SearchBox(eventBus, searchManager);
    await box.initialize();

    const input = document.getElementById("pdf-search-input");
    expect(input).not.toBeNull();

    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    box.destroy();

    jest.advanceTimersByTime(300);

    expect(eventBus.emit).not.toHaveBeenCalledWith(
      PDF_VIEWER_EVENTS.SEARCH.EXECUTE.QUERY,
      expect.anything(),
      expect.anything()
    );
  });
});

