/**
 * @file PDF Viewer Manager
 * @module PDFViewerManager
 * @description Manages the PDF.js PDFViewer component with full functionality
 */

import { getLogger } from "../../../../common/utils/logger.js";
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// PDF.js Viewer组件需要全局pdfjsLib
if (typeof globalThis !== 'undefined') {
  globalThis.pdfjsLib = pdfjsLib;
} else if (typeof window !== 'undefined') {
  window.pdfjsLib = pdfjsLib;
}

import {
  EventBus,
  PDFViewer,
  PDFLinkService,
  ScrollMode,
  SpreadMode
} from "@pdfjs/web/pdf_viewer.mjs";

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
  #pdfjsEventBus = null;  // PDF.js的EventBus实例

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
      this.#pdfjsEventBus = new EventBus();
      this.#logger.info("PDF.js EventBus created");

      // 创建PDFLinkService
      this.#logger.info("Creating PDFLinkService...");
      this.#linkService = new PDFLinkService({
        eventBus: this.#pdfjsEventBus,
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

      // 查找viewer元素（显示PDF页面的容器）
      const viewerElement = this.#container.querySelector('.pdfViewer') ||
                           this.#container.querySelector('#viewer') ||
                           this.#container.firstElementChild;

      this.#logger.info(`Found viewer element:`, viewerElement);

      this.#pdfViewer = new PDFViewer({
        container: this.#container,
        viewer: viewerElement, // 明确指定viewer元素
        eventBus: this.#pdfjsEventBus,
        linkService: this.#linkService,
        textLayerMode: 2, // 启用增强文本层
        annotationMode: 2, // 启用表单和注释
        annotationEditorMode: 0, // 禁用注释编辑器（避免工具栏）
        removePageBorders: true, // 移除页面边框，避免textLayer偏移9px
        useOnlyCssZoom: false, // 使用Canvas scale模式，确保textLayer与canvas同步
        maxCanvasPixels: 16777216, // 设置最大canvas像素，避免scale计算错误
        enableHWA: true, // 启用硬件加速
      });

      this.#logger.info("PDFViewer instance created");
      this.#linkService.setViewer(this.#pdfViewer);

      // 监听PDFViewer的事件并桥接到应用EventBus
      this.#setupEventBridge(this.#pdfjsEventBus);

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

    this.#logger.info("Before setDocument, checking viewer state...");
    this.#logger.info(`PDFViewer instance exists: ${!!this.#pdfViewer}`);
    this.#logger.info(`pdfDocument: ${pdfDocument}, numPages: ${pdfDocument?.numPages}`);
    this.#logger.info(`Container element: ${this.#container?.tagName}.${this.#container?.className}`);
    this.#logger.info(`Container innerHTML length: ${this.#container?.innerHTML?.length || 0}`);

    try {
      this.#logger.info("Calling pdfViewer.setDocument...");
      this.#pdfViewer.setDocument(pdfDocument);
      this.#logger.info("setDocument returned successfully");

      this.#logger.info("Calling linkService.setDocument...");
      this.#linkService.setDocument(pdfDocument);
      this.#logger.info("linkService.setDocument returned successfully");

      this.#logger.info("Immediately after setDocument:");
      this.#logger.info(`  pdfViewer.pdfDocument: ${!!this.#pdfViewer.pdfDocument}`);
      this.#logger.info(`  pdfViewer.pagesCount: ${this.#pdfViewer.pagesCount}`);

      // 强制刷新PDFViewer以确保textLayer和canvas尺寸一致
      // 这会触发PDFViewer重新计算所有页面的viewport和布局
      this.#logger.info("Forcing PDFViewer update to sync layer dimensions...");
      this.#pdfViewer.update();
      this.#logger.info(`PDFViewer updated, currentScale: ${this.#pdfViewer.currentScale}`);
    } catch (error) {
      this.#logger.error("Error during setDocument:", error);
    }

    this.#logger.info("PDF document loaded into PDFViewer");

    // 等待一下，然后检查是否有页面被渲染
    setTimeout(() => {
      this.#logger.info("After setDocument (2s delay), checking viewer content...");
      const viewerElement = this.#container.querySelector('.pdfViewer') || this.#container.querySelector('#viewer');
      this.#logger.info(`Viewer element innerHTML length: ${viewerElement?.innerHTML?.length || 0}`);
      this.#logger.info(`Viewer element children count: ${viewerElement?.children?.length || 0}`);

      // 🔍 详细分析子元素类型
      if (viewerElement && viewerElement.children.length > 0) {
        const childrenTypes = {};
        for (let i = 0; i < viewerElement.children.length; i++) {
          const child = viewerElement.children[i];
          const type = `${child.tagName}.${child.className}`;
          childrenTypes[type] = (childrenTypes[type] || 0) + 1;
        }
        this.#logger.info(`Children types breakdown: ${JSON.stringify(childrenTypes, null, 2)}`);
        this.#logger.info(`First child: ${viewerElement.children[0].tagName}.${viewerElement.children[0].className}`);

        // 统计真正的页面容器
        const pageContainers = viewerElement.querySelectorAll('.page');
        this.#logger.info(`Actual page containers (.page): ${pageContainers.length}`);

        // 检查是否有重复的页面
        this.#logger.info(`Expected pages from pdfDocument: ${this.#pdfViewer.pdfDocument?.numPages || 'unknown'}`);
      }

      this.#logger.info(`PDFViewer.pagesCount: ${this.#pdfViewer.pagesCount}`);
      this.#logger.info(`PDFViewer.currentPageNumber: ${this.#pdfViewer.currentPageNumber}`);
      this.#logger.info(`PDFViewer.currentScale: ${this.#pdfViewer.currentScale}`);
    }, 2000);
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

  /**
   * 获取PDFViewer实例（用于SearchFeature等扩展功能）
   * @returns {PDFViewer}
   */
  get pdfViewer() {
    return this.#pdfViewer;
  }

  /**
   * 获取PDF.js EventBus实例（用于SearchFeature等扩展功能）
   * @returns {EventBus}
   */
  get eventBus() {
    // 注意：这是PDF.js的EventBus，不是应用的EventBus
    return this.#pdfjsEventBus;
  }

  /**
   * 获取PDFLinkService实例（用于SearchFeature等扩展功能）
   * @returns {PDFLinkService}
   */
  get linkService() {
    return this.#linkService;
  }

  /**
   * 获取ScrollMode常量
   * @returns {Object} ScrollMode枚举
   */
  static get ScrollMode() {
    return ScrollMode;
  }

  /**
   * 获取SpreadMode常量
   * @returns {Object} SpreadMode枚举
   */
  static get SpreadMode() {
    return SpreadMode;
  }

  /**
   * 设置PDF.js EventBus到应用EventBus的事件桥接
   * @param {EventBus} pdfjsEventBus - PDF.js的EventBus实例
   * @private
   */
  #setupEventBridge(pdfjsEventBus) {
    // 监听页面变化事件
    pdfjsEventBus.on('pagechanging', (evt) => {
      const pageNumber = evt.pageNumber;
      this.#logger.info(`PDFViewer page changing to ${pageNumber}`);

      // 发送到应用EventBus（修复事件名称格式为 module:action:status）
      if (this.#eventBus) {
        this.#eventBus.emit('pdf-viewer:page:changing', { pageNumber }, { actorId: 'PDFViewerManager' });
      }
    });

    // 监听缩放变化事件
    pdfjsEventBus.on('scalechanging', (evt) => {
      const scale = evt.scale;
      this.#logger.info(`PDFViewer scale changing to ${scale}`);

      // 发送到应用EventBus（修复事件名称格式为 module:action:status）
      if (this.#eventBus) {
        this.#eventBus.emit('pdf-viewer:zoom:changing', { scale }, { actorId: 'PDFViewerManager' });
      }
    });

    this.#logger.info("PDFViewer event bridge setup complete");
  }
}
