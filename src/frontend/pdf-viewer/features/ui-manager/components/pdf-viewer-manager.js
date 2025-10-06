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

// 模块级日志记录器（用于非实例化路径的快速日志）
const logger = getLogger('PDFViewerManager');

/**
class PDFViewerManager
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
      logger.error("[PDFViewerManager]", errorMsg);
      throw new Error(errorMsg);
    }

    this.#logger.info(`Initializing PDFViewer`);
    logger.debug("[PDFViewerManager] Container element (debug)", container);

    try {
      // 创建PDF.js EventBus
      this.#logger.debug("Creating PDF.js EventBus...");
      this.#pdfjsEventBus = new EventBus();
      this.#logger.debug("PDF.js EventBus created");

      // 创建PDFLinkService
      this.#logger.debug("Creating PDFLinkService...");
      this.#linkService = new PDFLinkService({
        eventBus: this.#pdfjsEventBus,
      });
      this.#logger.debug("PDFLinkService created");

      // 创建PDFViewer实例
      this.#logger.debug("Creating PDFViewer instance...");
      logger.debug("[PDFViewerManager] Creating PDFViewer with options:", {
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

      this.#logger.debug(`Found viewer element:`, viewerElement);

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

      this.#logger.debug("PDFViewer instance created");
      this.#linkService.setViewer(this.#pdfViewer);

      // 监听PDFViewer的事件并桥接到应用EventBus
      this.#setupEventBridge(this.#pdfjsEventBus);

      this.#logger.info("PDFViewer initialized");
    } catch (error) {
      this.#logger.error("Failed to initialize PDFViewer:", error);
      logger.error("[PDFViewerManager] Full error:", error.message, error.stack);
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

    this.#logger.debug("Before setDocument, checking viewer state...");
    this.#logger.debug(`PDFViewer instance exists: ${!!this.#pdfViewer}`);
    this.#logger.debug(`pdfDocument: ${pdfDocument}, numPages: ${pdfDocument?.numPages}`);
    this.#logger.debug(`Container element: ${this.#container?.tagName}.${this.#container?.className}`);
    this.#logger.debug(`Container innerHTML length: ${this.#container?.innerHTML?.length || 0}`);

    try {
      this.#logger.debug("Calling pdfViewer.setDocument...");
      this.#pdfViewer.setDocument(pdfDocument);
      this.#logger.debug("setDocument returned successfully");

      this.#logger.debug("Calling linkService.setDocument...");
      this.#linkService.setDocument(pdfDocument);
      this.#logger.debug("linkService.setDocument returned successfully");

      this.#logger.debug("Immediately after setDocument:");
      this.#logger.debug(`  pdfViewer.pdfDocument: ${!!this.#pdfViewer.pdfDocument}`);
      this.#logger.debug(`  pdfViewer.pagesCount: ${this.#pdfViewer.pagesCount}`);

      // 强制刷新PDFViewer以确保textLayer和canvas尺寸一致
      // 这会触发PDFViewer重新计算所有页面的viewport和布局
      this.#logger.debug("Forcing PDFViewer update to sync layer dimensions...");
      this.#pdfViewer.update();
      this.#logger.debug(`PDFViewer updated, currentScale: ${this.#pdfViewer.currentScale}`);
    } catch (error) {
      this.#logger.error("Error during setDocument:", error);
    }

    this.#logger.info("PDF document loaded");

    // 等待一下，然后检查是否有页面被渲染
    setTimeout(() => {
      this.#logger.debug("After setDocument (2s delay), checking viewer content...");
      const viewerElement = this.#container.querySelector('.pdfViewer') || this.#container.querySelector('#viewer');
      this.#logger.debug(`Viewer element innerHTML length: ${viewerElement?.innerHTML?.length || 0}`);
      this.#logger.debug(`Viewer element children count: ${viewerElement?.children?.length || 0}`);

      // 🔍 详细分析子元素类型
      if (viewerElement && viewerElement.children.length > 0) {
        const childrenTypes = {};
        for (let i = 0; i < viewerElement.children.length; i++) {
          const child = viewerElement.children[i];
          const type = `${child.tagName}.${child.className}`;
          childrenTypes[type] = (childrenTypes[type] || 0) + 1;
        }
        this.#logger.debug(`Children types breakdown: ${JSON.stringify(childrenTypes, null, 2)}`);
        this.#logger.debug(`First child: ${viewerElement.children[0].tagName}.${viewerElement.children[0].className}`);

        // 统计真正的页面容器
        const pageContainers = viewerElement.querySelectorAll('.page');
        this.#logger.debug(`Actual page containers (.page): ${pageContainers.length}`);

        // 检查是否有重复的页面
        this.#logger.debug(`Expected pages from pdfDocument: ${this.#pdfViewer.pdfDocument?.numPages || 'unknown'}`);
      }

      this.#logger.debug(`PDFViewer.pagesCount: ${this.#pdfViewer.pagesCount}`);
      this.#logger.debug(`PDFViewer.currentPageNumber: ${this.#pdfViewer.currentPageNumber}`);
      this.#logger.debug(`PDFViewer.currentScale: ${this.#pdfViewer.currentScale}`);
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
   * 获取指定页面的PageView对象
   * @param {number} pageNumber - 页码（从1开始）
   * @returns {Object|null} PageView对象，包含viewport、div、canvas等信息
   */
  getPageView(pageNumber) {
    if (!this.#pdfViewer || pageNumber < 1 || pageNumber > this.pagesCount) {
      return null;
    }
    // PDF.js的_pages数组索引从0开始，所以需要-1
    return this.#pdfViewer._pages?.[pageNumber - 1] || null;
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


