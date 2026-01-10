/**
 * SearchBox 的 EventBus 订阅（返回可清理的 cleanup）
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @param {any} params
 * @returns {asserts params is {
 *  eventBus: any,
 *  onResult?: (current: number, total: number) => void,
 *  onOpen: () => void,
 *  onClose: () => void,
 *  onToggle: () => void,
 *  subscriberId?: string,
 * }}
 */
function assertSubscribeSearchBoxEventsParams(params) {
  if (!isPlainObject(params)) {
    throw new Error("subscribeSearchBoxEvents: params must be a plain object");
  }

  const eventBus = /** @type {any} */ (params).eventBus;
  if (!eventBus || typeof eventBus.on !== "function") {
    throw new Error("subscribeSearchBoxEvents: eventBus.on must be a function");
  }

  const subscriberId = /** @type {any} */ (params).subscriberId ?? "SearchBox";
  if (typeof subscriberId !== "string" || subscriberId.trim() === "") {
    throw new Error("subscribeSearchBoxEvents: subscriberId must be a non-empty string");
  }

  if (typeof /** @type {any} */ (params).onOpen !== "function") {
    throw new Error("subscribeSearchBoxEvents: onOpen must be a function");
  }
  if (typeof /** @type {any} */ (params).onClose !== "function") {
    throw new Error("subscribeSearchBoxEvents: onClose must be a function");
  }
  if (typeof /** @type {any} */ (params).onToggle !== "function") {
    throw new Error("subscribeSearchBoxEvents: onToggle must be a function");
  }

  const onResult = /** @type {any} */ (params).onResult;
  if (typeof onResult !== "undefined" && typeof onResult !== "function") {
    throw new Error("subscribeSearchBoxEvents: onResult must be a function");
  }
}

/**
 * @param {{
 *  eventBus: any,
 *  onResult?: (current: number, total: number) => void,
 *  onOpen: () => void,
 *  onClose: () => void,
 *  onToggle: () => void,
 *  subscriberId?: string,
 * }} params
 * @returns {() => void}
 */
export function subscribeSearchBoxEvents(params) {
  assertSubscribeSearchBoxEventsParams(params);

  const { eventBus, onResult, onOpen, onClose, onToggle, subscriberId = "SearchBox" } = params;
  const unsubs = [];

  /**
   * @param {any} unsub
   */
  const pushUnsub = (unsub) => {
    if (typeof unsub !== "function") {
      throw new Error("subscribeSearchBoxEvents: eventBus.on must return an unsubscribe function");
    }
    unsubs.push(unsub);
  };

  try {
    // Only subscribe to result events if handler provided
    if (typeof onResult === "function") {
      pushUnsub(eventBus.on(
        PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED,
        ({ current, total }) => onResult(current, total),
        { subscriberId }
      ));

      pushUnsub(eventBus.on(
        PDF_VIEWER_EVENTS.SEARCH.RESULT.FOUND,
        ({ current, total }) => onResult(current, total),
        { subscriberId }
      ));

      pushUnsub(eventBus.on(
        PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND,
        () => onResult(0, 0),
        { subscriberId }
      ));
    }

    pushUnsub(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, () => onOpen(), { subscriberId }));
    pushUnsub(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.CLOSE, () => onClose(), { subscriberId }));
    pushUnsub(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.TOGGLE, () => onToggle(), { subscriberId }));
  } catch (e) {
    for (const fn of unsubs.splice(0)) {
      fn();
    }
    throw e;
  }

  return () => {
    for (const fn of unsubs.splice(0)) {
      fn();
    }
  };
}
