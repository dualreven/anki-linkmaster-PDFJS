import { truncateResultsByPageLimit } from "./search-results-page-limit.js";

function normalizeResultsArray(results) {
  if (results === null || results === undefined) {
    return [];
  }
  if (!Array.isArray(results)) {
    throw new Error(`[search-results-results-update] Invalid results: expected array, got ${typeof results}`);
  }
  return results;
}

function normalizePendingIds(pendingFocusIds) {
  if (pendingFocusIds === null || pendingFocusIds === undefined) {
    return null;
  }
  if (pendingFocusIds instanceof Set) {
    return Array.from(pendingFocusIds).map((x) => String(x));
  }
  if (Array.isArray(pendingFocusIds)) {
    return pendingFocusIds.map((x) => String(x));
  }
  throw new Error("[search-results-results-update] Invalid pendingFocusIds: expected Set|Array|null");
}

export function createSearchResultsResultsUpdater({
  logger,
  resultsRenderer,
  getResultsContainer,
  getHeaderElement,
  getLastRequestedPageLimit,
  getPendingFocusIds,
  setPendingFocusIds,
  setCurrentResults,
  getCurrentResults,
}) {
  function updateHeaderStats({ count, searchText, displayCount }) {
    const header = getHeaderElement();
    if (!header) {
      throw new Error("[search-results-results-update] header element not ready");
    }
    const countBadge = header.querySelector(".result-count-badge");
    if (!countBadge) {
      return;
    }

    const shown = (typeof displayCount === "number" && displayCount >= 0) ? displayCount : 0;
    const total = (typeof count === "number" && count >= 0) ? count : shown;
    countBadge.textContent = `显示 ${shown} / 共 ${total} 条`;

    if (searchText) {
      countBadge.setAttribute("title", `搜索: "${searchText}"`);
    } else {
      countBadge.removeAttribute("title");
    }
  }

  function applyPendingFocus() {
    const container = getResultsContainer();
    if (!container) {
      throw new Error("[search-results-results-update] results container not ready");
    }

    const ids = normalizePendingIds(getPendingFocusIds());
    if (!ids || ids.length === 0) {
      return;
    }

    let firstEl = null;
    ids.forEach((id) => {
      const el = container.querySelector(`[data-id="${id}"]`);
      if (!el) {
        return;
      }
      el.classList.add("selected");
      if (!firstEl) {
        firstEl = el;
      }
    });

    if (firstEl) {
      container.querySelectorAll(".search-result-item.focused").forEach((it) => it.classList.remove("focused"));
      firstEl.classList.add("focused");
      if (typeof firstEl.scrollIntoView === "function") {
        firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    setPendingFocusIds(null);
  }

  function handleResultsUpdate({ results, count, searchText, focusId, page }) {
    const normalizedResults = normalizeResultsArray(results);
    const { results: displayResults } = truncateResultsByPageLimit({
      results: normalizedResults,
      page,
      lastRequestedPageLimit: getLastRequestedPageLimit(),
    });

    setCurrentResults(displayResults);
    const currentResults = getCurrentResults();
    const displayCount = Array.isArray(currentResults) ? currentResults.length : 0;

    logger.info("[SearchResultsFeature] ===== 处理结果更新 =====", {
      totalCount: count,
      displayCount,
      searchText,
      hasContainer: !!getResultsContainer(),
      firstItem: currentResults?.[0],
    });

    updateHeaderStats({ count, searchText, displayCount });

    const container = getResultsContainer();
    if (!container) {
      throw new Error("[search-results-results-update] results container not ready");
    }
    resultsRenderer.render(container, currentResults);

    if (focusId) {
      setPendingFocusIds(new Set([String(focusId)]));
    }

    applyPendingFocus();
  }

  return {
    handleResultsUpdate,
    applyPendingFocus,
    updateHeaderStats,
  };
}
