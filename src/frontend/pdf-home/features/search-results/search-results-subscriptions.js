import { SEARCH_EVENTS, SEARCH_RESULTS_EVENTS, FILTER_EVENTS } from "../../../common/event/event-constants.js";

export function installSearchResultsSubscriptions({
  logger,
  name,
  sidBase,
  globalEventBus,
  subscriptionBag,
  setLastRequestedPageLimit,
  setPendingFocusIds,
  applyPendingFocus,
  handleResultsUpdate,
}) {
  const unsubSearchRequested = globalEventBus.on(SEARCH_EVENTS.QUERY.REQUESTED, (data) => {
    const pagination = data?.pagination;
    if (pagination === null || pagination === undefined) {
      setLastRequestedPageLimit(null);
      logger.debug("[SearchResultsFeature] Pagination limit cleared (no pagination)");
      return;
    }
    if (typeof pagination !== "object") {
      throw new Error("[SearchResultsFeature] Invalid pagination: expected object|null");
    }
    const lim = Number(pagination.limit);
    if (Number.isFinite(lim) && lim > 0) {
      setLastRequestedPageLimit(lim);
      logger.debug("[SearchResultsFeature] Pagination limit set", { limit: lim });
      return;
    }
    setLastRequestedPageLimit(null);
    logger.debug("[SearchResultsFeature] Pagination limit cleared (invalid)");
  }, { subscriberId: `${name}:${sidBase}:search-query-req` });
  subscriptionBag.add(unsubSearchRequested);

  const unsubSearchResults = globalEventBus.on(SEARCH_EVENTS.RESULTS.UPDATED, (data) => {
    logger.info("[SearchResultsFeature] Search results received", {
      count: data.count,
      searchText: data.searchText,
    });
    handleResultsUpdate({
      results: data.records,
      count: data.count,
      searchText: data.searchText,
      focusId: data.focusId,
      page: data.page,
    });
  }, { subscriberId: `${name}:${sidBase}:search-results-updated` });
  subscriptionBag.add(unsubSearchResults);

  const unsubFilterResults = globalEventBus.on(FILTER_EVENTS.RESULTS.UPDATED, (data) => {
    logger.info("[SearchResultsFeature] Filter results received", {
      count: data.count,
      searchText: data.searchText,
    });
    handleResultsUpdate({
      results: data.results,
      count: data.count,
      searchText: data.searchText,
    });
  }, { subscriberId: `${name}:${sidBase}:filter-results-updated` });
  subscriptionBag.add(unsubFilterResults);

  logger.info("[SearchResultsFeature] Subscribed to search and filter events");

  const unsubFocusReq = globalEventBus.on(SEARCH_RESULTS_EVENTS.FOCUS.REQUESTED, (data) => {
    const rawIds = data?.ids;
    if (rawIds === null || rawIds === undefined) {
      setPendingFocusIds(null);
      return;
    }
    if (!Array.isArray(rawIds)) {
      throw new Error("[SearchResultsFeature] Invalid focus request: ids must be array");
    }
    const ids = rawIds.map((x) => String(x));
    logger.info("[SearchResultsFeature] Focus request received", { count: ids.length });
    setPendingFocusIds(ids.length ? ids : null);
    applyPendingFocus();
  }, { subscriberId: `${name}:${sidBase}:focus-requested` });
  subscriptionBag.add(unsubFocusReq);
}
