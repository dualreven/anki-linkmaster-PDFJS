/**
 * @file 布局控制器
 * @module UILayoutControls
 * @description 管理PDF查看器的布局控制（滚动模式、跨页模式、旋转）
 */

import { getLogger } from "../common/utils/logger.js";
import { PDFViewerManager } from "./pdf-viewer-manager.js";

/**
 * @class UILayoutControls
 * @description 处理PDF布局相关的UI控制
 */
export class UILayoutControls {
  #logger;
  #eventBus;
  #pdfViewerManager;
  #scrollModeSelect = null;
  #spreadModeSelect = null;
  #rotateCCWBtn = null;
  #rotateCWBtn = null;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#logger = getLogger("UILayoutControls");
  }

  /**
   * 设置布局控件
   * @param {PDFViewerManager} pdfViewerManager - PDF查看器管理器
   */
  setup(pdfViewerManager) {
    this.#pdfViewerManager = pdfViewerManager;

    // 获取DOM元素
    this.#scrollModeSelect = document.getElementById('scroll-mode');
    this.#spreadModeSelect = document.getElementById('spread-mode');
    this.#rotateCCWBtn = document.getElementById('rotate-ccw');
    this.#rotateCWBtn = document.getElementById('rotate-cw');

    // 设置事件监听器
    this.#setupEventListeners();

    // 监听渲染模式变化
    this.#eventBus.on('pdf-viewer:render-mode:changed', this.#handleRenderModeChange.bind(this));

    this.#logger.info("Layout controls initialized");
  }

  /**
   * 处理渲染模式变化
   * @param {Object} data - 事件数据
   * @private
   */
  #handleRenderModeChange(data) {
    const isPDFViewerMode = data?.newMode === 'pdfviewer';
    this.#setControlsEnabled(isPDFViewerMode);
  }

  /**
   * 启用/禁用控件
   * @param {boolean} enabled - 是否启用
   * @private
   */
  #setControlsEnabled(enabled) {
    const controls = [
      this.#scrollModeSelect,
      this.#spreadModeSelect,
      this.#rotateCCWBtn,
      this.#rotateCWBtn
    ];

    controls.forEach(control => {
      if (control) {
        control.disabled = !enabled;
      }
    });

    this.#logger.info(`Layout controls ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 设置事件监听器
   * @private
   */
  #setupEventListeners() {
    // 滚动模式改变
    if (this.#scrollModeSelect) {
      this.#scrollModeSelect.addEventListener('change', (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing scroll mode to: ${mode}`);
        if (this.#pdfViewerManager) {
          this.#pdfViewerManager.scrollMode = mode;
        }
      });
    }

    // 跨页模式改变
    if (this.#spreadModeSelect) {
      this.#spreadModeSelect.addEventListener('change', (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing spread mode to: ${mode}`);
        if (this.#pdfViewerManager) {
          this.#pdfViewerManager.spreadMode = mode;
        }
      });
    }

    // 逆时针旋转
    if (this.#rotateCCWBtn) {
      this.#rotateCCWBtn.addEventListener('click', () => {
        this.#rotatePages(-90);
      });
    }

    // 顺时针旋转
    if (this.#rotateCWBtn) {
      this.#rotateCWBtn.addEventListener('click', () => {
        this.#rotatePages(90);
      });
    }
  }

  /**
   * 旋转页面
   * @param {number} degrees - 旋转角度（90 or -90）
   * @private
   */
  #rotatePages(degrees) {
    if (!this.#pdfViewerManager) return;

    const currentRotation = this.#pdfViewerManager.pagesRotation || 0;
    let newRotation = (currentRotation + degrees) % 360;

    // 确保旋转值在0-360之间
    if (newRotation < 0) newRotation += 360;

    this.#logger.info(`Rotating pages: ${currentRotation}° -> ${newRotation}°`);
    this.#pdfViewerManager.pagesRotation = newRotation;
  }

  /**
   * 销毁控制器
   */
  destroy() {
    this.#scrollModeSelect = null;
    this.#spreadModeSelect = null;
    this.#rotateCCWBtn = null;
    this.#rotateCWBtn = null;
    this.#pdfViewerManager = null;
    this.#logger.info("Layout controls destroyed");
  }
}
