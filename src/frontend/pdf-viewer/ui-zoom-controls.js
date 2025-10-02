/**
 * @file UI缩放控制模块
 * @module UIZoomControls
 * @description 处理PDF查看器的缩放控制功能
 */

import { getLogger } from "../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../common/event/pdf-viewer-constants.js";

/**
 * @class UIZoomControls
 * @description 缩放控制类，处理缩放UI和动画效果
 */
export class UIZoomControls {
  #eventBus;
  #logger;
  #zoomInBtn = null;
  #zoomOutBtn = null;
  #zoomLevelDisplay = null;
  #pageInfoDisplay = null;
  #prevPageBtn = null;
  #nextPageBtn = null;
  #currentScale = 1.0;
  #currentPage = 1;
  #totalPages = 1;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("PDFViewer");
  }

  /**
   * 设置缩放控制UI
   * @param {HTMLElement} container - 容器元素
   * @returns {Promise<void>}
   */
  async setupZoomControls(container) {
    try {
      this.#logger.debug("Setting up zoom controls...");
      
      // 获取缩放控制元素
      this.#zoomInBtn = document.getElementById("zoom-in");
      this.#zoomOutBtn = document.getElementById("zoom-out");
      this.#zoomLevelDisplay = document.getElementById("zoom-level");
      this.#pageInfoDisplay = document.getElementById("page-info"); // 可选，向后兼容
      this.#prevPageBtn = document.getElementById("prev-page");
      this.#nextPageBtn = document.getElementById("next-page");

      // 检查必需的元素（page-info是可选的，用于向后兼容）
      if (!this.#zoomInBtn || !this.#zoomOutBtn || !this.#zoomLevelDisplay ||
          !this.#prevPageBtn || !this.#nextPageBtn) {
        throw new Error("Zoom control elements not found");
      }
      
      // 设置缩放按钮事件
      this.#zoomInBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, null, { 
          actorId: 'UIZoomControls' 
        });
      });
      
      this.#zoomOutBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, null, { 
          actorId: 'UIZoomControls' 
        });
      });
      
      // 设置页面导航按钮事件
      this.#prevPageBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, null, { 
          actorId: 'UIZoomControls' 
        });
      });
      
      this.#nextPageBtn.addEventListener("click", () => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, null, {
          actorId: 'UIZoomControls'
        });
      });

      // 设置页码输入框事件
      const pageInput = document.getElementById('page-input');
      if (pageInput) {
        // 监听Enter键和失焦事件
        pageInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.#handlePageInputChange(pageInput);
          }
        });

        pageInput.addEventListener('blur', () => {
          this.#handlePageInputChange(pageInput);
        });

        // 监听input事件实现实时跳转（可选）
        pageInput.addEventListener('change', () => {
          this.#handlePageInputChange(pageInput);
        });
      }

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
   * 更新页面信息显示
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   * @private
   */
  #updatePageInfo(currentPage, totalPages) {
    // 更新内部状态
    this.#currentPage = currentPage;
    this.#totalPages = totalPages;

    // 更新页码输入框
    const pageInput = document.getElementById('page-input');
    if (pageInput) {
      pageInput.value = currentPage;
      pageInput.max = totalPages;
    }

    // 更新总页数显示
    const pageTotal = document.getElementById('page-total');
    if (pageTotal) {
      pageTotal.textContent = `/ ${totalPages}`;
    }

    // 保持对旧版page-info的兼容（如果存在）
    if (this.#pageInfoDisplay) {
      this.#pageInfoDisplay.textContent = `${currentPage} / ${totalPages}`;
    }

    // 更新导航按钮状态
    if (this.#prevPageBtn) {
      this.#prevPageBtn.disabled = currentPage <= 1;
    }
    if (this.#nextPageBtn) {
      this.#nextPageBtn.disabled = currentPage >= totalPages;
    }
  }

  /**
   * 处理页码输入变化
   * @param {HTMLInputElement} input - 页码输入框元素
   * @private
   */
  #handlePageInputChange(input) {
    const pageNumber = parseInt(input.value, 10);
    const max = parseInt(input.max, 10) || 1;

    // 验证页码有效性
    if (isNaN(pageNumber) || pageNumber < 1) {
      // 无效页码，恢复到当前页
      input.value = this.#currentPage;
      this.#logger.warn(`Invalid page number: ${input.value}`);
      return;
    }

    // 限制在有效范围内
    const validPage = Math.max(1, Math.min(pageNumber, max));
    if (validPage !== pageNumber) {
      input.value = validPage;
    }

    // 如果页码与当前页不同，触发导航事件
    if (validPage !== this.#currentPage) {
      this.#logger.info(`Page input changed to ${validPage}, navigating...`);
      this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.GOTO, {
        pageNumber: validPage
      }, {
        actorId: 'UIZoomControls.PageInput'
      });
    }
  }

  /**
   * 应用缩放动画效果
   * @param {HTMLCanvasElement} canvas - Canvas元素
   */
  applyZoomAnimation(canvas) {
    if (canvas) {
      canvas.classList.add('zoom-animation');
      setTimeout(() => {
        canvas.classList.remove('zoom-animation');
      }, 300);
    }
  }
  
  /**
   * 应用页面切换动画效果
   * @param {HTMLCanvasElement} canvas - Canvas元素
   */
  applyPageTransitionAnimation(canvas) {
    if (canvas) {
      canvas.classList.add('page-transition');
      setTimeout(() => {
        canvas.classList.remove('page-transition');
      }, 200);
    }
  }

  /**
   * 设置缩放级别
   * @param {number} scale - 缩放比例
   * @param {HTMLCanvasElement} canvas - Canvas元素（可选，用于动画）
   */
  setScale(scale, canvas = null) {
    this.#currentScale = Math.max(0.5, Math.min(3.0, scale)); // 限制缩放范围
    this.#updateZoomDisplay();
    if (canvas) {
      this.applyZoomAnimation(canvas);
    }
    this.#logger.info(`[UIZoomControls] setScale called: ${this.#currentScale} (from ${scale})`);
  }

  /**
   * 更新页面信息
   * @param {number} currentPage - 当前页码
   * @param {number} totalPages - 总页数
   * @param {HTMLCanvasElement} canvas - Canvas元素（可选，用于动画）
   */
  updatePageInfo(currentPage, totalPages, canvas = null) {
    this.#updatePageInfo(currentPage, totalPages);
    if (canvas) {
      this.applyPageTransitionAnimation(canvas);
    }
  }

  /**
   * 获取当前缩放级别
   * @returns {number} 当前缩放比例
   */
  getScale() {
    return this.#currentScale;
  }

  /**
   * 销毁缩放控制
   */
  destroy() {
    this.#logger.info("Destroying Zoom Controls");
    
    // 移除事件监听器
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
    
    this.#zoomInBtn = null;
    this.#zoomOutBtn = null;
    this.#zoomLevelDisplay = null;
    this.#pageInfoDisplay = null;
    this.#prevPageBtn = null;
    this.#nextPageBtn = null;
  }
}