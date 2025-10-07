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

    // 查找主容器（新版仅依赖 viewerContainer）
    this.#elements.container = DOMUtils.getElementById("pdf-container");
    this.#elements.viewerContainer = DOMUtils.getElementById("viewer-container");

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

    // 验证必要元素（新版不再创建任何 legacy 元素）
    this.#validateElements();

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

    // 新版：不再支持 legacy canvas/text/annotationLayer 的自动创建
  }

  /**
   * 新版不创建任何 legacy 元素
   * @private
   */
  #createMissingElements() {}

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
    // 新版：不再管理 legacy canvas/text/annotationLayer 的清理

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
