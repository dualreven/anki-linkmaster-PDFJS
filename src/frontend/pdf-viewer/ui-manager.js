/**
 * @file UI管理器，负责PDF页面的渲染和用户界面控制
 * @module UIManager
 * @description 基于Canvas的PDF页面渲染和UI控制模块
 */

import { DOMUtils } from "../common/utils/dom-utils.js";
import Logger from "../common/utils/logger.js";
import PDF_VIEWER_EVENTS from "../common/event/pdf-viewer-constants.js";

/**
 * @class UIManager
 * @description UI管理器，处理页面渲染、缩放控制和用户交互
 */
export class UIManager {
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
    this.#logger = new Logger("UIManager");
  }

  /**
   * 初始化UI管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.info("Initializing UI Manager...");
      
      this.#initializeElements();
      this.#setupEventListeners();
      this.#setupResizeObserver();
      this.#setupZoomControls();
      this.#setupProgressAndErrorUI();
      
      this.#logger.info("UI Manager initialized successfully");
    } catch (error) {
      this.#logger.error("Failed to initialize UI Manager:", error);
      throw error;
    }
  }

  /**
   * 初始化DOM元素
   * @private
   */
  #initializeElements() {
    this.#container = DOMUtils.getElementById("pdf-viewer-container");
    if (!this.#container) {
      throw new Error("PDF viewer container not found");
    }

    // 创建Canvas元素
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
    this.#ctx = this.#canvas.getContext("2d");
    
    this.#logger.debug("Canvas element created and initialized");
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
   * 设置进度和错误UI
   * @private
   */
  #setupProgressAndErrorUI() {
    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.className = 'pdf-progress-container';
    progressContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      text-align: center;
      z-index: 1000;
      display: none;
    `;
    
    // 创建进度条
    this.#progressBar = document.createElement('div');
    this.#progressBar.className = 'pdf-progress-bar';
    this.#progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin: 10px 0;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'pdf-progress-fill';
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: #007bff;
      border-radius: 4px;
      transition: width 0.3s ease;
    `;
    this.#progressBar.appendChild(progressFill);
    
    // 创建进度文本
    this.#progressText = document.createElement('div');
    this.#progressText.className = 'pdf-progress-text';
    this.#progressText.style.cssText = `
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    `;
    this.#progressText.textContent = '加载中... 0%';
    
    progressContainer.appendChild(this.#progressText);
    progressContainer.appendChild(this.#progressBar);
    
    // 创建错误容器
    this.#errorContainer = document.createElement('div');
    this.#errorContainer.className = 'pdf-error-container';
    this.#errorContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      background: rgba(255, 255, 255, 0.95);
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      text-align: center;
      z-index: 1001;
      display: none;
    `;
    
    this.#container.appendChild(progressContainer);
    this.#container.appendChild(this.#errorContainer);
    
    this.#logger.debug("Progress and error UI setup completed");
  }

  /**
   * 设置缩放控制UI
   * @private
   */
  #setupZoomControls() {
    try {
      this.#logger.debug("Setting up zoom controls...");
      
      // 获取缩放控制元素
      this.#zoomInBtn = document.getElementById("zoom-in");
      this.#zoomOutBtn = document.getElementById("zoom-out");
      this.#zoomLevelDisplay = document.getElementById("zoom-level");
      this.#pageInfoDisplay = document.getElementById("page-info");
      this.#prevPageBtn = document.getElementById("prev-page");
      this.#nextPageBtn = document.getElementById("next-page");
      
      if (!this.#zoomInBtn || !this.#zoomOutBtn || !this.#zoomLevelDisplay || 
          !this.#pageInfoDisplay || !this.#prevPageBtn || !this.#nextPageBtn) {
        throw new Error("Zoom control elements not found");
      }
      
      // 设置缩放按钮事件
      this.#zoomInBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, undefined, { 
          actorId: 'UIManager' 
        });
      });
      
      this.#zoomOutBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, undefined, { 
          actorId: 'UIManager' 
        });
      });
      
      // 设置页面导航按钮事件
      this.#prevPageBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, undefined, { 
          actorId: 'UIManager' 
        });
      });
      
      this.#nextPageBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, undefined, { 
          actorId: 'UIManager' 
        });
      });
      
      // 初始更新显示
      this.#updateZoomDisplay();
      this.#updatePageInfo(1, 1);
      
      this.#logger.debug("Zoom controls setup completed");
      
    } catch (error) {
      this.#logger.error("Failed to setup zoom controls:", error);
      throw error;
    }
  }
  
  /**
   * 更新缩放比例显示
   * @private
   */
  #updateZoomDisplay() {
    if (this.#zoomLevelDisplay) {
      const zoomPercent = Math.round(this.#currentScale * 100);
      this.#zoomLevelDisplay.textContent = `${zoomPercent}%`;
      
      // 更新按钮状态
      if (this.#zoomInBtn) {
        this.#zoomInBtn.disabled = this.#currentScale >= 3.0;
      }
      if (this.#zoomOutBtn) {
        this.#zoomOutBtn.disabled = this.#currentScale <= 0.5;
      }
    }
  }
  
  /**
   * 更新加载进度
   * @param {number} percent - 进度百分比
   * @param {string} [statusText] - 状态文本
   */
  updateProgress(percent, statusText = '加载中...') {
    if (this.#progressBar && this.#progressText) {
      const progressFill = this.#progressBar.querySelector('.pdf-progress-fill');
      if (progressFill) {
        progressFill.style.width = `${percent}%`;
      }
      this.#progressText.textContent = `${statusText} ${percent}%`;
      
      // 显示进度条
      const progressContainer = this.#progressBar.parentElement;
      if (progressContainer) {
        progressContainer.style.display = 'block';
      }
    }
  }

  /**
   * 隐藏进度条
   */
  hideProgress() {
    const progressContainer = this.#container.querySelector('.pdf-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }

  /**
   * 显示错误信息
   * @param {Object} errorData - 错误数据
   */
  showError(errorData) {
    this.#logger.error("UI Error:", errorData);
    
    // 隐藏进度条
    this.hideProgress();
    
    // 清空容器并显示错误信息
    this.#errorContainer.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="color: #dc3545; margin: 0 0 8px 0; font-size: 18px;">加载失败</h3>
        <p style="color: #6c757d; margin: 0 0 16px 0; font-size: 14px; line-height: 1.4;">
          ${errorData.userMessage || errorData.error}
        </p>
        ${errorData.retryable ? `
          <button id="pdf-retry-btn" style="
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 8px;
          ">重试</button>
        ` : ''}
        <button id="pdf-close-btn" style="
          background: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">关闭</button>
      </div>
    `;
    
    this.#errorContainer.style.display = 'block';
    
    // 设置重试按钮事件
    const retryBtn = document.getElementById('pdf-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.LOAD.RETRY, errorData.file, {
          actorId: 'UIManager'
        });
        this.hideError();
      };
    }
    
    // 设置关闭按钮事件
    const closeBtn = document.getElementById('pdf-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.hideError();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.CLOSE, undefined, {
          actorId: 'UIManager'
        });
      };
    }
  }

  /**
   * 隐藏错误信息
   */
  hideError() {
    this.#errorContainer.style.display = 'none';
    this.#errorContainer.innerHTML = '';
  }

  /**
   * 更新页面信息显示
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   * @private
   */
  #updatePageInfo(currentPage, totalPages) {
    if (this.#pageInfoDisplay) {
      this.#pageInfoDisplay.textContent = `${currentPage} / ${totalPages}`;
      
      // 更新导航按钮状态
      if (this.#prevPageBtn) {
        this.#prevPageBtn.disabled = currentPage <= 1;
      }
      if (this.#nextPageBtn) {
        this.#nextPageBtn.disabled = currentPage >= totalPages;
      }
    }
  }
  
  /**
   * 应用缩放动画效果
   * @private
   */
  #applyZoomAnimation() {
    if (this.#canvas) {
      this.#canvas.classList.add('zoom-animation');
      setTimeout(() => {
        this.#canvas.classList.remove('zoom-animation');
      }, 300);
    }
  }
  
  /**
   * 应用页面切换动画效果
   * @private
   */
  #applyPageTransitionAnimation() {
    if (this.#canvas) {
      this.#canvas.classList.add('page-transition');
      setTimeout(() => {
        this.#canvas.classList.remove('page-transition');
      }, 200);
    }
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
   * 渲染PDF页面
   * @param {Object} page - PDF页面对象
   * @param {Object} viewport - 视图端口配置
   * @returns {Promise<void>}
   */
  async renderPage(page, viewport) {
    try {
      this.#logger.debug(`Rendering page with viewport: ${viewport.width}x${viewport.height}`);
      
      // 设置Canvas大小
      this.#resizeCanvas(viewport.width, viewport.height);
      
      // 创建渲染任务
      const renderTask = page.render({
        canvasContext: this.#ctx,
        viewport: viewport
      });
      
      // 等待渲染完成
      await renderTask.promise;
      
      this.#logger.debug("Page rendered successfully");
      
    } catch (error) {
      this.#logger.error("Failed to render page:", error);
      throw error;
    }
  }

  /**
   * 调整Canvas大小
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @private
   */
  #resizeCanvas(width, height) {
    // 考虑设备像素比
    const dpr = window.devicePixelRatio || 1;
    
    // 设置Canvas显示大小
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    
    // 设置Canvas实际大小（考虑DPI）
    this.#canvas.width = Math.floor(width * dpr);
    this.#canvas.height = Math.floor(height * dpr);
    
    // 缩放上下文以匹配DPI
    this.#ctx.scale(dpr, dpr);
    
    this.#logger.debug(`Canvas resized to ${width}x${height} (dpr: ${dpr})`);
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
    }, { actorId: 'UIManager' });
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
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, undefined, { 
          actorId: 'UIManager' 
        });
        break;
        
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, undefined, { 
          actorId: 'UIManager' 
        });
        break;
        
      case '+':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, undefined, { 
            actorId: 'UIManager' 
          });
        }
        break;
        
      case '-':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, undefined, { 
            actorId: 'UIManager' 
          });
        }
        break;
        
      case '0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, undefined, { 
            actorId: 'UIManager' 
          });
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.#eventBus.emit(PDF_VIEWER_EVENTS.FILE.CLOSE, undefined, { 
          actorId: 'UIManager' 
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
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, undefined, { 
          actorId: 'UIManager' 
        });
      } else {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, undefined, { 
          actorId: 'UIManager' 
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
   * 显示错误信息
   * @param {string} message - 错误消息
   */
  showError(message) {
    this.#logger.error("UI Error:", message);
    
    if (this.#container) {
      // 清空容器并显示错误信息
      this.#container.innerHTML = `
        <div class="pdf-error">
          <h3>加载失败</h3>
          <p>${message}</p>
          <button onclick="window.location.reload()">重新加载</button>
        </div>
      `;
      
      // 添加错误样式
      DOMUtils.addClass(this.#container, 'error');
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
    this.#logger.info("Destroying UI Manager");
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
   * 设置缩放级别
   * @param {number} scale - 缩放比例
   */
  setScale(scale) {
    this.#currentScale = Math.max(0.5, Math.min(3.0, scale)); // 限制缩放范围
    this.#updateZoomDisplay();
    this.#applyZoomAnimation();
    this.#logger.debug(`Scale set to: ${this.#currentScale}`);
  }

  /**
   * 更新页面信息
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   */
  updatePageInfo(currentPage, totalPages) {
    this.#updatePageInfo(currentPage, totalPages);
    this.#applyPageTransitionAnimation();
  }

  /**
   * 获取当前缩放级别
   * @returns {number} 当前缩放比例
   */
  getScale() {
    return this.#currentScale;
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