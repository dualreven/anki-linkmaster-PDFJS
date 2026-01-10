/**
 * @file pdf-id-provider.js
 * @description Provides a decoupled way to access the current PDF ID.
 */

/**
 * Creates a function that returns the current PDF ID.
 * This decouples the adapters from directly accessing URL/window context.
 *
 * @param {() => string | null} getter - A function to get the current PDF ID.
 * @returns {() => string}
 */
export function createPdfIdProvider(getter) {
  if (typeof getter !== "function") {
    throw new Error("[PdfIdProvider] getter is required");
  }

  return () => {
    const value = getter();
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("[PdfIdProvider] pdfId is required");
    }
    return value;
  };
}
