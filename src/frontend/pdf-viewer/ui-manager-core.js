/**
 * @file UI管理器核心模块
 * @module UIManagerCore
 * @description UI管理器的核心功能，包括初始化、事件处理和基础UI控制
 */

import { DOMUtils } from "../common/utils/dom-utils.js";
import { getLogger } from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";

/**
 * @class UIManagerCore
 * @description UI管理器核心类，处理基础UI功能和事件协调
 */
export class UIManagerCore {
  #eventBus;
  #logger;
  #elements;
  #state;
  #unsubscribeFunctions = [];
  // DOM/state are centrally kept in #elements and #state

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UIManagerCore");

    // 初始化状态
    this.#state = {
      currentScale: 1.0,
      renderQueue: [],
      isRendering: false
    };
  }

  /**
   * 初始化UI管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing UI Manager Core...");

      this.#initializeElements();
      this.#setupEventListeners();
      this.#setupResizeObserver();

      this.#logger.info("UI Manager Core initialized successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize UI Manager Core:", error);
      throw error;
    }
  }

  /**
   * 销毁UI管理器，清理资源
   */
  destroy() {
    this.#logger.info("Destroying UIManagerCore and unsubscribing from events.");
    this.#unsubscribeFunctions.forEach((unsub) => unsub());
    this.#unsubscribeFunctions = [];
  }

  /**
   * 初始化DOM元素
   * @private
   */
  #initializeElements() {
    this.#elements = {
      container: DOMUtils.getElementById("pdf-container"),
      canvas: null,
      zoomInBtn: DOMUtils.getElementById("zoom-in"),
      zoomOutBtn: DOMUtils.getElementById("zoom-out"),
      zoomLevelDisplay: DOMUtils.getElementById("zoom-level"),
      pageInfoDisplay: DOMUtils.getElementById("page-info"),
      prevPageBtn: DOMUtils.getElementById("prev-page"),
      nextPageBtn: DOMUtils.getElementById("next-page"),
      progressBar: DOMUtils.getElementById("progress-bar"),
      progressText: DOMUtils.getElementById("progress-text"),
      errorContainer: DOMUtils.getElementById("error-container"),
      retryButton: DOMUtils.getElementById("retry-button")
    };

    if (!this.#elements.container) {
      throw new Error("PDF viewer container not found");
    }

    // No direct private field mirrors to avoid Babel private name errors

    // 创建或复用Canvas元素（避免重复创建同 id 的 canvas）
    const existingCanvas = this.#elements.container.querySelector('#pdf-canvas');
    if (existingCanvas instanceof HTMLCanvasElement) {
      // 复用已有 canvas（来自静态 HTML 或其他初始化）
      this.#elements.canvas = existingCanvas;
      this.#elements.canvas.classList.add('pdf-canvas');
      this.#logger.debug("Reusing existing canvas element");
    } else {
      // 创建新的 Canvas
      this.#elements.canvas = document.createElement("canvas");
      this.#elements.canvas.id = "pdf-canvas";
      this.#elements.canvas.className = "pdf-canvas";
      this.#elements.canvas.style.display = "block";

      // 设置Canvas样式
      Object.assign(this.#elements.canvas.style, {
        margin: "0 auto",
        display: "block",
        background: "#f0f0f0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      });

      this.#elements.container.appendChild(this.#elements.canvas);
      this.#logger.debug("Canvas element created and appended");
    }

    // 获取渲染上下文
    this.#state.ctx = this.#elements.canvas.getContext("2d");
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 窗口大小改变事件
    window.addEventListener("resize", () => this.#handleResize());
    
    // 键盘导航事件
    document.addEventListener("keydown", (event) => this.#handleKeyDown(event));
    
    // 鼠标滚轮缩放
    this.#elements.canvas.addEventListener("wheel", (event) => this.#handleWheel(event), {
      passive: false
    });
  }

  /**
   * 设置ResizeObserver监听容器大小变化
   * @private
   */
  #setupResizeObserver() {
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === this.#elements.container) {
            this.#handleResize();
          }
        }
      });
      
      observer.observe(this.#elements.container);
      this.#logger.debug("ResizeObserver setup completed");
    }
  }

  /**
   * 处理窗口大小改变
   * @private
   */
  #handleResize() {
    this.#logger.debug("Container resized");
    // 这里可以触发重新渲染或缩放调整
    this.#eventBus.emit(PDF_VIEWER_EVENTS.UI.RESIZED, {
      width: this.#elements.container.clientWidth,
      height: this.#elements.container.clientHeight
    }, { actorId: 'UIManagerCore' });
  }

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event - 键盘事件
   * @private
   */
  #handleKeyDown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return; // 忽略输入框中的按键
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, null, { 
          actorId: 'UIManagerCore' 
        });
        break;
        
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, null, { 
          actorId: 'UIManagerCore' 
        });
        break;
        
      case '+':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, null, { 
            actorId: 'UIManagerCore' 
          });
        }
        break;
        
      case '-':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, null, { 
            actorId: 'UIManagerCore' 
          });
        }
        break;
        
      case '0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, null, { 
            actorId: 'UIManagerCore' 
          });
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.CLOSE, null, { 
          actorId: 'UIManagerCore' 
        });
        break;
    }
  }

  /**
   * 处理鼠标滚轮事件
   * @param {WheelEvent} event - 滚轮事件
   * @private
   */
  #handleWheel(event) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      
      if (event.deltaY < 0) {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, null, { 
          actorId: 'UIManagerCore' 
        });
      } else {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, null, { 
          actorId: 'UIManagerCore' 
        });
      }
    }
  }

  /**
   * 获取容器宽度
   * @returns {number} 容器宽度
   */
  getContainerWidth() {
    return this.#elements.container ? this.#elements.container.clientWidth : 0;
  }

  /**
   * 获取容器高度
   * @returns {number} 容器高度
   */
  getContainerHeight() {
    return this.#elements.container ? this.#elements.container.clientHeight : 0;
  }

  /**
   * 显示加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  showLoading(isLoading) {
    if (this.#elements.container) {
      if (isLoading) {
        DOMUtils.addClass(this.#elements.container, 'loading');
      } else {
        DOMUtils.removeClass(this.#elements.container, 'loading');
      }
    }
  }

  /**
   * 清理UI资源
   */
  cleanup() {
    this.#logger.info("Cleaning up UI resources");
    
    // 清理Canvas
    if (this.#elements.canvas) {
      this.#elements.canvas.width = 0;
      this.#elements.canvas.height = 0;
      if (this.#elements.canvas.parentNode) {
        this.#elements.canvas.parentNode.removeChild(this.#elements.canvas);
      }
    }
    
    this.#elements.canvas = null;
    this.#state.ctx = null;
    
    // 重置容器
    if (this.#elements.container) {
      this.#elements.container.innerHTML = '';
      DOMUtils.removeClass(this.#elements.container, 'loading');
      DOMUtils.removeClass(this.#elements.container, 'error');
    }
  }

  /**
   * 销毁UI管理器
   */
  destroy() {
    this.#logger.info("Destroying UI Manager Core");
    this.cleanup();
    
    // 移除事件监听器
    window.removeEventListener("resize", this.#handleResize);
    document.removeEventListener("keydown", this.#handleKeyDown);
    
    if (this.#elements.canvas) {
      this.#elements.canvas.removeEventListener("wheel", this.#handleWheel);
    }
    
    // 移除缩放控制事件监听器
    if (this.#elements.zoomInBtn) {
      this.#elements.zoomInBtn.removeEventListener("click", () => {});
    }
    if (this.#elements.zoomOutBtn) {
      this.#elements.zoomOutBtn.removeEventListener("click", () => {});
    }
    if (this.#elements.prevPageBtn) {
      this.#elements.prevPageBtn.removeEventListener("click", () => {});
    }
    if (this.#elements.nextPageBtn) {
      this.#elements.nextPageBtn.removeEventListener("click", () => {});
    }
  }

  /**
   * 获取容器元素
   * @returns {HTMLElement|null} 容器元素
   */
  getContainer() {
    return this.#elements?.container || null;
  }

  /**
   * 获取Canvas元素
   * @returns {HTMLCanvasElement|null} Canvas元素
   */
  getCanvas() {
    return this.#elements?.canvas || null;
  }

  /**
   * 获取Canvas上下文
   * @returns {CanvasRenderingContext2D|null} Canvas上下文
   */
  getContext() {
    return this.#state?.ctx || null;
  }
}
