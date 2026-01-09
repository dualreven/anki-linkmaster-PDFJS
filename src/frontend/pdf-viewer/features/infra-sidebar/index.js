/**
 * 侧边栏管理器Feature
 *
 * @description 统一管理所有侧边栏的打开/关闭、布局和宽度调整
 */

import { getLogger } from "../../../common/utils/logger.js";
import { LayoutEngine } from "./layout-engine.js";
import { validateSidebarConfig } from "./sidebar-config.js";
import { registerRealSidebars, createRealSidebarButtons } from "./real-sidebars.js";
import { PDFLayoutAdapter } from "./pdf-layout-adapter.js";
import { PDF_VIEWER_EVENTS } from "../../../common/event/pdf-viewer-constants.js";
import { SidebarManager } from "./services/sidebar.manager.js";
import { DraggableResizer } from "./draggable-resizer.js";

const logger = getLogger("SidebarManager");

export class SidebarManagerFeature {
  #eventBus;
  #container;
  #sidebarManager; // State Manager
  #layoutEngine;
  #pdfLayoutAdapter;
  #containerElement;
  #unsubscribe = null;
  #unsubs = [];
  #isInstalled = false;
  #timeouts = [];
  #resizers = new Map(); // sidebarId -> DraggableResizer
  #buttonsDisposer = null;

  get name() {
    return "infra-sidebar";
  }

  get version() {
    return "1.0.0";
  }

  get dependencies() {
    // 侧边栏 UI 在 real-sidebars.js 中统一选择 OutlineSidebarUI（无 Outline 回退）
    return ["pdf-annotation", "pdf-translator", "pdf-card"];
  }

  async install(context) {
    const { globalEventBus, container, logger } = context;

    if (this.#isInstalled) {
      logger?.warn?.("SidebarManagerFeature.install called more than once; skip");
      return;
    }
    this.#isInstalled = true;

    this.#eventBus = globalEventBus;
    this.#container = container;
    this.#sidebarManager = new SidebarManager(logger);
    this.#layoutEngine = new LayoutEngine();
    this.#pdfLayoutAdapter = new PDFLayoutAdapter(globalEventBus);

    this.#createContainer();

    // Subscribe to State Changes (Reactive View)
    this.#unsubscribe = this.#sidebarManager.store.subscribe((state, oldState) => {
      // Handle Active Sidebars Change
      if (!oldState || state.activeSidebars !== oldState.activeSidebars) {
        this.#syncDomWithState(state.activeSidebars, state.registeredSidebars);
      }
      // Handle Width Changes
      if (!oldState || state.widths !== oldState.widths) {
        // Currently syncDomWithState handles layout which uses widths.
        // If only width changes, we might want to optimize, but full sync is safe.
        // But syncDomWithState might re-create DOM?
        // No, syncDom only adds/removes. Layout uses widths.
        this.#recalculateLayout();
      }
    });

    this.#setupEventListeners();

    // 初始化PDF布局适配器
    const t1 = setTimeout(() => {
      this.#pdfLayoutAdapter.initialize();
    }, 100);
    this.#timeouts.push(t1);

    // 注册真实侧边栏（书签/大纲、批注、卡片、翻译）
    await registerRealSidebars(this, this.#eventBus, this.#container);

    // 创建侧边栏切换按钮
    const t2 = setTimeout(() => {
      const r = createRealSidebarButtons(this.#eventBus);
      this.#buttonsDisposer = r && typeof r.dispose === "function" ? r : null;
    }, 100);
    this.#timeouts.push(t2);

    // 按新规范：首次加载不自动打开任何侧边栏（避免“自动弹出”打扰首屏体验）

    logger.info("SidebarManagerFeature installed", {
      version: this.version
    });
  }

  /**
     * 卸载Feature
     */
  async uninstall() {
    if (!this.#isInstalled) {
      return;
    }
    this.#isInstalled = false;

    // 清理延迟任务（防止卸载后仍执行 initialize / button create）
    for (const t of this.#timeouts) {
      try { clearTimeout(t); } catch (e) { logger.warn("Failed to clear sidebar timer", e); }
    }
    this.#timeouts = [];

    // 清理按钮容器/按钮
    try { this.#buttonsDisposer?.dispose?.(); } catch (e) { logger.warn("Failed to dispose sidebar buttons", e); }
    this.#buttonsDisposer = null;

    // 清理 EventBus 订阅
    for (const u of this.#unsubs) {
      try { u?.(); } catch (e) { logger.warn("Failed to unsubscribe sidebar event handler", e); }
    }
    this.#unsubs = [];

    // 清理 resizers（包含“拖拽中途卸载”的 document 监听解绑）
    this.#destroyAllResizers();

    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
    this.#containerElement?.remove();
    this.#sidebarManager.destroy();
    this.#pdfLayoutAdapter?.destroy();

    this.#containerElement = null;
    this.#sidebarManager = null;
    this.#layoutEngine = null;
    this.#pdfLayoutAdapter = null;
    this.#eventBus = null;
    this.#container = null;

    logger.info("SidebarManagerFeature uninstalled");
  }

  /**
     * 注册侧边栏
     * @param {import('./sidebar-config.js').SidebarConfig} config - 侧边栏配置
     */
  registerSidebar(config) {
    if (!validateSidebarConfig(config)) {
      logger.error("Invalid sidebar config", config);
      throw new Error(`Invalid sidebar config: ${config?.id}`);
    }
    this.#sidebarManager.registerSidebar(config);
  }

  /**
     * 切换侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
  toggleSidebar(sidebarId) {
    this.#sidebarManager.toggleSidebar(sidebarId);
  }

  /**
     * 打开侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
  openSidebar(sidebarId) {
    this.#sidebarManager.openSidebar(sidebarId);
  }

  /**
     * 关闭侧边栏
     * @param {string} sidebarId - 侧边栏ID
     */
  closeSidebar(sidebarId) {
    this.#sidebarManager.closeSidebar(sidebarId);
  }

  // ==================== 私有方法 (View Logic) ====================

  /**
   * Sync DOM with Active Sidebars State
   */
  #syncDomWithState(activeSidebars, registeredSidebars) {
    // 1. Remove closed sidebars
    const currentPanels = Array.from(this.#containerElement.querySelectorAll(".sidebar-panel"));
    currentPanels.forEach(panel => {
      const id = panel.getAttribute("data-sidebar-id");
      if (!activeSidebars.includes(id)) {
        const r = this.#resizers.get(id);
        if (r) {
          try { r.destroy(); } catch (e) { logger.warn("Failed to destroy resizer on panel remove", e); }
          this.#resizers.delete(id);
        }
        panel.remove();
        // Emit Event (Legacy)
        this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSED_COMPLETED, {
          sidebarId: id,
          remainingIds: [...activeSidebars]
        }, { actorId: "SidebarManager" });
      }
    });

    // 2. Add new sidebars (maintain order based on activeSidebars array)
    activeSidebars.forEach((id, index) => {
      let panel = this.#containerElement.querySelector(`[data-sidebar-id="${id}"]`);
      if (!panel) {
        const config = registeredSidebars[id];
        if (config) {
          panel = this.#createSidebarPanel(config);
          this.#containerElement.appendChild(panel); // Just append, layout engine handles position?
          // Wait, layout engine uses absolute positioning?
          // Let's check layout-engine.js logic.
          // Usually LayoutEngine calculates position based on order.
          // If we append, order in DOM matches?
          // `LayoutEngine.applyLayout` usually sets style.

          // Emit Event (Legacy)
          this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPENED_COMPLETED, {
            sidebarId: id,
            order: index + 1
          }, { actorId: "SidebarManager" });
        }
      }
    });

    // 3. Recalculate Layout
    this.#recalculateLayout();
  }

  /**
     * 创建统一容器
     */
  #createContainer() {
    this.#containerElement = document.createElement("div");
    this.#containerElement.id = "unified-sidebar-container";
    this.#containerElement.className = "unified-sidebar-container";
    document.body.appendChild(this.#containerElement);

    logger.debug("Sidebar container created");
  }

  /**
     * 创建侧边栏面板
     * @param {import('./sidebar-config.js').SidebarConfig} config - 侧边栏配置
     * @returns {HTMLElement} 侧边栏面板元素
     */
  #createSidebarPanel(config) {
    const panel = document.createElement("div");
    panel.className = "sidebar-panel";
    panel.setAttribute("data-sidebar-id", config.id);

    // 创建头部
    const header = document.createElement("div");
    header.className = "sidebar-header";

    const title = document.createElement("h3");
    title.className = "sidebar-title";
    title.textContent = config.title;

    const actions = document.createElement("div");
    actions.className = "sidebar-header-actions";
    actions.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:4px"
    ].join(";");

    const closeBtn = document.createElement("button");
    closeBtn.className = "sidebar-close-btn";
    closeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        `;
    closeBtn.setAttribute("aria-label", "关闭侧边栏");
    closeBtn.addEventListener("click", () => {
      this.closeSidebar(config.id);
    });

    if (typeof config.createHeaderExtraActions === "function") {
      const extra = config.createHeaderExtraActions();
      if (extra instanceof HTMLElement) {
        actions.appendChild(extra);
      }
    }

    actions.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(actions);

    // 创建内容区
    const content = document.createElement("div");
    content.className = "sidebar-content";
    try {
      const renderedContent = config.contentRenderer();
      content.appendChild(renderedContent);
    } catch (error) {
      logger.error(`Failed to render sidebar content: ${config.id}`, error);
      content.innerHTML = "<p>内容加载失败</p>";
    }

    panel.appendChild(header);
    panel.appendChild(content);

    // 创建调整分隔条
    if (config.resizable) {
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "sidebar-resize-handle";
      resizeHandle.setAttribute("data-sidebar-id", config.id);
      panel.appendChild(resizeHandle);

      const existed = this.#resizers.get(config.id);
      if (existed) {
        try { existed.destroy(); } catch (e) { logger.warn("Failed to destroy existing resizer", e); }
        this.#resizers.delete(config.id);
      }

      const resizer = new DraggableResizer({
        handle: resizeHandle,
        getWidth: () => panel.offsetWidth,
        onWidth: (newWidth) => {
          this.#sidebarManager.setWidth(config.id, newWidth);
        },
        minWidth: config.minWidth ?? null,
        maxWidth: config.maxWidth ?? null,
      });
      this.#resizers.set(config.id, resizer);
    }

    return panel;
  }

  #destroyAllResizers() {
    for (const [, r] of this.#resizers.entries()) {
      try { r?.destroy?.(); } catch (e) { logger.warn("Failed to destroy resizer", e); }
    }
    this.#resizers.clear();
  }

  /**
     * 重新计算布局
     */
  #recalculateLayout() {
    const containerWidth = this.#containerElement.offsetWidth || 1200; // 默认宽度
    const { activeSidebars, widths } = this.#sidebarManager.store.get();

    if (activeSidebars.length === 0) {
      // 没有侧边栏时，通知PDF容器恢复全宽
      this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, {
        totalWidth: 0
      }, { actorId: "SidebarManager" });
      return;
    }

    // Convert observable object to Map if needed by layout engine, or just use object
    // LayoutEngine.calculateLayoutWithCustomWidths expects Map?
    // Let's verify LayoutEngine.
    const widthMap = new Map(Object.entries(widths));

    const layouts = this.#layoutEngine.calculateLayoutWithCustomWidths(
      activeSidebars,
      widthMap,
      containerWidth
    );

    this.#layoutEngine.applyLayout(layouts, this.#containerElement);

    // 计算侧边栏总宽度
    const totalWidth = layouts.reduce((sum, layout) => sum + layout.width, 0);

    // 通知PDF容器调整布局
    this.#eventBus.emit(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.LAYOUT_UPDATED, {
      totalWidth,
      layouts
    }, { actorId: "SidebarManager" });

    logger.debug("Layout recalculated", {
      openCount: activeSidebars.length,
      containerWidth,
      totalWidth,
      layouts
    });
  }

  /**
     * 设置事件监听器
     */
  #setupEventListeners() {
    const unsubToggle = this.#eventBus.on(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.TOGGLE_REQUESTED, ({ sidebarId }) => {
      try {
        logger.info(`[EventListener] Received toggle request for: ${sidebarId}`);
        this.toggleSidebar(sidebarId);
      } catch (error) {
        logger.error("[EventListener] Toggle failed:", error);
      }
    }, { subscriberId: "SidebarManager" });

    const unsubOpen = this.#eventBus.on(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.OPEN_REQUESTED, ({ sidebarId }) => {
      try {
        logger.info(`[EventListener] Received open request for: ${sidebarId}`);
        this.openSidebar(sidebarId);
      } catch (error) {
        logger.error("[EventListener] Open failed:", error);
      }
    }, { subscriberId: "SidebarManager" });

    const unsubClose = this.#eventBus.on(PDF_VIEWER_EVENTS.SIDEBAR_MANAGER.CLOSE_REQUESTED, ({ sidebarId }) => {
      try {
        logger.info(`[EventListener] Received close request for: ${sidebarId}`);
        this.closeSidebar(sidebarId);
      } catch (error) {
        logger.error("[EventListener] Close failed:", error);
      }
    }, { subscriberId: "SidebarManager" });

    this.#unsubs.push(unsubToggle, unsubOpen, unsubClose);
    logger.info("Event listeners setup completed");
  }

}
