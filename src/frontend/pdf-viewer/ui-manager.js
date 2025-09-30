/**
 * @file UI管理器主文件
 * @module UIManager
 * @description UI管理器主入口，协调各子模块功能
 */

import { UIManagerCore } from "./ui/ui-manager-core-refactored.js";
import { UIZoomControls } from "./ui-zoom-controls.js";
import { UIProgressError } from "./ui-progress-error.js";
import { UICanvasRender } from "./ui-canvas-render.js";
import { TextLayerManager } from "./ui/text-layer-manager.js";
import { getLogger } from "../common/utils/logger.js";

/**
 * @class UIManager
 * @description UI管理器主类，协调各子模块功能
 */
export class UIManager {
  #eventBus;
  #logger;
  #core;
  #zoomControls;
  #progressError;
  #canvasRender;
  #textLayerManager;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewer");

    // 初始化子模块
    this.#core = new UIManagerCore(eventBus);
    this.#zoomControls = new UIZoomControls(eventBus);
    this.#progressError = new UIProgressError(eventBus);
    this.#canvasRender = new UICanvasRender();
    this.#textLayerManager = null; // 稍后初始化
  }

  /**
   * 初始化UI管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing UI Manager...");

      // 初始化核心模块
      await this.#core.initialize();

      // 获取容器和Canvas引用
      const container = this.#core.getContainer();
      const canvas = this.#core.getCanvas();

      // 初始化其他模块
      await this.#zoomControls.setupZoomControls(container);
      this.#progressError.setupProgressAndErrorUI(container);
      this.#canvasRender.initialize(canvas);

      // 初始化文字层管理器
      const textLayerContainer = document.getElementById('text-layer');
      if (textLayerContainer) {
        this.#textLayerManager = new TextLayerManager({
          container: textLayerContainer
        });
        this.#logger.info("TextLayerManager initialized");
      } else {
        this.#logger.warn("text-layer element not found, text selection will be disabled");
      }

      this.#logger.info("UI Manager initialized successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize UI Manager:", error);
      throw error;
    }
  }

  /**
   * 渲染PDF页面
   * @param {Object} page - PDF页面对象
   * @param {Object} viewport - 视图端口配置
   * @returns {Promise<void>}
   */
  async renderPage(page, viewport) {
    this.#logger.debug(`[UIManager] renderPage called for page ${page.pageNumber || page._pageIndex + 1}`);

    // 渲染Canvas层
    await this.#canvasRender.renderPage(page, viewport);
    this.#logger.debug("[UIManager] Canvas rendered");

    // 设置text-layer尺寸与canvas一致
    const textLayerContainer = document.getElementById('text-layer');
    if (textLayerContainer) {
      textLayerContainer.style.width = `${viewport.width}px`;
      textLayerContainer.style.height = `${viewport.height}px`;
      // 设置PDF.js要求的--scale-factor CSS变量
      textLayerContainer.style.setProperty('--scale-factor', viewport.scale);
      this.#logger.debug(`[UIManager] text-layer size set to ${viewport.width}x${viewport.height}, scale=${viewport.scale}`);
    }

    // 渲染文字层
    if (this.#textLayerManager && this.#textLayerManager.isEnabled()) {
      try {
        if (textLayerContainer) {
          this.#logger.debug("[UIManager] Loading text layer...");
          await this.#textLayerManager.loadTextLayer(textLayerContainer, page, viewport);
          this.#logger.info("[UIManager] Text layer rendered successfully");

          // 调试：检查文字层DOM结构
          const textLayerChildren = textLayerContainer.children.length;
          const textLayerClass = textLayerContainer.className;
          this.#logger.debug(`[UIManager] Text layer info: class="${textLayerClass}", children=${textLayerChildren}`);
        }
      } catch (error) {
        this.#logger.error("[UIManager] Failed to render text layer:", error);
        // 不抛出错误，允许Canvas正常显示
      }
    } else {
      this.#logger.debug("[UIManager] TextLayerManager not enabled, skipping text layer");
    }

    this.#logger.debug("[UIManager] Page render complete");
  }

  /**
   * 更新加载进度
   * @param {number} percent - 进度百分比
   * @param {string} [statusText] - 状态文本
   */
  updateProgress(percent, statusText = '加载中...') {
    this.#progressError.updateProgress(percent, statusText);
  }

  /**
   * 隐藏进度条
   */
  hideProgress() {
    this.#progressError.hideProgress();
  }

  /**
   * 显示错误信息
   * @param {Object} errorData - 错误数据
   */
  showError(errorData) {
    this.#progressError.showError(errorData);
  }

  /**
   * 隐藏错误信息
   */
  hideError() {
    this.#progressError.hideError();
  }

  /**
   * 设置缩放级别
   * @param {number} scale - 缩放比例
   */
  setScale(scale) {
    const canvas = this.#core.getCanvas();
    this.#zoomControls.setScale(scale, canvas);
  }

  /**
   * 更新页面信息
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   */
  updatePageInfo(currentPage, totalPages) {
    const canvas = this.#core.getCanvas();
    this.#zoomControls.updatePageInfo(currentPage, totalPages, canvas);
  }

  /**
   * 获取当前缩放级别
   * @returns {number} 当前缩放比例
   */
  getScale() {
    return this.#zoomControls.getScale();
  }

  /**
   * 获取容器宽度
   * @returns {number} 容器宽度
   */
  getContainerWidth() {
    return this.#core.getContainerWidth();
  }

  /**
   * 获取容器高度
   * @returns {number} 容器高度
   */
  getContainerHeight() {
    return this.#core.getContainerHeight();
  }

  /**
   * 显示加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  showLoading(isLoading) {
    this.#core.showLoading(isLoading);
  }

  /**
   * 获取Canvas元素
   * @returns {HTMLCanvasElement|null} Canvas元素
   */
  getCanvas() {
    return this.#core.getCanvas();
  }

  /**
   * 获取Canvas上下文
   * @returns {CanvasRenderingContext2D|null} Canvas上下文
   */
  getContext() {
    return this.#core.getContext();
  }

  /**
   * 清理UI资源
   */
  cleanup() {
    this.#core.cleanup();
    this.#canvasRender.cleanup();
  }

  /**
   * 销毁UI管理器
   */
  destroy() {
    this.#logger.info("Destroying UI Manager");
    
    this.#core.destroy();
    this.#zoomControls.destroy();
    this.#progressError.destroy();
    this.#canvasRender.destroy();
    
    this.#core = null;
    this.#zoomControls = null;
    this.#progressError = null;
    this.#canvasRender = null;
  }
}