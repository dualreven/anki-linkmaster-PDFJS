import { ObservableState } from "../../../../common/utils/observable.js";

/**
 * Manages Search State (Query, Results, Options, UI Visibility).
 */
export class SearchManager {
  constructor(logger) {
    this.logger = logger;

    this.store = new ObservableState({
      query: "",
      currentIndex: 0,
      totalMatches: 0,
      matches: [],
      isSearching: false,
      isVisible: false,
      options: {
        caseSensitive: false,
        wholeWords: false,
        highlightAll: true,
        useRegex: false,
      }
    }, {
      name: "SearchStore",
      logger: this.logger
    });
  }

  setQuery(query) {
    this.store.set({ query: query || "" });
    this.logger.debug(`[SearchManager] Query: ${query}`);
  }

  updateOptions(options) {
    const current = this.store.get().options;
    this.store.set({ options: { ...current, ...options } });
    this.logger.debug("[SearchManager] Options updated");
  }

  setSearching(isSearching) {
    this.store.set({ isSearching: !!isSearching });
  }

  updateResults(current, total, matches = []) {
    this.store.set({
      currentIndex: current || 0,
      totalMatches: total || 0,
      matches: matches,
      isSearching: false
    });
    this.logger.debug(`[SearchManager] Results: ${current}/${total}`);
  }

  setVisible(isVisible) {
    this.store.set({ isVisible: !!isVisible });
  }

  reset() {
    this.store.set({
      query: "",
      currentIndex: 0,
      totalMatches: 0,
      matches: [],
      isSearching: false
    });
    this.logger.info("[SearchManager] Reset");
  }

  /**
     * Advance to next match index (cyclic)
     * @returns {number} New index
     */
  nextMatch() {
    const { currentIndex, totalMatches } = this.store.get();
    if (totalMatches === 0) {return 0;}

    const next = currentIndex >= totalMatches ? 1 : currentIndex + 1;
    this.store.set({ currentIndex: next });
    return next;
  }

  /**
     * Go to previous match index (cyclic)
     * @returns {number} New index
     */
  previousMatch() {
    const { currentIndex, totalMatches } = this.store.get();
    if (totalMatches === 0) {return 0;}

    const prev = currentIndex <= 1 ? totalMatches : currentIndex - 1;
    this.store.set({ currentIndex: prev });
    return prev;
  }

  get hasResults() {
    return this.store.get().totalMatches > 0;
  }

  destroy() {
    // Cleanup
  }
}
