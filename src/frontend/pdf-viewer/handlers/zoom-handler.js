/**
 * @file 缩放事件处理器
 * @module ZoomHandler
 * @description 处理PDF查看器的缩放相关事件
 */

import { PDF_VIEWER_EVENTS } from "../../common/event/pdf-viewer-constants.js";
import { getLogger } from "../../common/utils/logger.js";

/**
 * 缩放处理器类
 * 负责处理所有缩放相关的事件
 */
export class ZoomHandler {
  #app;
  #logger;
  #zoomLimits = {
    min: 0.25,
    max: 5.0,
    step: 0.25,
    defaultScale: 1.0
  };

  constructor(app) {
    this.#app = app;
    this.#logger = getLogger("ZoomHandler");
  }

  /**
   * 设置缩放相关的事件监听器
   */
  setupEventListeners() {
    const eventBus = this.#app.eventBus;

    // 放大
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.IN, (data) => {
      this.handleZoomIn(data);
    }, { subscriberId: 'ZoomHandler' });

    // 缩小
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.OUT, (data) => {
      this.handleZoomOut(data);
    }, { subscriberId: 'ZoomHandler' });

    // 适应宽度
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_WIDTH, () => {
      this.handleFitWidth();
    }, { subscriberId: 'ZoomHandler' });

    // 适应高度
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.FIT_HEIGHT, () => {
      this.handleFitHeight();
    }, { subscriberId: 'ZoomHandler' });

    // 实际大小
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.ACTUAL_SIZE, () => {
      this.handleActualSize();
    }, { subscriberId: 'ZoomHandler' });

    // 注意: SET_SCALE 事件在当前版本中未定义
    // 可通过 ZOOM.CHANGED 事件或直接调用方法实现

    // 缩放改变事件（来自其他组件）
    eventBus.on(PDF_VIEWER_EVENTS.ZOOM.CHANGED, (data) => {
      this.handleZoomChanged(data);
    }, { subscriberId: 'ZoomHandler' });

    this.#logger.info("Zoom event listeners setup complete");
  }

  /**
   * 处理放大操作
   * @param {Object} [data] - 缩放数据
   * @param {number} [data.delta] - 缩放增量
   */
  handleZoomIn(data) {
    const delta = data?.delta || this.#zoomLimits.step;
    const newScale = Math.min(
      this.#app.zoomLevel + delta,
      this.#zoomLimits.max
    );

    if (newScale !== this.#app.zoomLevel) {
      this.#setZoomLevel(newScale, 'zoom-in');
    }
  }

  /**
   * 处理缩小操作
   * @param {Object} [data] - 缩放数据
   * @param {number} [data.delta] - 缩放减量
   */
  handleZoomOut(data) {
    const delta = data?.delta || this.#zoomLimits.step;
    const newScale = Math.max(
      this.#app.zoomLevel - delta,
      this.#zoomLimits.min
    );

    if (newScale !== this.#app.zoomLevel) {
      this.#setZoomLevel(newScale, 'zoom-out');
    }
  }

  /**
   * 处理适应宽度
   */
  async handleFitWidth() {
    if (!this.#validateZoomPreconditions()) return;

    try {
      const page = await this.#app.pdfManager.getPage(this.#app.currentPage);
      const containerWidth = this.#app.uiManager.getContainerWidth();
      const viewport = page.getViewport({ scale: 1 });

      // 计算适应宽度的缩放比例（考虑边距）
      const padding = 20; // 左右各10px边距
      const scale = (containerWidth - padding) / viewport.width;

      this.#setZoomLevel(scale, 'fit-width');
      this.#logger.info(`Zoom fit width: ${scale.toFixed(2)}`);

    } catch (error) {
      this.#logger.error("Failed to fit width:", error);
      this.#app.errorHandler.handleError(error, "ZoomFitWidth");
    }
  }

  /**
   * 处理适应高度
   */
  async handleFitHeight() {
    if (!this.#validateZoomPreconditions()) return;

    try {
      const page = await this.#app.pdfManager.getPage(this.#app.currentPage);
      const containerHeight = this.#app.uiManager.getContainerHeight();
      const viewport = page.getViewport({ scale: 1 });

      // 计算适应高度的缩放比例（考虑边距）
      const padding = 20; // 上下各10px边距
      const scale = (containerHeight - padding) / viewport.height;

      this.#setZoomLevel(scale, 'fit-height');
      this.#logger.info(`Zoom fit height: ${scale.toFixed(2)}`);

    } catch (error) {
      this.#logger.error("Failed to fit height:", error);
      this.#app.errorHandler.handleError(error, "ZoomFitHeight");
    }
  }

  /**
   * 处理实际大小（100%）
   */
  handleActualSize() {
    this.#setZoomLevel(this.#zoomLimits.defaultScale, 'actual-size');
  }

  /**
   * 处理设置特定缩放级别
   * @param {Object} data - 缩放数据
   * @param {number} data.scale - 缩放级别
   */
  handleSetScale(data) {
    if (!data?.scale || isNaN(data.scale)) {
      this.#logger.warn("Invalid scale value:", data?.scale);
      return;
    }

    const scale = this.#clampScale(data.scale);
    this.#setZoomLevel(scale, 'custom');
  }

  /**
   * 处理缩放改变事件（来自其他组件）
   * @param {Object} data - 缩放数据
   */
  handleZoomChanged(data) {
    if (data?.scale && !isNaN(data.scale)) {
      // 只更新内部状态，不重新渲染
      this.#app.zoomLevel = this.#clampScale(data.scale);
      this.#logger.debug(`Zoom level updated: ${this.#app.zoomLevel}`);
    }
  }

  /**
   * 设置缩放级别并应用
   * @param {number} scale - 新的缩放级别
   * @param {string} mode - 缩放模式
   * @private
   */
  async #setZoomLevel(scale, mode) {
    const clampedScale = this.#clampScale(scale);

    if (clampedScale === this.#app.zoomLevel) {
      this.#logger.debug(`Zoom level unchanged: ${clampedScale}`);
      return;
    }

    const oldScale = this.#app.zoomLevel;
    this.#app.zoomLevel = clampedScale;

    this.#logger.info(`Zoom changed: ${oldScale.toFixed(2)} → ${clampedScale.toFixed(2)} (${mode})`);

    // 发送缩放变更事件
    this.#app.eventBus.emit(
      PDF_VIEWER_EVENTS.ZOOM.CHANGED,
      {
        scale: clampedScale,
        oldScale: oldScale,
        mode: mode,
        percentage: Math.round(clampedScale * 100)
      },
      { actorId: 'ZoomHandler' }
    );

    // 更新UI管理器中的缩放比例
    this.#app.uiManager.setScale(clampedScale);

    // 应用缩放
    await this.#applyZoom();
  }

  /**
   * 应用缩放设置
   * @private
   */
  async #applyZoom() {
    if (!this.#validateZoomPreconditions()) return;

    try {
      // 重新渲染当前页面
      const page = await this.#app.pdfManager.getPage(this.#app.currentPage);
      const viewport = page.getViewport({ scale: this.#app.zoomLevel });

      await this.#app.uiManager.renderPage(page, viewport);

      this.#logger.debug(`Zoom applied: ${this.#app.zoomLevel.toFixed(2)}`);

    } catch (error) {
      this.#logger.error("Failed to apply zoom:", error);
      this.#app.errorHandler.handleError(error, "ZoomApply");
    }
  }

  /**
   * 限制缩放级别在有效范围内
   * @param {number} scale - 缩放级别
   * @returns {number} 限制后的缩放级别
   * @private
   */
  #clampScale(scale) {
    return Math.max(
      this.#zoomLimits.min,
      Math.min(this.#zoomLimits.max, scale)
    );
  }

  /**
   * 验证缩放前提条件
   * @returns {boolean} 是否满足缩放条件
   * @private
   */
  #validateZoomPreconditions() {
    if (!this.#app.currentFile) {
      this.#logger.warn("No file loaded for zoom operation");
      return false;
    }

    if (this.#app.currentPage <= 0 || this.#app.currentPage > this.#app.totalPages) {
      this.#logger.warn("Invalid page for zoom operation");
      return false;
    }

    return true;
  }

  /**
   * 获取当前缩放级别
   * @returns {number} 当前缩放级别
   */
  getCurrentScale() {
    return this.#app.zoomLevel;
  }

  /**
   * 获取缩放百分比
   * @returns {number} 缩放百分比
   */
  getZoomPercentage() {
    return Math.round(this.#app.zoomLevel * 100);
  }

  /**
   * 获取缩放限制
   * @returns {Object} 缩放限制配置
   */
  getZoomLimits() {
    return { ...this.#zoomLimits };
  }

  /**
   * 重置缩放到默认值
   */
  reset() {
    this.#app.zoomLevel = this.#zoomLimits.defaultScale;
    this.#logger.info("Zoom reset to default");
  }

  /**
   * 销毁处理器
   */
  destroy() {
    this.reset();
    this.#logger.info("Zoom handler destroyed");
  }
}