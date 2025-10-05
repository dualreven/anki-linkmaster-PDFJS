/**
 * @file 布局控制器
 * @module UILayoutControls
 * @description 管理PDF查看器的布局控制（滚动模式、跨页模式、旋转）
 */

import { getLogger } from "../../../../common/utils/logger.js";
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
  #scrollModeBtn = null;
  #scrollModeDropdown = null;
  #currentScrollMode = 0;
  #spreadModeSelect = null;
  #spreadModeBtn = null;
  #spreadModeDropdown = null;
  #currentSpreadMode = 0;
  #rotateCCWBtn = null;
  #rotateCWBtn = null;
  // 鼠标模式相关
  #mouseModeBtn = null;
  #currentMouseMode = 'text'; // 'text' | 'drag'
  #pdfContainer = null;
  #isDragging = false;
  #dragStartX = 0;
  #dragStartY = 0;
  #scrollStartX = 0;
  #scrollStartY = 0;

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
    this.#scrollModeBtn = document.getElementById('scroll-mode-btn');
    this.#scrollModeDropdown = document.querySelector('.scroll-mode-dropdown');
    this.#spreadModeSelect = document.getElementById('spread-mode');
    this.#spreadModeBtn = document.getElementById('spread-mode-btn');
    this.#spreadModeDropdown = document.querySelector('.spread-mode-dropdown');
    this.#rotateCCWBtn = document.getElementById('rotate-ccw');
    this.#rotateCWBtn = document.getElementById('rotate-cw');
    this.#mouseModeBtn = document.getElementById('mouse-mode-btn');
    this.#pdfContainer = document.getElementById('viewerContainer');

    // 设置事件监听器
    this.#setupEventListeners();
    this.#setupMouseModeControl();

    // 设置默认模式为文本选择
    this.#setMouseMode('text');

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
      this.#scrollModeBtn,
      this.#spreadModeSelect,
      this.#spreadModeBtn,
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
    // 滚动模式改变（隐藏select，保持兼容性）
    if (this.#scrollModeSelect) {
      this.#scrollModeSelect.addEventListener('change', (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing scroll mode to: ${mode}`);
        if (this.#pdfViewerManager && this.#pdfViewerManager.viewer) {
          this.#pdfViewerManager.scrollMode = mode;
          // 触发PDFViewer更新
          this.#pdfViewerManager.viewer.update();
          this.#logger.info(`Scroll mode updated and view refreshed`);
        }
      });
    }

    // 自定义SVG滚动模式按钮
    if (this.#scrollModeBtn && this.#scrollModeDropdown) {
      // 点击按钮切换下拉菜单显示
      this.#scrollModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.#scrollModeDropdown.style.display === 'block';
        this.#scrollModeDropdown.style.display = isVisible ? 'none' : 'block';
      });

      // 点击下拉菜单选项
      const dropdownButtons = this.#scrollModeDropdown.querySelectorAll('button[data-value]');
      dropdownButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = parseInt(btn.dataset.value, 10);
          this.#changeScrollMode(mode);
          this.#scrollModeDropdown.style.display = 'none';
        });
      });

      // 点击外部关闭下拉菜单
      document.addEventListener('click', (e) => {
        if (this.#scrollModeDropdown &&
            this.#scrollModeDropdown.style.display === 'block') {
          this.#scrollModeDropdown.style.display = 'none';
        }
      });
    }

    // 跨页模式改变（隐藏select，保持兼容性）
    if (this.#spreadModeSelect) {
      this.#spreadModeSelect.addEventListener('change', (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing spread mode to: ${mode}`);
        if (this.#pdfViewerManager && this.#pdfViewerManager.viewer) {
          this.#pdfViewerManager.spreadMode = mode;
          // 触发PDFViewer更新
          this.#pdfViewerManager.viewer.update();
          this.#logger.info(`Spread mode updated and view refreshed`);
        }
      });
    }

    // 自定义SVG跨页模式按钮
    if (this.#spreadModeBtn && this.#spreadModeDropdown) {
      // 点击按钮切换下拉菜单显示
      this.#spreadModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.#spreadModeDropdown.style.display === 'block';
        this.#spreadModeDropdown.style.display = isVisible ? 'none' : 'block';
      });

      // 点击下拉菜单选项
      const dropdownButtons = this.#spreadModeDropdown.querySelectorAll('button[data-value]');
      dropdownButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const mode = parseInt(btn.dataset.value, 10);
          this.#changeSpreadMode(mode);
          this.#spreadModeDropdown.style.display = 'none';
        });
      });

      // 点击外部关闭下拉菜单
      document.addEventListener('click', (e) => {
        if (this.#spreadModeDropdown &&
            this.#spreadModeDropdown.style.display === 'block') {
          this.#spreadModeDropdown.style.display = 'none';
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
   * 改变滚动模式
   * @param {number} mode - 滚动模式（0=垂直, 1=水平, 2=环绕, 3=单页）
   * @private
   */
  #changeScrollMode(mode) {
    this.#currentScrollMode = mode;
    this.#logger.info(`Changing scroll mode to: ${mode}`);

    // 更新按钮图标
    this.#updateScrollModeIcon(mode);

    // 同步更新隐藏的select（保持兼容性）
    if (this.#scrollModeSelect) {
      this.#scrollModeSelect.value = mode;
      // 触发change事件，让原有的处理逻辑生效
      this.#scrollModeSelect.dispatchEvent(new Event('change'));
    }
  }

  /**
   * 更新滚动模式按钮图标
   * @param {number} mode - 滚动模式（0=垂直, 1=水平, 2=环绕, 3=单页）
   * @private
   */
  #updateScrollModeIcon(mode) {
    if (!this.#scrollModeBtn) return;

    const iconSVG = this.#scrollModeBtn.querySelector('.scroll-icon');
    if (!iconSVG) return;

    if (mode === 0) {
      // 垂直滚动：3个方框垂直排列
      iconSVG.innerHTML = '<rect x="4" y="1" width="10" height="4" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="4" y="7" width="10" height="4" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="4" y="13" width="10" height="4" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    } else if (mode === 1) {
      // 水平滚动：3个方框水平排列
      iconSVG.innerHTML = '<rect x="1" y="4" width="4" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="7" y="4" width="4" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="4" width="4" height="10" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    } else if (mode === 2) {
      // 环绕滚动：4个方框2x2网格
      iconSVG.innerHTML = '<rect x="1" y="1" width="7" height="7" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="10" y="1" width="7" height="7" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="1" y="10" width="7" height="7" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="10" y="10" width="7" height="7" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    } else if (mode === 3) {
      // 单页：1个大方框
      iconSVG.innerHTML = '<rect x="3" y="1" width="12" height="16" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    }
  }

  /**
   * 改变跨页模式
   * @param {number} mode - 跨页模式（0=单页, 2=双页）
   * @private
   */
  #changeSpreadMode(mode) {
    this.#currentSpreadMode = mode;
    this.#logger.info(`Changing spread mode to: ${mode}`);

    // 更新按钮图标
    this.#updateSpreadModeIcon(mode);

    // 同步更新隐藏的select（保持兼容性）
    if (this.#spreadModeSelect) {
      this.#spreadModeSelect.value = mode;
      // 触发change事件，让原有的处理逻辑生效
      this.#spreadModeSelect.dispatchEvent(new Event('change'));
    }
  }

  /**
   * 更新跨页模式按钮图标
   * @param {number} mode - 跨页模式（0=单页, 2=双页）
   * @private
   */
  #updateSpreadModeIcon(mode) {
    if (!this.#spreadModeBtn) return;

    const iconSVG = this.#spreadModeBtn.querySelector('.spread-icon');
    if (!iconSVG) return;

    if (mode === 0) {
      // 单页图标
      iconSVG.innerHTML = '<rect x="5" y="2" width="8" height="14" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    } else if (mode === 2) {
      // 双页图标
      iconSVG.innerHTML = '<rect x="1" y="2" width="7" height="14" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="10" y="2" width="7" height="14" stroke="currentColor" stroke-width="1.5" fill="none"/>';
    }
  }

  /**
   * 旋转页面
   * @param {number} degrees - 旋转角度（90 or -90）
   * @private
   */
  #rotatePages(degrees) {
    if (!this.#pdfViewerManager || !this.#pdfViewerManager.viewer) return;

    const currentRotation = this.#pdfViewerManager.pagesRotation || 0;
    let newRotation = (currentRotation + degrees) % 360;

    // 确保旋转值在0-360之间
    if (newRotation < 0) newRotation += 360;

    this.#logger.info(`Rotating pages: ${currentRotation}° -> ${newRotation}°`);
    this.#pdfViewerManager.pagesRotation = newRotation;

    // 触发PDFViewer更新
    this.#pdfViewerManager.viewer.update();
    this.#logger.info(`Pages rotated and view refreshed`);
  }

  /**
   * 设置鼠标模式控制器
   * @private
   */
  #setupMouseModeControl() {
    if (!this.#mouseModeBtn) {
      this.#logger.warn('Mouse mode button not found');
      return;
    }

    // 点击按钮切换模式
    this.#mouseModeBtn.addEventListener('click', () => {
      this.#toggleMouseMode();
    });

    this.#logger.info('Mouse mode control setup complete');
  }

  /**
   * 切换鼠标模式
   * @private
   */
  #toggleMouseMode() {
    const newMode = this.#currentMouseMode === 'text' ? 'drag' : 'text';
    this.#setMouseMode(newMode);
  }

  /**
   * 设置鼠标模式
   * @param {'text' | 'drag'} mode - 鼠标模式
   * @private
   */
  #setMouseMode(mode) {
    if (!this.#pdfContainer) {
      this.#logger.warn('PDF container not found');
      return;
    }

    this.#currentMouseMode = mode;

    // 更新CSS类名
    if (mode === 'drag') {
      this.#pdfContainer.classList.remove('text-mode');
      this.#pdfContainer.classList.add('drag-mode');
      this.#setupDragListeners();
    } else {
      this.#pdfContainer.classList.remove('drag-mode');
      this.#pdfContainer.classList.add('text-mode');
      this.#removeDragListeners();
    }

    // 更新按钮图标和tooltip
    this.#updateMouseModeIcon(mode);

    // 发出事件
    this.#eventBus.emit('pdf-viewer:mouse-mode:changed', {
      mode: mode
    });

    this.#logger.info(`Mouse mode changed to: ${mode}`);
  }

  /**
   * 更新鼠标模式按钮图标
   * @param {'text' | 'drag'} mode - 鼠标模式
   * @private
   */
  #updateMouseModeIcon(mode) {
    if (!this.#mouseModeBtn) return;

    const iconSVG = this.#mouseModeBtn.querySelector('.mouse-icon');
    if (!iconSVG) return;

    if (mode === 'text') {
      // 文本选择图标：I字形光标 + 文本线条
      iconSVG.innerHTML = `
        <path d="M6 3 L6 4 L8 4 L8 14 L6 14 L6 15 L12 15 L12 14 L10 14 L10 4 L12 4 L12 3 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1" opacity="0.5"/>
        <line x1="4" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      `;
      this.#mouseModeBtn.title = '鼠标模式：文本选择';
    } else {
      // 手形拖拽图标
      iconSVG.innerHTML = `
        <path d="M9 6 L9 3 L10 3 L10 6 M11 6 L11 2 L12 2 L12 6 M13 6 L13 3 L14 3 L14 9 L14 12 C14 13.5 13 15 11 15 L8 15 C6.5 15 5 14 4 12 L4 10 L5 10 L5 12 C5.5 13 6.5 14 8 14 L11 14 C12 14 13 13 13 12 L13 9 M7 6 L7 8 L8 8 L8 6 Z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      this.#mouseModeBtn.title = '鼠标模式：拖拽浏览';
    }
  }

  /**
   * 设置拖拽事件监听器
   * @private
   */
  #setupDragListeners() {
    if (!this.#pdfContainer) return;

    // 使用箭头函数绑定this，并保存引用以便后续移除
    this._handleMouseDown = this._handleMouseDown || this.#handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove || this.#handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp || this.#handleMouseUp.bind(this);

    this.#pdfContainer.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);

    this.#logger.debug('Drag listeners added');
  }

  /**
   * 移除拖拽事件监听器
   * @private
   */
  #removeDragListeners() {
    if (!this.#pdfContainer) return;

    if (this._handleMouseDown) {
      this.#pdfContainer.removeEventListener('mousedown', this._handleMouseDown);
    }
    if (this._handleMouseMove) {
      document.removeEventListener('mousemove', this._handleMouseMove);
    }
    if (this._handleMouseUp) {
      document.removeEventListener('mouseup', this._handleMouseUp);
    }

    this.#logger.debug('Drag listeners removed');
  }

  /**
   * 处理鼠标按下事件
   * @param {MouseEvent} e - 鼠标事件
   * @private
   */
  #handleMouseDown(e) {
    if (this.#currentMouseMode !== 'drag') return;

    this.#isDragging = true;
    this.#dragStartX = e.clientX;
    this.#dragStartY = e.clientY;
    this.#scrollStartX = this.#pdfContainer.scrollLeft;
    this.#scrollStartY = this.#pdfContainer.scrollTop;

    this.#pdfContainer.classList.add('dragging');

    e.preventDefault();
  }

  /**
   * 处理鼠标移动事件
   * @param {MouseEvent} e - 鼠标事件
   * @private
   */
  #handleMouseMove(e) {
    if (!this.#isDragging || this.#currentMouseMode !== 'drag') return;

    const deltaX = e.clientX - this.#dragStartX;
    const deltaY = e.clientY - this.#dragStartY;

    this.#pdfContainer.scrollLeft = this.#scrollStartX - deltaX;
    this.#pdfContainer.scrollTop = this.#scrollStartY - deltaY;

    e.preventDefault();
  }

  /**
   * 处理鼠标释放事件
   * @param {MouseEvent} e - 鼠标事件
   * @private
   */
  #handleMouseUp(e) {
    if (!this.#isDragging) return;

    this.#isDragging = false;
    this.#pdfContainer.classList.remove('dragging');

    e.preventDefault();
  }

  /**
   * 销毁控制器
   */
  destroy() {
    // 清理拖拽监听器
    this.#removeDragListeners();

    this.#scrollModeSelect = null;
    this.#scrollModeBtn = null;
    this.#scrollModeDropdown = null;
    this.#spreadModeSelect = null;
    this.#spreadModeBtn = null;
    this.#spreadModeDropdown = null;
    this.#rotateCCWBtn = null;
    this.#rotateCWBtn = null;
    this.#mouseModeBtn = null;
    this.#pdfContainer = null;
    this.#pdfViewerManager = null;
    this.#logger.info("Layout controls destroyed");
  }
}
