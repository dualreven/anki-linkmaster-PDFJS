/**
 * @file Global listener unified entry
 * @description
 * Unified entry for registering window/document global listeners inside pdf-viewer.
 * Prefer using these helpers instead of calling window/document.addEventListener directly.
 *
 * Fail-fast: invalid inputs throw.
 */

import { getLogger } from "../../common/utils/logger.js";

const logger = getLogger("PDFViewer.GlobalListenerScope");

function assertHandler(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(`[GlobalListenerScope] ${name} must be a function`);
  }
}

/**
 * Register a window event listener and return an unsubscribe function.
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean|AddEventListenerOptions} [options]
 * @returns {() => void}
 */
export function onWindow(type, handler, options) {
  if (!type || typeof type !== "string") {
    throw new Error("[GlobalListenerScope] type must be a non-empty string");
  }
  assertHandler(handler, "handler");

  window.addEventListener(type, handler, options);

  return () => {
    try {
      window.removeEventListener(type, handler, options);
    } catch (e) {
      logger.warn("[GlobalListenerScope] remove window listener failed", e);
    }
  };
}

/**
 * Register a document event listener and return an unsubscribe function.
 * @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean|AddEventListenerOptions} [options]
 * @returns {() => void}
 */
export function onDocument(type, handler, options) {
  if (!type || typeof type !== "string") {
    throw new Error("[GlobalListenerScope] type must be a non-empty string");
  }
  assertHandler(handler, "handler");

  document.addEventListener(type, handler, options);

  return () => {
    try {
      document.removeEventListener(type, handler, options);
    } catch (e) {
      logger.warn("[GlobalListenerScope] remove document listener failed", e);
    }
  };
}

