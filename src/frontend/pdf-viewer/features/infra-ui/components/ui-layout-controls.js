/**
 * UILayoutControls（布局控制）
 * 说明（详细）：`docs/standards/ui-layout-controls.md`
 */
import { getLogger } from "../../../../common/utils/logger.js";
import { showInfo } from "../../../../common/utils/notification.js";
import { PDF_VIEWER_EVENTS } from "../../../../common/event/pdf-viewer-constants.js";
export class UILayoutControls {
  #logger;
  #eventBus;
  #layoutManager; // New dependency
  #pdfViewerManager;
  #scrollModeSelect = null;
  #scrollModeBtn = null;
  #scrollModeDropdown = null;
  #spreadModeSelect = null;
  #spreadModeBtn = null;
  #spreadModeDropdown = null;
  #rotateCCWBtn = null;
  #rotateCWBtn = null;
  // 鼠标模式相关
  #mouseModeBtn = null;
  #pdfContainer = null;
  #isDragging = false;
  #dragStartX = 0;
  #dragStartY = 0;
  #scrollStartX = 0;
  #scrollStartY = 0;
  #unsubscribe = null;
  #domCleanupFns = [];
  #eventBusUnsubs = [];
  constructor(eventBus, layoutManager) {
    this.#eventBus = eventBus;
    this.#layoutManager = layoutManager;
    this.#logger = getLogger("UILayoutControls");
  }
  setup(pdfViewerManager) {
    this.#pdfViewerManager = pdfViewerManager;
    // 获取DOM元素
    this.#scrollModeSelect = document.getElementById("scroll-mode");
    this.#scrollModeBtn = document.getElementById("scroll-mode-btn");
    this.#scrollModeDropdown = document.querySelector(".scroll-mode-dropdown");
    this.#spreadModeSelect = document.getElementById("spread-mode");
    this.#spreadModeBtn = document.getElementById("spread-mode-btn");
    this.#spreadModeDropdown = document.querySelector(".spread-mode-dropdown");
    this.#rotateCCWBtn = document.getElementById("rotate-ccw");
    this.#rotateCWBtn = document.getElementById("rotate-cw");
    this.#mouseModeBtn = document.getElementById("mouse-mode-btn");
    this.#pdfContainer = document.getElementById("viewerContainer");
    // 设置事件监听器
    this.#setupEventListeners();
    this.#setupMouseModeControl();
    // 订阅 Manager 状态
    if (this.#layoutManager) {
      this.#unsubscribe = this.#layoutManager.store.subscribe((state, oldState) => {
        if (!oldState || state.scrollMode !== oldState.scrollMode) {
          this.#updateScrollMode(state.scrollMode);
        }
        if (!oldState || state.spreadMode !== oldState.spreadMode) {
          this.#updateSpreadMode(state.spreadMode);
        }
        if (!oldState || state.rotation !== oldState.rotation) {
          this.#updateRotation(state.rotation);
        }
        if (!oldState || state.mouseMode !== oldState.mouseMode) {
          this.#updateMouseMode(state.mouseMode);
        }
      }, { fireImmediately: true });
    }
    // 监听渲染模式变化（使用事件常量，位于 VIEW_MODE 命名空间）
    this.#eventBusUnsubs.push(this.#eventBus.on(
      PDF_VIEWER_EVENTS.VIEW_MODE.RENDER_MODE_CHANGED,
      this.#handleRenderModeChange.bind(this),
      { subscriberId: "UILayoutControls.setup:2" }
    ));

    this.#logger.info("Layout controls initialized");
  }

  #handleRenderModeChange(data) {
    const isPDFViewerMode = data?.newMode === "pdfviewer";
    this.#setControlsEnabled(isPDFViewerMode);
  }

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
    this.#logger.info(`Layout controls ${enabled ? "enabled" : "disabled"}`);
  }
  #setupEventListeners() {
    // 滚动模式改变（隐藏select，保持兼容性）
    if (this.#scrollModeSelect) {
      const el = this.#scrollModeSelect;
      const onChange = (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing scroll mode to: ${mode}`);
        if (this.#layoutManager) {
          this.#layoutManager.setScrollMode(mode);
        }
      };
      el.addEventListener("change", onChange);
      this.#domCleanupFns.push(() => el.removeEventListener("change", onChange));
    }
    // 自定义SVG滚动模式按钮
    if (this.#scrollModeBtn && this.#scrollModeDropdown) {
      const btnEl = this.#scrollModeBtn;
      const dropdownEl = this.#scrollModeDropdown;
      // 点击按钮切换下拉菜单显示
      const onToggleClick = (e) => {
        e.stopPropagation();
        const isVisible = dropdownEl.style.display === "block";
        dropdownEl.style.display = isVisible ? "none" : "block";
      };
      btnEl.addEventListener("click", onToggleClick);
      this.#domCleanupFns.push(() => btnEl.removeEventListener("click", onToggleClick));
      // 点击下拉菜单选项
      const dropdownButtons = dropdownEl.querySelectorAll("button[data-value]");
      dropdownButtons.forEach(btn => {
        const onOptionClick = (e) => {
          e.stopPropagation();
          const mode = parseInt(btn.dataset.value, 10);
          if (this.#layoutManager) {
            this.#layoutManager.setScrollMode(mode);
          }
          dropdownEl.style.display = "none";
        };
        btn.addEventListener("click", onOptionClick);
        this.#domCleanupFns.push(() => btn.removeEventListener("click", onOptionClick));
      });
      // 点击外部关闭下拉菜单
      const onDocumentClick = () => {
        if (dropdownEl && dropdownEl.style.display === "block") {
          dropdownEl.style.display = "none";
        }
      };
      document.addEventListener("click", onDocumentClick);
      this.#domCleanupFns.push(() => document.removeEventListener("click", onDocumentClick));
    }
    // 跨页模式改变（隐藏select，保持兼容性）
    if (this.#spreadModeSelect) {
      const el = this.#spreadModeSelect;
      const onChange = (e) => {
        const mode = parseInt(e.target.value, 10);
        this.#logger.info(`Changing spread mode to: ${mode}`);
        if (this.#layoutManager) {
          this.#layoutManager.setSpreadMode(mode);
        }
      };
      el.addEventListener("change", onChange);
      this.#domCleanupFns.push(() => el.removeEventListener("change", onChange));
    }
    // 自定义SVG跨页模式按钮
    if (this.#spreadModeBtn && this.#spreadModeDropdown) {
      const btnEl = this.#spreadModeBtn;
      const dropdownEl = this.#spreadModeDropdown;
      // 点击按钮切换下拉菜单显示
      const onToggleClick = (e) => {
        e.stopPropagation();
        const isVisible = dropdownEl.style.display === "block";
        dropdownEl.style.display = isVisible ? "none" : "block";
      };
      btnEl.addEventListener("click", onToggleClick);
      this.#domCleanupFns.push(() => btnEl.removeEventListener("click", onToggleClick));
      // 点击下拉菜单选项
      const dropdownButtons = dropdownEl.querySelectorAll("button[data-value]");
      dropdownButtons.forEach(btn => {
        const onOptionClick = (e) => {
          e.stopPropagation();
          const mode = parseInt(btn.dataset.value, 10);
          if (this.#layoutManager) {
            this.#layoutManager.setSpreadMode(mode);
          }
          dropdownEl.style.display = "none";
        };
        btn.addEventListener("click", onOptionClick);
        this.#domCleanupFns.push(() => btn.removeEventListener("click", onOptionClick));
      });
      // 点击外部关闭下拉菜单
      const onDocumentClick = () => {
        if (dropdownEl && dropdownEl.style.display === "block") {
          dropdownEl.style.display = "none";
        }
      };
      document.addEventListener("click", onDocumentClick);
      this.#domCleanupFns.push(() => document.removeEventListener("click", onDocumentClick));
    }
    // 逆时针旋转
    if (this.#rotateCCWBtn) {
      const el = this.#rotateCCWBtn;
      const onClick = () => {
        if (this.#layoutManager) {
          this.#layoutManager.rotate(-90);
        }
      };
      el.addEventListener("click", onClick);
      this.#domCleanupFns.push(() => el.removeEventListener("click", onClick));
    }
    // 顺时针旋转
    if (this.#rotateCWBtn) {
      const el = this.#rotateCWBtn;
      const onClick = () => {
        if (this.#layoutManager) {
          this.#layoutManager.rotate(90);
        }
      };
      el.addEventListener("click", onClick);
      this.#domCleanupFns.push(() => el.removeEventListener("click", onClick));
    }
  }
  // Called by Subscription
  #updateScrollMode(mode) {
    this.#logger.info(`Applying scroll mode: ${mode}`);

    // Update PDFViewer
    if (this.#pdfViewerManager && this.#pdfViewerManager.viewer) {
      if (this.#pdfViewerManager.scrollMode !== mode) {
        this.#pdfViewerManager.scrollMode = mode;
        this.#pdfViewerManager.viewer.update();
        this.#logger.info("Scroll mode applied to PDFViewer");
      }
    }
    // 更新按钮图标
    this.#updateScrollModeIcon(mode);
    // 显示Toast提示
    const modeNames = {
      0: "📄 垂直滚动模式",
      1: "↔️ 水平滚动模式",
      3: "📃 单页模式"
    };
    showInfo(modeNames[mode] || `滚动模式：${mode}`);
    // 同步更新隐藏的select（保持兼容性）
    if (this.#scrollModeSelect && parseInt(this.#scrollModeSelect.value, 10) !== mode) {
      this.#scrollModeSelect.value = mode;
    }
  }
  #updateScrollModeIcon(mode) {
    if (!this.#scrollModeBtn) {return;}
    const iconSVG = this.#scrollModeBtn.querySelector(".scroll-icon");
    if (!iconSVG) {return;}
    if (mode === 0) {
      // 垂直滚动
      iconSVG.innerHTML = "<rect x=\"4\" y=\"1\" width=\"10\" height=\"4\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"4\" y=\"7\" width=\"10\" height=\"4\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"4\" y=\"13\" width=\"10\" height=\"4\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>";
    } else if (mode === 1) {
      // 水平滚动
      iconSVG.innerHTML = "<rect x=\"1\" y=\"4\" width=\"4\" height=\"10\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"7\" y=\"4\" width=\"4\" height=\"10\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"13\" y=\"4\" width=\"4\" height=\"10\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>";
    } else if (mode === 3) {
      // 单页
      iconSVG.innerHTML = "<rect x=\"3\" y=\"1\" width=\"12\" height=\"16\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>";
    }
  }
  // Called by Subscription
  #updateSpreadMode(mode) {
    this.#logger.info(`Applying spread mode: ${mode}`);
    // Update PDFViewer
    if (this.#pdfViewerManager && this.#pdfViewerManager.viewer) {
      if (this.#pdfViewerManager.spreadMode !== mode) {
        this.#pdfViewerManager.spreadMode = mode;
        this.#pdfViewerManager.viewer.update();
        this.#logger.info("Spread mode applied to PDFViewer");
      }
    }
    // 更新按钮图标
    this.#updateSpreadModeIcon(mode);
    // 显示Toast提示
    const modeNames = {
      0: "📄 单页模式",
      2: "📖 偶数双页"
    };
    showInfo(modeNames[mode] || `跨页模式：${mode}`);
    // 同步更新隐藏的select（保持兼容性）
    if (this.#spreadModeSelect && parseInt(this.#spreadModeSelect.value, 10) !== mode) {
      this.#spreadModeSelect.value = mode;
    }
  }
  #updateSpreadModeIcon(mode) {
    if (!this.#spreadModeBtn) {return;}
    const iconSVG = this.#spreadModeBtn.querySelector(".spread-icon");
    if (!iconSVG) {return;}
    if (mode === 0) {
      // 单页图标
      iconSVG.innerHTML = "<rect x=\"5\" y=\"2\" width=\"8\" height=\"14\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>";
    } else if (mode === 2) {
      // 双页图标
      iconSVG.innerHTML = "<rect x=\"1\" y=\"2\" width=\"7\" height=\"14\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/><rect x=\"10\" y=\"2\" width=\"7\" height=\"14\" stroke=\"currentColor\" stroke-width=\"1.5\" fill=\"none\"/>";
    }
  }
  // Called by Subscription
  #updateRotation(rotation) {
    this.#logger.info(`Applying rotation: ${rotation}`);
    if (this.#pdfViewerManager && this.#pdfViewerManager.viewer) {
      if (this.#pdfViewerManager.pagesRotation !== rotation) {
        this.#pdfViewerManager.pagesRotation = rotation;
        this.#pdfViewerManager.viewer.update();
        this.#logger.info("Rotation applied to PDFViewer");
      }
    }
  }
  #setupMouseModeControl() {
    if (!this.#mouseModeBtn) {
      this.#logger.warn("Mouse mode button not found");
      return;
    }
    // 点击按钮切换模式 -> Manager
    const el = this.#mouseModeBtn;
    const onClick = () => {
      if (this.#layoutManager) {
        this.#layoutManager.toggleMouseMode();
      }
    };
    el.addEventListener("click", onClick);
    this.#domCleanupFns.push(() => el.removeEventListener("click", onClick));
    this.#logger.info("Mouse mode control setup complete");
  }
  // Called by Subscription
  #updateMouseMode(mode) {
    if (!this.#pdfContainer) {
      this.#logger.warn("PDF container not found");
      return;
    }
    // 更新CSS类名
    if (mode === "drag") {
      this.#pdfContainer.classList.remove("text-mode");
      this.#pdfContainer.classList.add("drag-mode");
      this.#setupDragListeners();
    } else {
      this.#pdfContainer.classList.remove("drag-mode");
      this.#pdfContainer.classList.add("text-mode");
      this.#removeDragListeners();
    }

    // 更新按钮图标和tooltip
    this.#updateMouseModeIcon(mode);

    // 显示Toast提示
    const modeNames = {
      "text": "📝 文本选择模式",
      "drag": "🤚 拖拽浏览模式"
    };
    showInfo(modeNames[mode] || `已切换到${mode}模式`);

    // Manager already emitted event, so we don't need to.

    this.#logger.info(`Mouse mode updated to: ${mode}`);
  }

  /**
   * 更新鼠标模式按钮图标
   * @param {'text' | 'drag'} mode - 鼠标模式
   * @private
   */
  #updateMouseModeIcon(mode) {
    if (!this.#mouseModeBtn) {return;}

    const iconSVG = this.#mouseModeBtn.querySelector(".mouse-icon");
    if (!iconSVG) {return;}

    if (mode === "text") {
      // 文本选择图标
      iconSVG.innerHTML = `
        <path d="M6 3 L6 4 L8 4 L8 14 L6 14 L6 15 L12 15 L12 14 L10 14 L10 4 L12 4 L12 3 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <line x1="4" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1" opacity="0.5"/>
        <line x1="4" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      `;
      this.#mouseModeBtn.title = "鼠标模式：文本选择";
    } else {
      // 手形拖拽图标
      iconSVG.innerHTML = `
        <path d="M9 6 L9 3 L10 3 L10 6 M11 6 L11 2 L12 2 L12 6 M13 6 L13 3 L14 3 L14 9 L14 12 C14 13.5 13 15 11 15 L8 15 C6.5 15 5 14 4 12 L4 10 L5 10 L5 12 C5.5 13 6.5 14 8 14 L11 14 C12 14 13 13 13 12 L13 9 M7 6 L7 8 L8 8 L8 6 Z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      this.#mouseModeBtn.title = "鼠标模式：拖拽浏览";
    }
  }

  #setupDragListeners() {
    if (!this.#pdfContainer) {return;}

    // 使用箭头函数绑定this，并保存引用以便后续移除
    this._handleMouseDown = this._handleMouseDown || this.#handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove || this.#handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp || this.#handleMouseUp.bind(this);

    this.#pdfContainer.addEventListener("mousedown", this._handleMouseDown);
    document.addEventListener("mousemove", this._handleMouseMove);
    document.addEventListener("mouseup", this._handleMouseUp);

    this.#logger.debug("Drag listeners added");
  }

  #removeDragListeners() {
    if (!this.#pdfContainer) {return;}

    if (this._handleMouseDown) {
      this.#pdfContainer.removeEventListener("mousedown", this._handleMouseDown);
    }
    if (this._handleMouseMove) {
      document.removeEventListener("mousemove", this._handleMouseMove);
    }
    if (this._handleMouseUp) {
      document.removeEventListener("mouseup", this._handleMouseUp);
    }

    this.#logger.debug("Drag listeners removed");
  }

  #handleMouseDown(e) {
    // Only works if in drag mode (redundant check but safe)
    if (this.#isDragging) {return;}

    this.#isDragging = true;
    this.#dragStartX = e.clientX;
    this.#dragStartY = e.clientY;
    this.#scrollStartX = this.#pdfContainer.scrollLeft;
    this.#scrollStartY = this.#pdfContainer.scrollTop;

    this.#pdfContainer.classList.add("dragging");

    e.preventDefault();
  }

  #handleMouseMove(e) {
    if (!this.#isDragging) {return;}

    const deltaX = e.clientX - this.#dragStartX;
    const deltaY = e.clientY - this.#dragStartY;

    this.#pdfContainer.scrollLeft = this.#scrollStartX - deltaX;
    this.#pdfContainer.scrollTop = this.#scrollStartY - deltaY;

    e.preventDefault();
  }

  #handleMouseUp(e) {
    if (!this.#isDragging) {return;}

    this.#isDragging = false;
    this.#pdfContainer.classList.remove("dragging");

    e.preventDefault();
  }

  destroy() {
    // 清理 EventBus 订阅（避免 destroy 后幽灵行为）
    this.#eventBusUnsubs.forEach((unsub) => unsub());
    this.#eventBusUnsubs = [];

    // 清理 DOM listener（必须在置空 DOM 引用前执行）
    this.#domCleanupFns.forEach((fn) => fn());
    this.#domCleanupFns = [];

    // Unsubscribe
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }

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
