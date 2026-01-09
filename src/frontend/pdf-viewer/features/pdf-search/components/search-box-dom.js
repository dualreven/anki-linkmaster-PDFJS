/**
 * SearchBox DOM 组装（纯 UI/DOM，不含业务事件）
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

import { SearchBoxDOMManager } from "./search-box-dom-manager.js";

function buildSearchBoxTemplate() {
  return `
      <div class="search-box-main">
        <input
          type="text"
          id="pdf-search-input"
          class="search-input"
          placeholder="搜索PDF..."
          aria-label="搜索关键词"
          autocomplete="off"
        />

        <div class="search-controls">
          <button
            id="pdf-search-prev"
            class="search-btn search-btn-prev"
            title="上一个 (Shift+Enter)"
            aria-label="上一个搜索结果"
          >
            <span class="icon">▲</span>
          </button>

          <button
            id="pdf-search-next"
            class="search-btn search-btn-next"
            title="下一个 (Enter)"
            aria-label="下一个搜索结果"
          >
            <span class="icon">▼</span>
          </button>

          <span
            id="pdf-search-counter"
            class="search-counter"
            aria-live="polite"
            aria-atomic="true"
          >0/0</span>

          <button
            id="pdf-search-close"
            class="search-btn search-btn-close"
            title="关闭 (Esc)"
            aria-label="关闭搜索"
          >
            <span class="icon">✕</span>
          </button>
        </div>
      </div>

      <div class="search-box-options">
        <label class="search-option">
          <input
            type="checkbox"
            id="pdf-search-case-sensitive"
            class="search-checkbox"
          />
          <span>区分大小写</span>
        </label>

        <label class="search-option">
          <input
            type="checkbox"
            id="pdf-search-whole-words"
            class="search-checkbox"
          />
          <span>全词匹配</span>
        </label>
      </div>
    `;
}

/**
 * @param {{ logger?: any }} [deps]
 * @returns {{
 *  container: HTMLElement,
 *  elements: {
 *    searchInput: HTMLInputElement,
 *    prevButton: HTMLButtonElement,
 *    nextButton: HTMLButtonElement,
 *    closeButton: HTMLButtonElement,
 *    resultCounter: HTMLElement,
 *    caseSensitiveCheckbox: HTMLInputElement,
 *    wholeWordsCheckbox: HTMLInputElement,
 *    headerToggleButton: HTMLElement | null,
 *  }
 * }}
 */
export function createSearchBoxDom(deps = {}) {
  const logger = deps?.logger;

  const container = document.createElement("div");
  container.id = "pdf-search-box";
  container.className = "pdf-search-box hidden";
  container.setAttribute("role", "search");
  container.setAttribute("aria-label", "PDF搜索");
  container.innerHTML = buildSearchBoxTemplate();

  document.body.appendChild(container);

  const elements = SearchBoxDOMManager.getRequiredElements({ container, logger });

  logger?.debug?.("SearchBox DOM created");
  return { container, elements };
}
