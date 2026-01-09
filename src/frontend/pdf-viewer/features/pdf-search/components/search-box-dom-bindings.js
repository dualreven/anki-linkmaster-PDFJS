/**
 * SearchBox DOM 事件绑定（返回可清理的 cleanup）
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

import { SearchBoxDOMManager } from "./search-box-dom-manager.js";

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

export function attachSearchBoxDomBindings(params) {
  const { elements, onInput, onPrev, onNext, onClose, onOptionChanged, onToggle, logger } = params;
  if (!logger) {
    throw new Error("[SearchBox] attachSearchBoxDomBindings: logger is required");
  }

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

  const domManager = new SearchBoxDOMManager(elements, {
    onInput: (e) => onInput(String(e?.target?.value ?? "")),
    onKeyDown: onKeyDownHandler,
    onPrev,
    onNext,
    onClose,
    onCaseSensitiveChange: (e) => onOptionChanged("caseSensitive", Boolean(e?.target?.checked)),
    onWholeWordsChange: (e) => onOptionChanged("wholeWords", Boolean(e?.target?.checked)),
  }, { logger });

  domManager.init();

  const headerToggleCleanup = maybeAttachHeaderToggle({ onToggle, logger });

  return () => {
    domManager.cleanup();
    headerToggleCleanup();
    logger?.debug?.("SearchBox DOM bindings cleaned up.");
  };
}
