/**
 * @file UI缩放控制模块
 * @module UIZoomControls
 * @description 处理PDF查看器的缩放控制功能
 */

import { getLogger } from "../../../../common/utils/logger.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";

/**
 * @class UIZoomControls
 * @description 缩放控制类，处理缩放UI和动画效果
 */
export class UIZoomControls {
  #eventBus;
  #logger;
  #zoomManager; // New dependency
  #zoomInBtn = null;
  #zoomOutBtn = null;
  #zoomLevelDisplay = null;
  #pageInfoDisplay = null;
  #prevPageBtn = null;
  #nextPageBtn = null;
  #pageInput = null;
  // #currentScale = 1.0; // Removed: State moved to ZoomManager
  #currentPage = 1;
  #unsubscribeZoom = null; // Cleanup for subscription
  #onZoomInClick = null;
  #onZoomOutClick = null;
  #onPrevPageClick = null;
  #onNextPageClick = null;
  #onPageInputKeydown = null;
  #onPageInputBlur = null;
  #onPageInputChange = null;
  #pendingTimeouts = [];

  constructor(eventBus, zoomManager) {
    this.#eventBus = eventBus;
    this.#zoomManager = zoomManager;
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

      // 设置缩放按钮事件 - 命令统一走 EventBus
      this.#onZoomInClick = this.#onZoomInClick || (() => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.IN, null, { actorId: "UIZoomControls" });
      });
      this.#onZoomOutClick = this.#onZoomOutClick || (() => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.ZOOM.OUT, null, { actorId: "UIZoomControls" });
      });
      this.#zoomInBtn.addEventListener("click", this.#onZoomInClick);
      this.#zoomOutBtn.addEventListener("click", this.#onZoomOutClick);

      // 订阅 Manager 状态变化
      if (this.#zoomManager) {
        this.#unsubscribeZoom = this.#zoomManager.store.subscribe(
          state => state.scale,
          (scale) => {
            this.#updateZoomDisplay(scale);
          },
          { fireImmediately: true }
        );
      } else {
        // Fallback initial display
        this.#updateZoomDisplay(1.0);
      }

      // 设置页面导航按钮事件 (保持 EventBus，暂不迁移 Navigation)
      this.#onPrevPageClick = this.#onPrevPageClick || (() => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.PREVIOUS, null, { actorId: "UIZoomControls" });
      });
      this.#onNextPageClick = this.#onNextPageClick || (() => {
        this.#eventBus.emit(PDF_VIEWER_EVENTS.NAVIGATION.NEXT, null, { actorId: "UIZoomControls" });
      });
      this.#prevPageBtn.addEventListener("click", this.#onPrevPageClick);
      this.#nextPageBtn.addEventListener("click", this.#onNextPageClick);

      // 设置页码输入框事件
      this.#pageInput = document.getElementById("page-input");
      if (this.#pageInput) {
        this.#onPageInputKeydown = this.#onPageInputKeydown || ((e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.#handlePageInputChange(this.#pageInput);
          }
        });
        this.#onPageInputBlur = this.#onPageInputBlur || (() => {
          this.#handlePageInputChange(this.#pageInput);
        });
        this.#onPageInputChange = this.#onPageInputChange || (() => {
          this.#handlePageInputChange(this.#pageInput);
        });

        this.#pageInput.addEventListener("keydown", this.#onPageInputKeydown);
        this.#pageInput.addEventListener("blur", this.#onPageInputBlur);
        this.#pageInput.addEventListener("change", this.#onPageInputChange);
      }

      // 初始更新显示 (Handled by subscribe fireImmediately)
      // this.#updateZoomDisplay();
      this.#updatePageInfo(1, 1);

      this.#logger.debug("Zoom controls setup completed");

    } catch (error) {
      this.#logger.error("Failed to setup zoom controls:", error);
      throw error;
    }
  }

  /**
   * 更新缩放比例显示
   * @param {number} scale - 当前缩放比例
   * @private
   */
  #updateZoomDisplay(scale) {
    if (this.#zoomLevelDisplay) {
      // Use provided scale or fetch from manager/fallback
      const currentScale = scale !== undefined ? scale : (this.#zoomManager ? this.#zoomManager.store.get().scale : 1.0);
      const zoomPercent = Math.round(currentScale * 100);
      this.#zoomLevelDisplay.textContent = `${zoomPercent}%`;

      // 更新按钮状态
      const minScale = this.#zoomManager ? this.#zoomManager.store.get().minScale : 0.5;
      const maxScale = this.#zoomManager ? this.#zoomManager.store.get().maxScale : 3.0;

      if (this.#zoomInBtn) {
        this.#zoomInBtn.disabled = currentScale >= maxScale;
      }
      if (this.#zoomOutBtn) {
        this.#zoomOutBtn.disabled = currentScale <= minScale;
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

    // 更新页码输入框
    const pageInput = document.getElementById("page-input");
    if (pageInput) {
      pageInput.value = currentPage;
      pageInput.max = totalPages;
    }

    // 更新总页数显示
    const pageTotal = document.getElementById("page-total");
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
      this.#logger.info(`Page input changed to ${validPage}, emitting GOTO event...`);
      // 直接使用导航事件，由 CoreNavigationFeature 的 NavigationService 统一处理
      this.#eventBus.emit(
        PDF_VIEWER_EVENTS.NAVIGATION.GOTO,
        { pageNumber: validPage, positionPercent: null },
        { actorId: "UIZoomControls.PageInput" }
      );
    }
  }

  /**
   * 应用缩放动画效果
   * @param {HTMLCanvasElement} canvas - Canvas元素
   */
  applyZoomAnimation(canvas) {
    if (canvas) {
      canvas.classList.add("zoom-animation");
      this.#scheduleClassRemoval(canvas, "zoom-animation", 300);
    }
  }

  /**
   * 应用页面切换动画效果
   * @param {HTMLCanvasElement} canvas - Canvas元素
   */
  applyPageTransitionAnimation(canvas) {
    if (canvas) {
      canvas.classList.add("page-transition");
      this.#scheduleClassRemoval(canvas, "page-transition", 200);
    }
  }

  #scheduleClassRemoval(canvas, className, ms) {
    const existing = this.#pendingTimeouts.filter(
      (t) => t.canvas === canvas && t.className === className
    );
    existing.forEach((t) => {
      clearTimeout(t.id);
    });
    this.#pendingTimeouts = this.#pendingTimeouts.filter(
      (t) => !(t.canvas === canvas && t.className === className)
    );

    const id = setTimeout(() => {
      try {
        canvas.classList.remove(className);
      } finally {
        this.#pendingTimeouts = this.#pendingTimeouts.filter((t) => t.id !== id);
      }
    }, ms);

    this.#pendingTimeouts.push({ id, canvas, className });
  }

  /**
   * 设置缩放级别
   * @param {number} scale - 缩放比例
   * @param {HTMLCanvasElement} canvas - Canvas元素（可选，用于动画）
   */
  setScale(scale, canvas = null) {
    // 注意：缩放命令应统一走 EventBus（PDF_VIEWER_EVENTS.ZOOM.*），避免状态双通道。
    // 此方法仅保留动画/日志（兼容旧调用点）。
    if (canvas) {
      this.applyZoomAnimation(canvas);
    }
    this.#logger.info(`[UIZoomControls] setScale called with: ${scale}`);
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
    return this.#zoomManager ? this.#zoomManager.store.get().scale : 1.0;
  }

  /**
   * 销毁缩放控制
   */
  destroy() {
    this.#logger.info("Destroying Zoom Controls");

    // 取消订阅
    if (this.#unsubscribeZoom) {
      this.#unsubscribeZoom();
      this.#unsubscribeZoom = null;
    }

    // 清理动画 timeout（避免卸载后仍触碰 DOM）
    this.#pendingTimeouts.forEach((t) => {
      try {
        clearTimeout(t.id);
      } catch {
        // ignore
      }
      try {
        t.canvas.classList.remove(t.className);
      } catch {
        // ignore
      }
    });
    this.#pendingTimeouts = [];

    // 移除事件监听器
    if (this.#zoomInBtn && this.#onZoomInClick) {
      this.#zoomInBtn.removeEventListener("click", this.#onZoomInClick);
    }
    if (this.#zoomOutBtn && this.#onZoomOutClick) {
      this.#zoomOutBtn.removeEventListener("click", this.#onZoomOutClick);
    }
    if (this.#prevPageBtn && this.#onPrevPageClick) {
      this.#prevPageBtn.removeEventListener("click", this.#onPrevPageClick);
    }
    if (this.#nextPageBtn && this.#onNextPageClick) {
      this.#nextPageBtn.removeEventListener("click", this.#onNextPageClick);
    }

    if (this.#pageInput) {
      if (this.#onPageInputKeydown) {
        this.#pageInput.removeEventListener("keydown", this.#onPageInputKeydown);
      }
      if (this.#onPageInputBlur) {
        this.#pageInput.removeEventListener("blur", this.#onPageInputBlur);
      }
      if (this.#onPageInputChange) {
        this.#pageInput.removeEventListener("change", this.#onPageInputChange);
      }
    }

    this.#zoomInBtn = null;
    this.#zoomOutBtn = null;
    this.#zoomLevelDisplay = null;
    this.#pageInfoDisplay = null;
    this.#prevPageBtn = null;
    this.#nextPageBtn = null;
    this.#pageInput = null;
    this.#onZoomInClick = null;
    this.#onZoomOutClick = null;
    this.#onPrevPageClick = null;
    this.#onNextPageClick = null;
    this.#onPageInputKeydown = null;
    this.#onPageInputBlur = null;
    this.#onPageInputChange = null;
  }
}
