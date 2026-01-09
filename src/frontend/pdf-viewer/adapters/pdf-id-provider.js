/**
 * @file pdf-id-provider.js
 * @description Provides a decoupled way to access the current PDF ID.
 */

/**
 * Creates a function that returns the current PDF ID.
 * This decouples the adapters from directly accessing `window.location`.
 *
 * @param {() => string | null} [getter] - An optional function to get the PDF ID. Defaults to reading from URL.
 * @returns {() => string | null}
 */
export function createPdfIdProvider(getter) {
  if (getter) {
    return getter;
  }

  // Default implementation that reads from the URL, for backward compatibility.
  return () => {
    try {
      if (typeof window === "undefined" || !window.location) {
        return null;
      }
      const params = new URLSearchParams(window.location.search || "");
      const value = params.get("pdf-id");
      return value && typeof value === "string" && value.trim() !== "" ? value : null;
    } catch {
      return null;
    }
  };
}
