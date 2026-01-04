/**
 * SearchBox 的 EventBus 订阅（返回可清理的 cleanup）
 *
 * 详细说明见：docs/standards/pdf-search-search-box.md
 */

import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * @param {{
 *  eventBus: any,
 *  onResult: (current: number, total: number) => void,
 *  onOpen: () => void,
 *  onClose: () => void,
 *  onToggle: () => void,
 *  subscriberId?: string,
 * }} params
 * @returns {() => void}
 */
export function subscribeSearchBoxEvents(params) {
  const { eventBus, onResult, onOpen, onClose, onToggle, subscriberId = "SearchBox" } = params;
  const unsubs = [];

  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.SEARCH.RESULT.UPDATED,
    ({ current, total }) => onResult(current, total),
    { subscriberId }
  ));

  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.SEARCH.RESULT.FOUND,
    ({ current, total }) => onResult(current, total),
    { subscriberId }
  ));

  unsubs.push(eventBus.on(
    PDF_VIEWER_EVENTS.SEARCH.RESULT.NOT_FOUND,
    () => onResult(0, 0),
    { subscriberId }
  ));

  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.OPEN, () => onOpen(), { subscriberId }));
  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.CLOSE, () => onClose(), { subscriberId }));
  unsubs.push(eventBus.on(PDF_VIEWER_EVENTS.SEARCH.UI.TOGGLE, () => onToggle(), { subscriberId }));

  return () => {
    for (const fn of unsubs.splice(0)) {
      if (typeof fn === "function") {
        fn();
      }
    }
  };
}
