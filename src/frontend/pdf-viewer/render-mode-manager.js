/**
 * @file 渲染模式管理器
 * @module RenderModeManager
 * @description 管理Canvas和PDFViewer两种渲染模式的切换
 */

import { getLogger } from "../common/utils/logger.js";

/**
 * 渲染模式枚举
 */
export const RenderMode = {
  CANVAS: 'canvas',
  PDFVIEWER: 'pdfviewer'
};

/**
 * @class RenderModeManager
 * @description 管理渲染模式的切换和状态
 */
export class RenderModeManager {
  #logger;
  #currentMode;
  #button;
  #label;
  #onModeChange;

  constructor(onModeChangeCallback) {
    this.#logger = getLogger("RenderModeManager");
    this.#currentMode = RenderMode.PDFVIEWER; // 默认使用PDFViewer模式
    this.#onModeChange = onModeChangeCallback;
  }

  /**
   * 初始化渲染模式管理器
   */
  initialize() {
    this.#button = document.getElementById('toggle-render-mode');
    this.#label = document.getElementById('render-mode-label');

    if (!this.#button || !this.#label) {
      this.#logger.warn("Toggle button or label not found");
      return;
    }

    this.#button.addEventListener('click', () => this.toggleMode());
    this.#updateLabel();
    this.#updateVisibility(); // 初始化时设置正确的可见性
    this.#logger.info(`Render mode manager initialized, current mode: ${this.#currentMode}`);
  }

  /**
   * 切换渲染模式
   */
  toggleMode() {
    const oldMode = this.#currentMode;
    this.#currentMode = this.#currentMode === RenderMode.CANVAS
      ? RenderMode.PDFVIEWER
      : RenderMode.CANVAS;

    this.#logger.info(`Switching render mode: ${oldMode} -> ${this.#currentMode}`);
    this.#updateLabel();
    this.#updateVisibility();

    if (this.#onModeChange) {
      this.#onModeChange(this.#currentMode, oldMode);
    }
  }

  /**
   * 更新按钮标签
   * @private
   */
  #updateLabel() {
    if (!this.#label) return;

    this.#label.textContent = this.#currentMode === RenderMode.CANVAS
      ? 'Canvas渲染'
      : 'PDFViewer渲染';
  }

  /**
   * 更新容器可见性
   * @private
   */
  #updateVisibility() {
    const canvasElement = document.getElementById('pdf-canvas');
    const viewerElement = document.getElementById('viewer');
    const textLayerElement = document.getElementById('text-layer');
    const annotationLayerElement = document.getElementById('annotation-layer');

    if (this.#currentMode === RenderMode.CANVAS) {
      // Canvas模式: 显示pdf-canvas容器及其子元素
      if (canvasElement) canvasElement.style.display = 'block';
      if (textLayerElement) textLayerElement.style.display = 'block';
      if (annotationLayerElement) annotationLayerElement.style.display = 'block';
      if (viewerElement) viewerElement.style.display = 'none';
    } else {
      // PDFViewer模式: 显示viewer容器,隐藏canvas相关元素
      if (canvasElement) canvasElement.style.display = 'none';
      if (textLayerElement) textLayerElement.style.display = 'none';
      if (annotationLayerElement) annotationLayerElement.style.display = 'none';
      if (viewerElement) viewerElement.style.display = 'block';
    }

    this.#logger.debug(`Visibility updated for mode: ${this.#currentMode}`);
  }

  /**
   * 获取当前渲染模式
   * @returns {string} 当前模式
   */
  getCurrentMode() {
    this.#logger.debug(`getCurrentMode called, returning: ${this.#currentMode}`);
    return this.#currentMode;
  }

  /**
   * 设置渲染模式(不触发回调)
   * @param {string} mode - 目标模式
   */
  setMode(mode) {
    if (mode !== RenderMode.CANVAS && mode !== RenderMode.PDFVIEWER) {
      this.#logger.error(`Invalid mode: ${mode}`);
      return;
    }

    this.#currentMode = mode;
    this.#updateLabel();
    this.#updateVisibility();
    this.#logger.info(`Mode set to: ${this.#currentMode}`);
  }
}
