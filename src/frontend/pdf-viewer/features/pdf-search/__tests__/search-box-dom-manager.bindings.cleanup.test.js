/* @jest-environment jsdom */

import { SearchBoxDOMManager } from "../components/search-box-dom-manager.js";

describe("SearchBoxDOMManager — init/cleanup bindings (JSDOM)", () => {
  test("init binds events; cleanup removes them", () => {
    document.body.innerHTML = "";

    const container = document.createElement("div");
    container.innerHTML = [
      "<input id=\"pdf-search-input\" />",
      "<button id=\"pdf-search-prev\"></button>",
      "<button id=\"pdf-search-next\"></button>",
      "<button id=\"pdf-search-close\"></button>",
      "<span id=\"pdf-search-counter\">0/0</span>",
      "<input id=\"pdf-search-case-sensitive\" type=\"checkbox\" />",
      "<input id=\"pdf-search-whole-words\" type=\"checkbox\" />",
    ].join("\n");
    document.body.appendChild(container);

    const headerToggleButton = document.createElement("button");
    headerToggleButton.id = "search-toggle-btn";
    document.body.appendChild(headerToggleButton);

    const elements = SearchBoxDOMManager.getRequiredElements({ container, logger: console });

    const onInput = jest.fn();
    const onKeyDown = jest.fn();
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const onClose = jest.fn();
    const onCaseSensitiveChange = jest.fn();
    const onWholeWordsChange = jest.fn();
    const onToggle = jest.fn();

    const domManager = new SearchBoxDOMManager(elements, {
      onInput,
      onKeyDown,
      onPrev,
      onNext,
      onClose,
      onCaseSensitiveChange,
      onWholeWordsChange,
      onToggle,
    }, { logger: console });

    domManager.init();

    elements.searchInput.value = "abc";
    elements.searchInput.dispatchEvent(new Event("input"));
    expect(onInput).toHaveBeenCalledTimes(1);

    elements.nextButton.click();
    expect(onNext).toHaveBeenCalledTimes(1);

    elements.headerToggleButton.click();
    expect(onToggle).toHaveBeenCalledTimes(1);

    domManager.destroy();

    elements.searchInput.dispatchEvent(new Event("input"));
    elements.nextButton.click();
    elements.headerToggleButton.click();
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("when #search-toggle-btn exists, onToggle is required", () => {
    document.body.innerHTML = "";

    const container = document.createElement("div");
    container.innerHTML = [
      "<input id=\"pdf-search-input\" />",
      "<button id=\"pdf-search-prev\"></button>",
      "<button id=\"pdf-search-next\"></button>",
      "<button id=\"pdf-search-close\"></button>",
      "<span id=\"pdf-search-counter\">0/0</span>",
      "<input id=\"pdf-search-case-sensitive\" type=\"checkbox\" />",
      "<input id=\"pdf-search-whole-words\" type=\"checkbox\" />",
    ].join("\n");
    document.body.appendChild(container);

    const headerToggleButton = document.createElement("button");
    headerToggleButton.id = "search-toggle-btn";
    document.body.appendChild(headerToggleButton);

    const elements = SearchBoxDOMManager.getRequiredElements({ container, logger: console });

    const domManager = new SearchBoxDOMManager(elements, {
      onInput: () => {},
      onKeyDown: () => {},
      onPrev: () => {},
      onNext: () => {},
      onClose: () => {},
      onCaseSensitiveChange: () => {},
      onWholeWordsChange: () => {},
    }, { logger: console });

    expect(() => domManager.init()).toThrow("handlers.onToggle is required");
  });
});
