/**
 * @file PDF Viewer Manager
 * @module PDFViewerManager
 * @description Manages the PDF.js PDFViewer component.
 *
 * IMPORTANT: This file is NOT using PDFViewer due to AnnotationEditorType errors.
 * Instead, we render PDFs manually using the page rendering API.
 */

import { getLogger } from "../common/utils/logger.js";

/**
 * @class PDFViewerManager
 * @description Manages the PDF.js PDFViewer component.
 */
export class PDFViewerManager {
  #logger;
  #container = null;
  #eventBus = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewerManager");
  }

  /**
   * Initializes the PDF container.
   * NOTE: We are NOT using pdfjs PDFViewer component due to AnnotationEditorType issues.
   * @param {HTMLElement} container - The container element for the viewer.
   */
  initialize(container) {
    this.#container = container;
    if (!this.#container) {
      this.#logger.error("PDF container not found!");
      return;
    }

    this.#logger.info("PDF container initialized (no PDFViewer component, using manual rendering)");
  }

  /**
   * Loads a PDF document.
   * NOTE: This is a placeholder. Actual rendering happens elsewhere.
   * @param {PDFDocumentProxy} pdfDocument - The PDF document to load.
   */
  load(pdfDocument) {
    if (!this.#container) {
      this.#logger.error("PDF container not initialized. Call initialize() first.");
      return;
    }
    this.#logger.info("PDF document ready (using canvas-based rendering)");
    // The actual rendering will be done by ui-canvas-render or similar
  }

  /**
   * Gets the container element.
   * @returns {HTMLElement} The container element.
   */
  get container() {
    return this.#container;
  }
}