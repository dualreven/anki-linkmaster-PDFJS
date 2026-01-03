export function resolveEffectivePageLimit({ page, lastRequestedPageLimit }) {
  const limitFromPage = (page && typeof page === "object" && typeof page.limit === "number" && Number.isFinite(page.limit) && page.limit > 0)
    ? page.limit
    : null;

  const fallbackLimit = (typeof lastRequestedPageLimit === "number" && Number.isFinite(lastRequestedPageLimit) && lastRequestedPageLimit > 0)
    ? lastRequestedPageLimit
    : null;

  return limitFromPage ?? fallbackLimit;
}

export function truncateResultsByPageLimit({ results, page, lastRequestedPageLimit }) {
  const safeResults = (results === null || results === undefined) ? [] : results;
  if (!Array.isArray(safeResults)) {
    throw new Error(`[search-results-page-limit] Invalid results: expected array, got ${typeof safeResults}`);
  }

  const effectiveLimit = resolveEffectivePageLimit({ page, lastRequestedPageLimit });
  if (typeof effectiveLimit === "number") {
    return { results: safeResults.slice(0, effectiveLimit), effectiveLimit };
  }
  return { results: safeResults.slice(0), effectiveLimit: null };
}
