/**
 * @file DOM元素管理器
 * @module DOMElementManager
 * @description 管理PDF查看器的所有DOM元素引用和操作
 */

import { DOMUtils } from "../../common/utils/dom-utils.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * DOM元素管理器类
 * 负责初始化、管理和清理所有DOM元素
 */
export class DOMElementManager {
  #logger;
  #elements = {};

  constructor() {
    this.#logger = getLogger("UIManager.DOM");
  }

  /**
   * 初始化所有DOM元素引用
   * @returns {Object} 元素集合
   */
  initializeElements() {
    this.#logger.info("Initializing DOM elements...");

    // 查找主容器
    this.#elements.container = DOMUtils.getElementById("pdf-container");
    this.#elements.viewerContainer = DOMUtils.getElementById("viewer-container");

    // [已废弃] 查找画布元素 - Canvas模式已移除
    this.#elements.canvas = DOMUtils.getElementById("pdf-canvas");
    this.#elements.textLayer = DOMUtils.getElementById("text-layer");
    this.#elements.annotationLayer = DOMUtils.getElementById("annotation-layer");

    // 查找控制按钮
    this.#elements.prevPageBtn = DOMUtils.getElementById("prev-page");
    this.#elements.nextPageBtn = DOMUtils.getElementById("next-page");
    this.#elements.zoomInBtn = DOMUtils.getElementById("zoom-in");
    this.#elements.zoomOutBtn = DOMUtils.getElementById("zoom-out");
    this.#elements.fitWidthBtn = DOMUtils.getElementById("fit-width");
    this.#elements.fitHeightBtn = DOMUtils.getElementById("fit-height");
    this.#elements.actualSizeBtn = DOMUtils.getElementById("actual-size");

    // 查找输入元素
    this.#elements.pageInput = DOMUtils.getElementById("page-num");
    this.#elements.pageDisplay = DOMUtils.getElementById("page-display");
    this.#elements.zoomSelect = DOMUtils.getElementById("zoom-select");
    this.#elements.zoomDisplay = DOMUtils.getElementById("zoom-display");

    // 查找进度和错误元素
    this.#elements.loadingIndicator = DOMUtils.getElementById("loading-indicator");
    this.#elements.progressBar = DOMUtils.getElementById("progress-bar");
    this.#elements.errorMessage = DOMUtils.getElementById("error-message");

    // 验证必要元素
    this.#validateElements();

    // 创建缺失的必要元素
    this.#createMissingElements();

    this.#logger.info("DOM elements initialized");
    return this.#elements;
  }

  /**
   * 验证必要的DOM元素是否存在
   * @private
   */
  #validateElements() {
    if (!this.#elements.container) {
      this.#logger.warn("Container element not found, will create one");
    }

    // [已废弃] 检查canvas - Canvas模式已移除，但保留以防旧代码调用
    const existingCanvas = document.querySelector("canvas#pdf-canvas, canvas.pdf-canvas");
    if (existingCanvas instanceof HTMLCanvasElement) {
      this.#elements.canvas = existingCanvas;
      this.#logger.info("Reusing existing canvas element (deprecated)");
    }

    if (!this.#elements.canvas) {
      this.#logger.warn("Canvas element not found, will create one (deprecated)");
    }
  }

  /**
   * 创建缺失的必要元素
   * @private
   */
  #createMissingElements() {
    // [已废弃] 创建旧版容器但立即隐藏 - 现在使用HTML中的viewerContainer
    if (!this.#elements.container) {
      this.#elements.container = document.createElement("div");
      this.#elements.container.id = "pdf-container";
      this.#elements.container.className = "pdf-container";
      this.#elements.container.style.display = "none"; // 隐藏旧版容器，避免遮挡页面
      document.body.appendChild(this.#elements.container);
      this.#logger.info("Created legacy PDF container (hidden)");
    }

    // [已废弃] 创建画布 - Canvas模式已移除，但保留以防旧代码调用
    if (!this.#elements.canvas) {
      this.#elements.canvas = document.createElement("canvas");
      this.#elements.canvas.id = "pdf-canvas";
      this.#elements.canvas.className = "pdf-canvas";
      this.#elements.canvas.style.display = "none"; // 隐藏Canvas元素
      this.#elements.container.appendChild(this.#elements.canvas);
      this.#logger.info("Created PDF canvas (deprecated, hidden)");
    }

    // [已废弃] 创建旧版文本层但立即隐藏 - 现在使用PDFViewer自动生成的textLayer
    if (!this.#elements.textLayer) {
      this.#elements.textLayer = document.createElement("div");
      this.#elements.textLayer.id = "text-layer";
      this.#elements.textLayer.className = "text-layer";
      this.#elements.textLayer.style.display = "none"; // 隐藏旧版文本层，避免干扰PDFViewer
      this.#elements.container.appendChild(this.#elements.textLayer);
      this.#logger.info("Created legacy text layer (hidden)");
    }

    // [已废弃] 创建旧版注释层但立即隐藏 - 现在使用PDFViewer自动生成的annotationLayer
    if (!this.#elements.annotationLayer) {
      this.#elements.annotationLayer = document.createElement("div");
      this.#elements.annotationLayer.id = "annotation-layer";
      this.#elements.annotationLayer.className = "annotation-layer";
      this.#elements.annotationLayer.style.display = "none"; // 隐藏旧版注释层，避免干扰PDFViewer
      this.#elements.container.appendChild(this.#elements.annotationLayer);
      this.#logger.info("Created legacy annotation layer (hidden)");
    }
  }

  /**
   * 获取所有元素引用
   * @returns {Object} 元素集合
   */
  getElements() {
    return this.#elements;
  }

  /**
   * 获取特定元素
   * @param {string} elementName - 元素名称
   * @returns {HTMLElement|null} DOM元素
   */
  getElement(elementName) {
    return this.#elements[elementName] || null;
  }

  /**
   * 获取容器尺寸
   * @returns {Object} 包含width和height的对象
   */
  getContainerDimensions() {
    if (!this.#elements.container) {
      return { width: 0, height: 0 };
    }

    return {
      width: this.#elements.container.clientWidth,
      height: this.#elements.container.clientHeight
    };
  }

  /**
   * 显示/隐藏加载指示器
   * @param {boolean} isLoading - 是否显示加载
   */
  setLoadingState(isLoading) {
    if (this.#elements.container) {
      if (isLoading) {
        this.#elements.container.classList.add("loading");
      } else {
        this.#elements.container.classList.remove("loading");
      }
    }

    if (this.#elements.loadingIndicator) {
      this.#elements.loadingIndicator.style.display = isLoading ? "block" : "none";
    }
  }

  /**
   * 清理DOM元素
   */
  cleanup() {
    // [已废弃] 清理canvas - Canvas模式已移除，但保留以防旧代码调用
    if (this.#elements.canvas) {
      const context = this.#elements.canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, this.#elements.canvas.width, this.#elements.canvas.height);
      }
    }

    // 清理文本层
    if (this.#elements.textLayer) {
      this.#elements.textLayer.innerHTML = "";
    }

    // 清理注释层
    if (this.#elements.annotationLayer) {
      this.#elements.annotationLayer.innerHTML = "";
    }

    this.#logger.debug("DOM elements cleaned");
  }

  /**
   * 销毁管理器
   */
  destroy() {
    // 移除动态创建的元素
    const dynamicElements = ["loadingIndicator", "progressBar", "errorMessage"];
    dynamicElements.forEach(name => {
      if (this.#elements[name] && this.#elements[name].parentNode) {
        this.#elements[name].parentNode.removeChild(this.#elements[name]);
      }
    });

    // 清空引用
    this.#elements = {};
    this.#logger.info("DOM element manager destroyed");
  }
}