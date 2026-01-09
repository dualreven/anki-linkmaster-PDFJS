/**
 * SearchBoxDOMManager
 * 只负责 SearchBox 相关 DOM 查询、事件绑定与解绑（Fail-Fast）。
 */
export class SearchBoxDOMManager {
  #elements;
  #handlers;
  #logger;
  #cleanups = [];
  #initialized = false;

  /**
   * @param {object} elements
   * @param {object} handlers
   * @param {{ logger: any }} options
   */
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

  /**
   * 从 container 内 Fail-Fast 获取 SearchBox 需要的 DOM 元素。
   * @param {{ container: HTMLElement, logger?: any }} params
   * @returns {{
   *  searchInput: HTMLInputElement,
   *  prevButton: HTMLButtonElement,
   *  nextButton: HTMLButtonElement,
   *  closeButton: HTMLButtonElement,
   *  resultCounter: HTMLElement,
   *  caseSensitiveCheckbox: HTMLInputElement,
   *  wholeWordsCheckbox: HTMLInputElement,
   *  headerToggleButton: HTMLElement | null,
   * }}
   */
  static getRequiredElements(params) {
    const { container, logger } = params ?? {};
    if (!(container instanceof HTMLElement)) {
      throw new Error("[SearchBoxDOMManager] getRequiredElements: container is required");
    }

    const requireInContainer = (selector) => {
      const el = container.querySelector(selector);
      if (!el) {
        throw new Error(`[SearchBoxDOMManager] missing required element in container: ${selector}`);
      }
      return el;
    };

    const elements = {
      searchInput: /** @type {HTMLInputElement} */ (requireInContainer("#pdf-search-input")),
      prevButton: /** @type {HTMLButtonElement} */ (requireInContainer("#pdf-search-prev")),
      nextButton: /** @type {HTMLButtonElement} */ (requireInContainer("#pdf-search-next")),
      closeButton: /** @type {HTMLButtonElement} */ (requireInContainer("#pdf-search-close")),
      resultCounter: /** @type {HTMLElement} */ (requireInContainer("#pdf-search-counter")),
      caseSensitiveCheckbox: /** @type {HTMLInputElement} */ (requireInContainer("#pdf-search-case-sensitive")),
      wholeWordsCheckbox: /** @type {HTMLInputElement} */ (requireInContainer("#pdf-search-whole-words")),
      headerToggleButton: document.getElementById("search-toggle-btn"),
    };

    if (!elements.headerToggleButton) {
      logger?.debug?.("SearchBox header toggle button not found (#search-toggle-btn)");
    }

    return elements;
  }

  init() {
    if (this.#initialized) {
      throw new Error("[SearchBoxDOMManager] init called more than once");
    }
    this.#initialized = true;

    this.#logger.info("Initializing SearchBox DOM Manager and binding events.");
    const {
      searchInput,
      prevButton,
      nextButton,
      closeButton,
      caseSensitiveCheckbox,
      wholeWordsCheckbox,
      headerToggleButton,
    } = this.#elements;

    const {
      onInput,
      onKeyDown,
      onPrev,
      onNext,
      onClose,
      onCaseSensitiveChange,
      onWholeWordsChange,
      onToggle,
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

    if (headerToggleButton !== null && headerToggleButton !== undefined) {
      if (!(headerToggleButton instanceof HTMLElement)) {
        throw new Error("[SearchBoxDOMManager] elements.headerToggleButton must be an HTMLElement or null");
      }
      if (typeof onToggle !== "function") {
        throw new Error("[SearchBoxDOMManager] handlers.onToggle is required when #search-toggle-btn exists");
      }
    }

    this.#bindEvent(searchInput, "input", onInput);
    this.#bindEvent(searchInput, "keydown", onKeyDown);
    this.#bindEvent(prevButton, "click", onPrev);
    this.#bindEvent(nextButton, "click", onNext);
    this.#bindEvent(closeButton, "click", onClose);
    this.#bindEvent(caseSensitiveCheckbox, "change", onCaseSensitiveChange);
    this.#bindEvent(wholeWordsCheckbox, "change", onWholeWordsChange);

    if (headerToggleButton !== null && headerToggleButton !== undefined) {
      this.#bindEvent(headerToggleButton, "click", onToggle);
    }
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

  destroy() {
    this.#logger.info("Destroying SearchBox DOM Manager event listeners.");
    for (const cleanup of this.#cleanups.splice(0)) {
      cleanup();
    }
    this.#initialized = false;
  }

  cleanup() {
    this.destroy();
  }
}
