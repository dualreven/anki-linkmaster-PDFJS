export class SearchBoxDOMManager {
  #elements;
  #handlers;
  #logger;
  #cleanups = [];

  constructor(elements, handlers, options = {}) {
    if (!elements || typeof elements !== "object") {
      throw new Error("[SearchBoxDOMManager] elements is required");
    }
    if (!handlers || typeof handlers !== "object") {
      throw new Error("[SearchBoxDOMManager] handlers is required");
    }
    if (!options?.logger) {
      throw new Error("[SearchBoxDOMManager] options.logger is required");
    }

    this.#elements = elements;
    this.#handlers = handlers;
    this.#logger = options.logger;
  }

  init() {
    this.#logger.info("Initializing SearchBox DOM Manager and binding events.");
    const {
      searchInput,
      prevButton,
      nextButton,
      closeButton,
      caseSensitiveCheckbox,
      wholeWordsCheckbox,
    } = this.#elements;

    const {
      onInput,
      onKeyDown,
      onPrev,
      onNext,
      onClose,
      onCaseSensitiveChange,
      onWholeWordsChange,
    } = this.#handlers;

    if (!(searchInput instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.searchInput is required");
    }
    if (!(prevButton instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.prevButton is required");
    }
    if (!(nextButton instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.nextButton is required");
    }
    if (!(closeButton instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.closeButton is required");
    }
    if (!(caseSensitiveCheckbox instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.caseSensitiveCheckbox is required");
    }
    if (!(wholeWordsCheckbox instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] elements.wholeWordsCheckbox is required");
    }

    if (typeof onInput !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onInput is required");
    }
    if (typeof onKeyDown !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onKeyDown is required");
    }
    if (typeof onPrev !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onPrev is required");
    }
    if (typeof onNext !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onNext is required");
    }
    if (typeof onClose !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onClose is required");
    }
    if (typeof onCaseSensitiveChange !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onCaseSensitiveChange is required");
    }
    if (typeof onWholeWordsChange !== "function") {
      throw new Error("[SearchBoxDOMManager] handlers.onWholeWordsChange is required");
    }

    this.#bindEvent(searchInput, "input", onInput);
    this.#bindEvent(searchInput, "keydown", onKeyDown);
    this.#bindEvent(prevButton, "click", onPrev);
    this.#bindEvent(nextButton, "click", onNext);
    this.#bindEvent(closeButton, "click", onClose);
    this.#bindEvent(caseSensitiveCheckbox, "change", onCaseSensitiveChange);
    this.#bindEvent(wholeWordsCheckbox, "change", onWholeWordsChange);
  }

  #bindEvent(element, eventType, handler) {
    if (!(element instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] bindEvent: element must be an HTMLElement");
    }
    if (typeof eventType !== "string" || !eventType) {
      throw new Error("[SearchBoxDOMManager] bindEvent: eventType must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error("[SearchBoxDOMManager] bindEvent: handler must be a function");
    }

    element.addEventListener(eventType, handler);
    const cleanup = () => element.removeEventListener(eventType, handler);
    this.#cleanups.push(cleanup);
  }

  cleanup() {
    this.#logger.info("Cleaning up SearchBox DOM Manager event listeners.");
    this.#cleanups.forEach(cleanup => cleanup());
    this.#cleanups = [];
  }
}
