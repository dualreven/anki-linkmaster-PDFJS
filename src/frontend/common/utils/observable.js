/**
 * @file Lightweight Observable State Container
 * @description A zero-dependency state management utility to replace EventBus for business logic.
 * Implements the "Manager + Store" pattern with selector support and safe updates.
 *
 * Design goals:
 * 1. Unidirectional Data Flow (Manager -> Store -> UI)
 * 2. Type-safe(ish) updates via replacers/updaters
 * 3. Granular subscriptions via selectors to avoid unnecessary re-renders
 * 4. Zero dependencies (no React/Redux/MobX required)
 */

/* eslint-disable no-console */
const defaultLogger = {
  debug: (...args) => console.debug("[Observable]", ...args),
  info: (...args) => console.info("[Observable]", ...args),
  warn: (...args) => console.warn("[Observable]", ...args),
  error: (...args) => console.error("[Observable]", ...args)
};
/* eslint-enable no-console */

/**
 * Compare two values for equality.
 * Uses strict equality for primitives, and supports a custom comparator.
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if equal
 */
function defaultEquals(a, b) {
  return a === b;
}

export class ObservableState {
  /**
   * @param {Object} initialState - The initial state object (must be an object/array, not primitive)
   * @param {Object} [options]
   * @param {string} [options.name="Store"] - Name for debugging/logging
   * @param {Object} [options.logger] - Logger instance (defaults to console wrapper)
   * @param {boolean} [options.debug=false] - Enable verbose state change logging
   */
  constructor(initialState, options = {}) {
    this._state = initialState;
    this._listeners = new Set();
    this._name = options.name || "Store";
    this._logger = options.logger || defaultLogger;
    this._debug = !!options.debug;

    if (this._debug) {
      this._logger.debug(`Initialized ${this._name}`, initialState);
    }
  }

  /**
   * Get the current state snapshot.
   * @returns {Object} Current state
   */
  get() {
    return this._state;
  }

  /**
   * Update state by merging a partial object.
   * @param {Object|Function} partialOrUpdater - Partial state object OR function (prev) => partial
   * @example store.set({ isLoading: true });
   * @example store.set(prev => ({ count: prev.count + 1 }));
   */
  set(partialOrUpdater) {
    const oldState = this._state;
    let partial;

    try {
      if (typeof partialOrUpdater === "function") {
        partial = partialOrUpdater(oldState);
      } else {
        partial = partialOrUpdater;
      }

      if (!partial || typeof partial !== "object") {
        this._logger.warn(`${this._name}: set() called with non-object`, partial);
        return;
      }

      const newState = { ...oldState, ...partial };
      this._commit(newState, oldState, "set");
    } catch (error) {
      this._logger.error(`${this._name}: Error calculating new state in set()`, error);
      throw error; // Fail fast
    }
  }

  /**
   * Completely replace the state.
   * Useful for resetting state or loading from persistence.
   * @param {Object} nextState - The new state object
   */
  replace(nextState) {
    const oldState = this._state;
    this._commit(nextState, oldState, "replace");
  }

  /**
   * Internal commit method to update state and notify listeners.
   * @param {Object} newState - New state
   * @param {Object} oldState - Old state
   * @param {string} actionType - Action type (set/replace)
   */
  _commit(newState, oldState, actionType) {
    if (newState === oldState) {return;} // No change reference

    this._state = newState;

    if (this._debug) {
      this._logger.debug(`${this._name} [${actionType}]`, { prev: oldState, next: newState });
    }

    this._notify(newState, oldState);
  }

  /**
   * Subscribe to state changes.
   *
   * Usage 1: Subscribe to all changes
   * store.subscribe((newState, oldState) => { ... })
   *
   * Usage 2: Subscribe to specific slice (Recommended)
   * store.subscribe(state => state.user.name, (name, oldName) => { ... })
   *
   * @param {Function} selectorOrListener - Selector function (state => part) OR listener (state, old) => void
   * @param {Function} [listener] - Listener function (part, oldPart) => void (if first arg is selector)
   * @param {Object} [options]
   * @param {Function} [options.equals] - Custom equality check (default: ===)
   * @param {boolean} [options.fireImmediately] - Fire listener immediately with current state
   * @returns {Function} Unsubscribe function
   */
  subscribe(selectorOrListener, listener, options = {}) {
    let actualListener;
    let selector = null;
    let equals = options.equals || defaultEquals;
    let actualOptions = options;

    // Overload handling
    if (arguments.length === 1 || (arguments.length === 2 && typeof listener === "object")) {
      // Usage 1: subscribe(listener)
      actualListener = selectorOrListener;
      actualOptions = listener || {};
      equals = actualOptions.equals || defaultEquals;
    } else {
      // Usage 2: subscribe(selector, listener, options)
      selector = selectorOrListener;
      actualListener = listener;
    }

    const subscription = {
      listener: actualListener,
      selector,
      equals,
      // Store last selected value to prevent unnecessary fires
      lastValue: selector ? selector(this._state) : this._state
    };

    this._listeners.add(subscription);

    // Optional: Fire immediately
    if (actualOptions.fireImmediately) {
      try {
        const current = selector ? selector(this._state) : this._state;
        // For immediate fire, we often don't have a "previous" value, or we use undefined/current
        actualListener(current, undefined);
      } catch (err) {
        this._logger.error(`${this._name}: Error in fireImmediately listener`, err);
      }
    }

    // Return unsubscribe
    return () => {
      this._listeners.delete(subscription);
    };
  }

  /**
   * Notify all listeners
   * @param {Object} newState - New state
   * @param {Object} oldState - Old state
   */
  _notify(newState, oldState) {
    for (const sub of this._listeners) {
      try {
        if (sub.selector) {
          // Granular subscription
          const newValue = sub.selector(newState);
          const oldValue = sub.lastValue;

          if (!sub.equals(newValue, oldValue)) {
            sub.lastValue = newValue; // Update cache
            sub.listener(newValue, oldValue);
          }
        } else {
          // Global subscription
          sub.listener(newState, oldState);
        }
      } catch (error) {
        this._logger.error(`${this._name}: Error in subscriber`, error);
        // We do NOT break the loop. Other listeners must run.
        // But we log the error loudly.
      }
    }
  }
}
