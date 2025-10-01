/**
 * @file PDF Viewer Manager
 * @module PDFViewerManager
 * @description Manages the PDF.js PDFViewer component with full functionality
 */

import { getLogger } from "../common/utils/logger.js";
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// PDF.js Viewer组件需要全局pdfjsLib
if (typeof globalThis !== 'undefined') {
  globalThis.pdfjsLib = pdfjsLib;
} else if (typeof window !== 'undefined') {
  window.pdfjsLib = pdfjsLib;
}

import { EventBus, PDFViewer, PDFLinkService } from "@pdfjs/web/pdf_viewer.mjs";

/**
 * @class PDFViewerManager
 * @description 管理PDF.js的PDFViewer组件，提供完整的PDF查看功能
 */
export class PDFViewerManager {
  #logger;
  #container = null;
  #eventBus = null;
  #pdfViewer = null;
  #linkService = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewerManager");
  }

  /**
   * 初始化PDFViewer组件
   * @param {HTMLElement} container - PDF容器元素
   */
  initialize(container) {
    this.#container = container;
    if (!this.#container) {
      const errorMsg = "PDF container not found!";
      this.#logger.error(errorMsg);
      console.error("[PDFViewerManager]", errorMsg);
      throw new Error(errorMsg);
    }

    this.#logger.info(`Initializing PDFViewer with container:`, container);
    console.log("[PDFViewerManager] Container element:", container);

    try {
      // 创建PDF.js EventBus
      this.#logger.info("Creating PDF.js EventBus...");
      const pdfjsEventBus = new EventBus();
      this.#logger.info("PDF.js EventBus created");

      // 创建PDFLinkService
      this.#logger.info("Creating PDFLinkService...");
      this.#linkService = new PDFLinkService({
        eventBus: pdfjsEventBus,
      });
      this.#logger.info("PDFLinkService created");

      // 创建PDFViewer实例
      this.#logger.info("Creating PDFViewer instance...");
      console.log("[PDFViewerManager] Creating PDFViewer with options:", {
        container: this.#container,
        textLayerMode: 2,
        annotationMode: 2,
        annotationEditorMode: 0,
        enableHWA: true
      });

      this.#pdfViewer = new PDFViewer({
        container: this.#container,
        eventBus: pdfjsEventBus,
        linkService: this.#linkService,
        textLayerMode: 2, // 启用增强文本层
        annotationMode: 2, // 启用表单和注释
        annotationEditorMode: 0, // 禁用注释编辑器（避免工具栏）
        removePageBorders: false,
        enableHWA: true, // 启用硬件加速
      });

      this.#logger.info("PDFViewer instance created");
      this.#linkService.setViewer(this.#pdfViewer);

      this.#logger.info("PDFViewer initialized with full functionality");
    } catch (error) {
      this.#logger.error("Failed to initialize PDFViewer:", error);
      console.error("[PDFViewerManager] Full error:", error.message, error.stack);
      throw error;
    }
  }

  /**
   * 加载PDF文档
   * @param {PDFDocumentProxy} pdfDocument - PDF文档对象
   */
  load(pdfDocument) {
    if (!this.#pdfViewer) {
      this.#logger.error("PDFViewer not initialized. Call initialize() first.");
      return;
    }

    this.#pdfViewer.setDocument(pdfDocument);
    this.#linkService.setDocument(pdfDocument);
    this.#logger.info("PDF document loaded into PDFViewer");
  }

  /**
   * 获取容器元素
   * @returns {HTMLElement}
   */
  get container() {
    return this.#container;
  }

  /**
   * 获取PDFViewer实例
   * @returns {PDFViewer}
   */
  get viewer() {
    return this.#pdfViewer;
  }

  /**
   * 获取当前页码
   * @returns {number}
   */
  get currentPageNumber() {
    return this.#pdfViewer?.currentPageNumber || 1;
  }

  /**
   * 设置当前页码
   * @param {number} pageNumber
   */
  set currentPageNumber(pageNumber) {
    if (this.#pdfViewer) {
      this.#pdfViewer.currentPageNumber = pageNumber;
    }
  }

  /**
   * 获取当前缩放比例
   * @returns {number}
   */
  get currentScale() {
    return this.#pdfViewer?.currentScale || 1.0;
  }

  /**
   * 设置缩放比例
   * @param {number} scale
   */
  set currentScale(scale) {
    if (this.#pdfViewer) {
      this.#pdfViewer.currentScale = scale;
    }
  }

  /**
   * 设置缩放模式
   * @param {string} value - 'auto', 'page-fit', 'page-width', 'page-height', 或数字
   */
  set currentScaleValue(value) {
    if (this.#pdfViewer) {
      this.#pdfViewer.currentScaleValue = value;
    }
  }

  /**
   * 获取页面旋转角度
   * @returns {number} 0, 90, 180, 或 270
   */
  get pagesRotation() {
    return this.#pdfViewer?.pagesRotation || 0;
  }

  /**
   * 设置页面旋转
   * @param {number} rotation - 0, 90, 180, 或 270
   */
  set pagesRotation(rotation) {
    if (this.#pdfViewer) {
      this.#pdfViewer.pagesRotation = rotation;
    }
  }

  /**
   * 获取滚动模式
   * @returns {number} ScrollMode 常量
   */
  get scrollMode() {
    return this.#pdfViewer?.scrollMode || 0;
  }

  /**
   * 设置滚动模式
   * @param {number} mode - ScrollMode 常量
   */
  set scrollMode(mode) {
    if (this.#pdfViewer) {
      this.#pdfViewer.scrollMode = mode;
    }
  }

  /**
   * 获取跨页模式
   * @returns {number} SpreadMode 常量
   */
  get spreadMode() {
    return this.#pdfViewer?.spreadMode || 0;
  }

  /**
   * 设置跨页模式
   * @param {number} mode - SpreadMode 常量
   */
  set spreadMode(mode) {
    if (this.#pdfViewer) {
      this.#pdfViewer.spreadMode = mode;
    }
  }

  /**
   * 获取总页数
   * @returns {number}
   */
  get pagesCount() {
    return this.#pdfViewer?.pagesCount || 0;
  }
}
