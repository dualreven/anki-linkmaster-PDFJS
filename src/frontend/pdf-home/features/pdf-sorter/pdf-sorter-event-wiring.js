import { SEARCH_EVENTS, HEADER_EVENTS, SORTER_EVENTS } from "../../../common/event/event-constants.js";

export function bindSorterButton({
  globalEventBus,
  sorterPanel,
  subscriptionBag,
  logger,
}) {
  if (!logger) { throw new Error("[PDFSorterFeature] bindSorterButton: logger is required"); }

  if (!globalEventBus) {
    logger.warn("[PDFSorterFeature] Global event bus not available; falling back to DOM binding");

    const sortBtn = document.getElementById("sort-btn");
    if (!sortBtn) {
      logger.warn("[PDFSorterFeature] Sort button not found for DOM fallback");
      return;
    }

    const handleSortClick = () => {
      logger.info("[PDFSorterFeature] Sort button clicked (DOM fallback)");
      sorterPanel.toggle();
    };

    sortBtn.addEventListener("click", handleSortClick);
    subscriptionBag?.add(() => {
      sortBtn.removeEventListener("click", handleSortClick);
    });
    return;
  }

  const togglePanel = (source = "unknown") => {
    if (!sorterPanel) {
      logger.warn("[PDFSorterFeature] Sort panel is not ready");
      return;
    }

    logger.info(`[PDFSorterFeature] Sort toggle requested via ${source}`);
    sorterPanel.toggle();
  };

  const unsubSearchSort = globalEventBus.on(SEARCH_EVENTS.ACTIONS.SORT_REQUESTED, (payload = {}) => {
    togglePanel(payload.source || SEARCH_EVENTS.ACTIONS.SORT_REQUESTED);
  });

  const unsubHeaderSort = globalEventBus.on(HEADER_EVENTS.SORT.REQUESTED, (payload = {}) => {
    togglePanel(payload.source || HEADER_EVENTS.SORT.REQUESTED);
  });

  subscriptionBag?.add(unsubSearchSort);
  subscriptionBag?.add(unsubHeaderSort);

  logger.info("[PDFSorterFeature] Listening global sort toggle events (search/header)");
}

export function registerEventListeners({
  scopedEventBus,
  subscriptionBag,
  logger,
  onModeChanged,
  onApplySort,
  onClearSort,
}) {
  if (!logger) { throw new Error("[PDFSorterFeature] registerEventListeners: logger is required"); }
  if (!scopedEventBus) {
    logger.warn("ScopedEventBus not available, skipping event registration");
    return;
  }

  const unsubModeChanged = scopedEventBus.on(SORTER_EVENTS.MODE.CHANGED, (data) => {
    onModeChanged(data?.mode);
  });
  subscriptionBag?.add(unsubModeChanged);

  const unsubApplySort = scopedEventBus.on(SORTER_EVENTS.SORT.REQUESTED, (data) => {
    onApplySort(data);
  });
  subscriptionBag?.add(unsubApplySort);

  const unsubClearSort = scopedEventBus.on(SORTER_EVENTS.SORT.CLEARED, () => {
    onClearSort();
  });
  subscriptionBag?.add(unsubClearSort);

  const bagSize = subscriptionBag ? subscriptionBag.size() : "unknown";
  logger.debug(`[PDFSorterFeature] Registered event listeners, subscriptionBag size=${bagSize}`);
}

export function subscribeToSearchResultsUpdated({
  globalEventBus,
  subscriptionBag,
  logger,
  sortManager,
  applySort,
}) {
  if (!globalEventBus) { throw new Error("[PDFSorterFeature] subscribeToSearchResultsUpdated: globalEventBus is required"); }
  if (!logger) { throw new Error("[PDFSorterFeature] subscribeToSearchResultsUpdated: logger is required"); }

  const unsubListLoaded = globalEventBus.on(SEARCH_EVENTS.RESULTS.UPDATED, (data) => {
    try {
      const items = (data && (data.records || data.files || data.items)) || [];
      logger.info("[PDFSorterFeature] Search results updated (cache for sorting)", { count: Array.isArray(items) ? items.length : 0 });
      if (Array.isArray(items)) {
        sortManager.setDataSource(items);
      }
    } catch (e) { void e; /* logger-guard */ }

    try {
      applySort();
    } catch (e) { void e; /* logger-guard */ }
  }, { subscriberId: "pdf-sorter:results-updated" });

  subscriptionBag?.add(unsubListLoaded);
}
