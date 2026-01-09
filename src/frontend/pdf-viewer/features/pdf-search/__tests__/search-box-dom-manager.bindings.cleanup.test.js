/* @jest-environment jsdom */

import { SearchBoxDOMManager } from "../components/search-box-dom-manager.js";

describe("SearchBoxDOMManager — init/cleanup bindings (JSDOM)", () => {
  test("init binds events; cleanup removes them", () => {
    document.body.innerHTML = [
      "<input id=\"searchInput\" />",
      "<button id=\"prevButton\"></button>",
      "<button id=\"nextButton\"></button>",
      "<button id=\"closeButton\"></button>",
      "<input id=\"caseSensitiveCheckbox\" type=\"checkbox\" />",
      "<input id=\"wholeWordsCheckbox\" type=\"checkbox\" />",
    ].join("\n");

    const elements = {
      searchInput: document.getElementById("searchInput"),
      prevButton: document.getElementById("prevButton"),
      nextButton: document.getElementById("nextButton"),
      closeButton: document.getElementById("closeButton"),
      caseSensitiveCheckbox: document.getElementById("caseSensitiveCheckbox"),
      wholeWordsCheckbox: document.getElementById("wholeWordsCheckbox"),
    };

    const onInput = jest.fn();
    const onKeyDown = jest.fn();
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const onClose = jest.fn();
    const onCaseSensitiveChange = jest.fn();
    const onWholeWordsChange = jest.fn();

    const domManager = new SearchBoxDOMManager(elements, {
      onInput,
      onKeyDown,
      onPrev,
      onNext,
      onClose,
      onCaseSensitiveChange,
      onWholeWordsChange,
    }, { logger: console });

    domManager.init();

    elements.searchInput.value = "abc";
    elements.searchInput.dispatchEvent(new Event("input"));
    expect(onInput).toHaveBeenCalledTimes(1);

    elements.nextButton.click();
    expect(onNext).toHaveBeenCalledTimes(1);

    domManager.cleanup();

    elements.searchInput.dispatchEvent(new Event("input"));
    elements.nextButton.click();
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

