import { ObservableState } from "../../../../common/utils/observable.js";

/**
 * Manages generic Viewer State (Loading, Error, Page Number).
 * Replaces legacy UIStateManager.
 */
export class ViewerManager {
  constructor(eventBus, logger) {
    this.eventBus = eventBus;
    this.logger = logger;

    this.store = new ObservableState({
      currentPage: 1,
      totalPages: 0,
      isLoading: false,
      isLoaded: false,
      hasError: false,
      errorMessage: ""
    }, {
      name: "ViewerStore",
      logger: this.logger
    });
  }

  setLoading(isLoading, isLoaded) {
    const updates = { isLoading };
    if (isLoaded !== undefined) {
      updates.isLoaded = isLoaded;
      if (isLoaded) {
        updates.hasError = false;
        updates.errorMessage = "";
      }
    }
    this.store.set(updates);
  }

  setError(message) {
    this.store.set({
      hasError: true,
      errorMessage: message || "Unknown Error",
      isLoading: false
    });
    this.logger.error(`[ViewerManager] Error: ${message}`);
  }

  clearError() {
    this.store.set({
      hasError: false,
      errorMessage: ""
    });
  }

  setPageInfo(page, total) {
    const updates = { currentPage: page };
    if (total !== undefined) {
      updates.totalPages = total;
    }
    this.store.set(updates);
    this.logger.debug(`[ViewerManager] Page updated: ${page}/${total ?? "?"}`);
  }

  destroy() {
    // Cleanup if needed
  }
}
