/**
 * SearchBox DOM 事件绑定（返回可清理的 cleanup）
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

function maybeAttachHeaderToggle({ onToggle, logger }) {
  const btn = document.getElementById("search-toggle-btn");
  if (!btn) {
    logger?.debug?.("SearchBox header toggle button not found (#search-toggle-btn)");
    return () => {};
  }

  const handler = () => onToggle();
  btn.addEventListener("click", handler);
  return () => btn.removeEventListener("click", handler);
}

/**
 * @param {{
 *  elements: {
 *    searchInput: HTMLInputElement,
 *    prevButton: HTMLButtonElement,
 *    nextButton: HTMLButtonElement,
 *    closeButton: HTMLButtonElement,
 *    caseSensitiveCheckbox: HTMLInputElement,
 *    wholeWordsCheckbox: HTMLInputElement,
 *  },
 *  onInput: (query: string) => void,
 *  onPrev: () => void,
 *  onNext: () => void,
 *  onClose: () => void,
 *  onOptionChanged: (optionName: string, value: boolean) => void,
 *  onToggle: () => void,
 *  logger?: any,
 * }} params
 * @returns {() => void}
 */
export function attachSearchBoxDomBindings(params) {
  const { elements, onInput, onPrev, onNext, onClose, onOptionChanged, onToggle, logger } = params;
  const cleanup = [];

  const onInputHandler = (e) => onInput(String(e?.target?.value ?? ""));
  elements.searchInput.addEventListener("input", onInputHandler);
  cleanup.push(() => elements.searchInput.removeEventListener("input", onInputHandler));

  const onKeyDownHandler = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { onPrev(); }
      else { onNext(); }
      return;
    }
    if (e.key === "Escape") {
      onClose();
    }
  };
  elements.searchInput.addEventListener("keydown", onKeyDownHandler);
  cleanup.push(() => elements.searchInput.removeEventListener("keydown", onKeyDownHandler));

  const onPrevHandler = () => onPrev();
  elements.prevButton.addEventListener("click", onPrevHandler);
  cleanup.push(() => elements.prevButton.removeEventListener("click", onPrevHandler));

  const onNextHandler = () => onNext();
  elements.nextButton.addEventListener("click", onNextHandler);
  cleanup.push(() => elements.nextButton.removeEventListener("click", onNextHandler));

  const onCloseHandler = () => onClose();
  elements.closeButton.addEventListener("click", onCloseHandler);
  cleanup.push(() => elements.closeButton.removeEventListener("click", onCloseHandler));

  const onCaseSensitiveHandler = (e) => onOptionChanged("caseSensitive", Boolean(e?.target?.checked));
  elements.caseSensitiveCheckbox.addEventListener("change", onCaseSensitiveHandler);
  cleanup.push(() => elements.caseSensitiveCheckbox.removeEventListener("change", onCaseSensitiveHandler));

  const onWholeWordsHandler = (e) => onOptionChanged("wholeWords", Boolean(e?.target?.checked));
  elements.wholeWordsCheckbox.addEventListener("change", onWholeWordsHandler);
  cleanup.push(() => elements.wholeWordsCheckbox.removeEventListener("change", onWholeWordsHandler));

  cleanup.push(maybeAttachHeaderToggle({ onToggle, logger }));

  return () => {
    for (const fn of cleanup.splice(0)) {
      try { fn(); } catch (e) { logger?.debug?.("SearchBox DOM cleanup failed", e); }
    }
  };
}

