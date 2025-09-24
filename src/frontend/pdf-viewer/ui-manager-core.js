/**
 * @file UI管理器核心模块
 * @module UIManagerCore
 * @description UI管理器的核心功能，包括初始化、事件处理和基础UI控制
 */

import { DOMUtils } from "../common/utils/dom-utils.js";
import Logger from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf_viewer-constants.js";

/**
 * @class UIManagerCore
 * @description UI管理器核心类，处理基础UI功能和事件协调
 */
export class UIManagerCore {
  #eventBus;
  #logger;
  #canvas = null;
  #ctx = null;
  #container = null;
  #currentScale = 1.0;
  #renderQueue = [];
  #isRendering = false;
  #zoomInBtn = null;
  #zoomOutBtn = null;
  #zoomLevelDisplay = null;
  #pageInfoDisplay = null;
  #prevPageBtn = null;
  #nextPageBtn = null;
  #progressBar = null;
  #progressText = null;
  #errorContainer = null;
  #retryButton = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = new Logger("UIManagerCore");
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
   * 初始化DOM元素
   * @private
   */
  #initializeElements() {
    this.#container = DOMUtils.getElementById("pdf-container");
    if (!this.#container) {
      throw new Error("PDF viewer container not found");
    }

    // 创建或复用Canvas元素（避免重复创建同 id 的 canvas）
    const existingCanvas = this.#container.querySelector('#pdf-canvas');
    if (existingCanvas instanceof HTMLCanvasElement) {
      // 复用已有 canvas（来自静态 HTML 或其他初始化）
      this.#canvas = existingCanvas;
      this.#canvas.classList.add('pdf-canvas');
      this.#logger.debug("Reusing existing canvas element");
    } else {
      // 创建新的 Canvas
      this.#canvas = document.createElement("canvas");
      this.#canvas.id = "pdf-canvas";
      this.#canvas.className = "pdf-canvas";
      this.#canvas.style.display = "block";
      
      // 设置Canvas样式
      Object.assign(this.#canvas.style, {
        margin: "0 auto",
        display: "block",
        background: "#f0f0f0",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      });

      this.#container.appendChild(this.#canvas);
      this.#logger.debug("Canvas element created and appended");
    }

    // 获取渲染上下文
    this.#ctx = this.#canvas.getContext("2d");
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
    this.#canvas.addEventListener("wheel", (event) => this.#handleWheel(event), {
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
          if (entry.target === this.#container) {
            this.#handleResize();
          }
        }
      });
      
      observer.observe(this.#container);
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
      width: this.#container.clientWidth,
      height: this.#container.clientHeight
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
    return this.#container ? this.#container.clientWidth : 0;
  }

  /**
   * 获取容器高度
   * @returns {number} 容器高度
   */
  getContainerHeight() {
    return this.#container ? this.#container.clientHeight : 0;
  }

  /**
   * 显示加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  showLoading(isLoading) {
    if (this.#container) {
      if (isLoading) {
        DOMUtils.addClass(this.#container, 'loading');
      } else {
        DOMUtils.removeClass(this.#container, 'loading');
      }
    }
  }

  /**
   * 清理UI资源
   */
  cleanup() {
    this.#logger.info("Cleaning up UI resources");
    
    // 清理Canvas
    if (this.#canvas) {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
      if (this.#canvas.parentNode) {
        this.#canvas.parentNode.removeChild(this.#canvas);
      }
    }
    
    this.#canvas = null;
    this.#ctx = null;
    
    // 重置容器
    if (this.#container) {
      this.#container.innerHTML = '';
      DOMUtils.removeClass(this.#container, 'loading');
      DOMUtils.removeClass(this.#container, 'error');
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
    
    if (this.#canvas) {
      this.#canvas.removeEventListener("wheel", this.#handleWheel);
    }
    
    // 移除缩放控制事件监听器
    if (this.#zoomInBtn) {
      this.#zoomInBtn.removeEventListener("click", () => {});
    }
    if (this.#zoomOutBtn) {
      this.#zoomOutBtn.removeEventListener("click", () => {});
    }
    if (this.#prevPageBtn) {
      this.#prevPageBtn.removeEventListener("click", () => {});
    }
    if (this.#nextPageBtn) {
      this.#nextPageBtn.removeEventListener("click", () => {});
    }
  }

  /**
   * 获取容器元素
   * @returns {HTMLElement|null} 容器元素
   */
  getContainer() {
    return this.#container;
  }

  /**
   * 获取Canvas元素
   * @returns {HTMLCanvasElement|null} Canvas元素
   */
  getCanvas() {
    return this.#canvas;
  }

  /**
   * 获取Canvas上下文
   * @returns {CanvasRenderingContext2D|null} Canvas上下文
   */
  getContext() {
    return this.#ctx;
  }
}