/**
 * Clipboard helpers for TextHighlightTool
 * - Fail-closed: if neither Clipboard API nor DOM fallback is available, do nothing but log error.
 */

/**
 * @param {string} text
 * @param {{ logger?: any, nav?: Navigator, doc?: Document }} [deps]
 * @returns {void}
 */
export function copyTextToClipboard(text, deps = {}) {
  const logger = deps?.logger ?? console;
  const nav = deps?.nav ?? (typeof navigator !== "undefined" ? navigator : null);
  const doc = deps?.doc ?? (typeof document !== "undefined" ? document : null);

  if (!text) {
    logger?.warn?.("[TextHighlightTool] No text available for copy");
    return;
  }

  if (nav?.clipboard?.writeText) {
    nav.clipboard.writeText(text)
      .then(() => {
        logger?.info?.("[TextHighlightTool] Copied highlight text to clipboard");
      })
      .catch((error) => {
        logger?.warn?.("[TextHighlightTool] Clipboard API failed, fallback in use", error);
        fallbackCopyToClipboard(text, { logger, doc });
      });
    return;
  }

  fallbackCopyToClipboard(text, { logger, doc });
}

/**
 * @param {string} text
 * @param {{ logger?: any, doc?: Document }} [deps]
 * @returns {void}
 */
export function fallbackCopyToClipboard(text, deps = {}) {
  const logger = deps?.logger ?? console;
  const doc = deps?.doc ?? (typeof document !== "undefined" ? document : null);

  if (!doc?.body || typeof doc.createElement !== "function") {
    logger?.error?.("[TextHighlightTool] Clipboard fallback unavailable (no DOM)");
    return;
  }

  try {
    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    doc.body.appendChild(textarea);
    textarea.select();

    try {
      const ok = doc.execCommand?.("copy");
      if (ok) {
        logger?.info?.("[TextHighlightTool] Copied highlight text via fallback");
      } else {
        logger?.error?.("[TextHighlightTool] Failed to copy highlight text via fallback");
      }
    } catch (error) {
      logger?.error?.("[TextHighlightTool] Failed to copy highlight text", error);
    } finally {
      textarea.remove();
    }
  } catch (error) {
    logger?.error?.("[TextHighlightTool] Failed to prepare fallback textarea", error);
  }
}

