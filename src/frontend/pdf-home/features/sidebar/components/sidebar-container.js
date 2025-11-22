// 位于 src/frontend/pdf-home/features/sidebar/components/
// 需回溯四级目录至 src/frontend/common/event/
import { SIDEBAR_EVENTS } from "../../../../common/event/event-constants.js";
/**
 * 侧边栏容器组件
 * 负责侧边栏的整体布局和收起/展开功能
 */

export class SidebarContainer {
  #logger = null;
  #eventBus = null;
  #container = null;
  #resizeHandler = null;
  #lastLayoutState = null; // 缓存上次的布局状态，避免重复调整

  constructor(logger, eventBus) {
    this.#logger = logger;
    this.#eventBus = eventBus;
  }

  /**
   * 渲染侧边栏容器
   * @param {HTMLElement} container - 容器元素
   */
  render(container) {
    this.#container = container;

    // 创建侧边栏面板结构
    this.#container.innerHTML = `
      <div class="sidebar-panel">
        <!-- 最近搜索区域 -->
        <div class="sidebar-section" id="recent-searches-section">
          <h3 class="sidebar-section-title">
            <span>🔍 最近搜索</span>
          </h3>
          <ul class="sidebar-list" id="recent-searches-list">
            <li class="sidebar-empty">暂无搜索记录</li>
          </ul>
        </div>

        <!-- 最近阅读区域 -->
        <div class="sidebar-section" id="recent-opened-section">
          <h3 class="sidebar-section-title">
            <span>📖 最近阅读</span>
          </h3>
          <ul class="sidebar-list" id="recent-opened-list">
            <li class="sidebar-empty">暂无阅读记录</li>
          </ul>
        </div>

        <!-- 最近添加区域 -->
        <div class="sidebar-section" id="recent-added-section">
          <h3 class="sidebar-section-title">
            <span>➕ 最近添加</span>
          </h3>
          <ul class="sidebar-list" id="recent-added-list">
            <li class="sidebar-empty">暂无添加记录</li>
          </ul>
        </div>
      </div>
    `;

    // 创建收起/展开按钮
    this.#createToggleButton();

    // 监听窗口大小变化，动态调整布局（先设置监听器）
    this.#setupResizeHandler();

    // 根据当前状态应用主内容布局（延迟执行，确保DOM已渲染）
    setTimeout(() => {
      const isCollapsed = this.#container.classList.contains("collapsed");
      this.#updateMainContentLayout(isCollapsed);
    }, 0);

    this.#logger.info("[SidebarContainer] Rendered");
  }

  /**
   * 创建收起/展开按钮
   * @private
   */
  #createToggleButton() {
    // 检查按钮是否已存在
    if (document.getElementById("sidebar-toggle-btn")) {
      return;
    }

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "sidebar-toggle-btn";
    toggleBtn.className = "sidebar-toggle-btn";
    toggleBtn.innerHTML = "◀";
    toggleBtn.title = "收起侧边栏";

    // 添加到body（fixed定位）
    document.body.appendChild(toggleBtn);

    // 绑定点击事件
    toggleBtn.addEventListener("click", () => {
      const sidebar = document.getElementById("sidebar");
      const isCollapsed = sidebar.classList.contains("collapsed");

      if (isCollapsed) {
        sidebar.classList.remove("collapsed");
        toggleBtn.innerHTML = "◀";
        toggleBtn.title = "收起侧边栏";
        toggleBtn.classList.remove("collapsed");
        // 展开：推开右侧内容，避免遮挡搜索结果
        this.#updateMainContentLayout(false);
        this.#eventBus.emit(SIDEBAR_EVENTS.TOGGLE.COMPLETED, { collapsed: false });
      } else {
        sidebar.classList.add("collapsed");
        toggleBtn.innerHTML = "▶";
        toggleBtn.title = "展开侧边栏";
        toggleBtn.classList.add("collapsed");
        // 收起：恢复右侧内容布局
        this.#updateMainContentLayout(true);
        this.#eventBus.emit(SIDEBAR_EVENTS.TOGGLE.COMPLETED, { collapsed: true });
      }
    });

    this.#logger.info("[SidebarContainer] Toggle button created");
  }

  /**
   * 根据侧边栏折叠状态，更新主内容区域布局，避免遮挡
   * 桌面场景下：侧边栏展开时始终为主内容预留 280px 宽度
   * @param {boolean} collapsed - 是否处于折叠状态
   * @private
   */
  #updateMainContentLayout(collapsed) {
    try {
      const main = document.querySelector(".main-content");
      const sidebar = document.getElementById("sidebar");
      if (!main || !sidebar) {return;}

      // 检查是否需要更新（避免重复设置相同样式）
      const layoutStateKey = collapsed ? "collapsed" : "expanded";
      if (this.#lastLayoutState === layoutStateKey) {
        return; // 状态未变化，跳过
      }
      this.#lastLayoutState = layoutStateKey;

      // 应用布局调整
      if (!collapsed) {
        // 展开侧边栏：为其预留固定宽度
        main.style.marginLeft = "280px";
        main.style.width = "calc(100% - 280px)";
        this.#logger.debug("[SidebarContainer] Layout adjusted: content pushed (expanded)");
      } else {
        // 收起侧边栏：主内容占满可用空间
        main.style.marginLeft = "";
        main.style.width = "";
        this.#logger.debug("[SidebarContainer] Layout adjusted: content restored (collapsed)");
      }
    } catch (error) {
      this.#logger.warn("[SidebarContainer] Layout update failed", error);
    }
  }

  /**
   * 监听窗口大小变化，动态调整布局
   * @private
   */
  #setupResizeHandler() {
    try {
      // 防抖处理，避免频繁触发
      let resizeTimer = null;
      this.#resizeHandler = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const sidebar = document.getElementById("sidebar");
          if (!sidebar) {return;}

          const isCollapsed = sidebar.classList.contains("collapsed");
          this.#updateMainContentLayout(isCollapsed);
        }, 150); // 150ms 防抖
      };

      window.addEventListener("resize", this.#resizeHandler);
      this.#logger.info("[SidebarContainer] Window resize handler setup completed");
    } catch (error) {
      this.#logger.warn("[SidebarContainer] Failed to setup resize handler", error);
    }
  }

  /**
   * 销毁组件
   */
  destroy() {
    // 移除窗口 resize 监听器
    if (this.#resizeHandler) {
      window.removeEventListener("resize", this.#resizeHandler);
      this.#resizeHandler = null;
    }

    // 移除toggle按钮
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (toggleBtn) {
      toggleBtn.remove();
    }

    if (this.#container) {
      this.#container.innerHTML = "";
    }

    // 清除缓存状态
    this.#lastLayoutState = null;

    this.#logger.info("[SidebarContainer] Destroyed");
  }
}
