/**
 * @file PDF Viewer Manager
 * @module PDFViewerManager
 * @description Manages the PDF.js PDFViewer component.
 */

import { getLogger } from "../common/utils/logger.js";
import { PDFViewer } from "pdfjs-dist/web/pdf_viewer.js";

/**
 * @class PDFViewerManager
 * @description Manages the PDF.js PDFViewer component.
 */
export class PDFViewerManager {
  #logger;
  #viewer = null;
  #container = null;
  #eventBus = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewerManager");
  }

  /**
   * Initializes the PDFViewer.
   * @param {HTMLElement} container - The container element for the viewer.
   */
  initialize(container) {
    this.#container = container;
    if (!this.#container) {
      this.#logger.error("PDFViewer container not found!");
      return;
    }
    this.#viewer = new PDFViewer({
      container: this.#container,
      eventBus: this.#eventBus,
      // Other PDFViewer options can be added here
    });
    this.#logger.info("PDFViewer initialized");
  }

  /**
   * Loads a PDF document into the viewer.
   * @param {PDFDocumentProxy} pdfDocument - The PDF document to load.
   */
  load(pdfDocument) {
    if (!this.#viewer) {
      this.#logger.error("PDFViewer not initialized. Call initialize() first.");
      return;
    }
    this.#viewer.setDocument(pdfDocument);
    this.#logger.info("PDF document loaded into viewer");
  }

  /**
   * Gets the PDFViewer instance.
   * @returns {PDFViewer} The PDFViewer instance.
   */
  get viewer() {
    return this.#viewer;
  }
}