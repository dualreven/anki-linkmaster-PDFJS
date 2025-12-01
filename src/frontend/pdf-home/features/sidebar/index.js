/**
 * Sidebar Feature - 侧边栏容器插件
 * 负责侧边栏整体布局和收起/展开功能
 * 三个子功能（最近搜索、最近阅读、最近添加）作为独立插件管理
 */

import { SidebarFeatureConfig } from "./feature.config.js";
import { SidebarContainer } from "./components/sidebar-container.js";
import "./styles/sidebar.css";
// 当前位置：src/frontend/pdf-home/features/sidebar/
// 事件常量位于：src/frontend/common/event/event-constants.js
// 需要回溯三级目录（../../../）
import { SIDEBAR_EVENTS } from "../../../common/event/event-constants.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";

export class SidebarFeature {
  name = SidebarFeatureConfig.name;
  version = SidebarFeatureConfig.version;
  dependencies = [];

  #logger = null;
  #scopedEventBus = null;
  #subscriptionBag = null;

  // 侧边栏容器组件
  #sidebarContainer = null;

  /**
   * 安装Feature
   */
  async install(context) {
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;

    this.#subscriptionBag = createSubscriptionBag({ loggerName: "SidebarFeature.Subscriptions" });

    this.#logger.info("[SidebarFeature] Installing...");

    try {
      // 1. 渲染侧边栏容器
      this.#renderSidebar();

      // 2. 恢复收起状态
      this.#restoreCollapsedState();

      // 3. 监听收起/展开事件
      this.#setupEventListeners();

      this.#logger.info("[SidebarFeature] Installed successfully");
    } catch (error) {
      this.#logger.error("[SidebarFeature] Installation failed", error);
      throw error;
    }
  }

  /**
   * 渲染侧边栏
   * @private
   */
  #renderSidebar() {
    const container = document.getElementById("sidebar");
    if (!container) {
      this.#logger.warn("[SidebarFeature] Sidebar container not found");
      return;
    }

    this.#sidebarContainer = new SidebarContainer(this.#logger, this.#scopedEventBus);
    this.#sidebarContainer.render(container);

    this.#logger.info("[SidebarFeature] Sidebar rendered");
    // 通知全局：侧边栏已渲染完成，子功能可安全读取 DOM
    try {
      this.#scopedEventBus.emitGlobal(SIDEBAR_EVENTS.RENDER.COMPLETED, { ready: true });
    } catch (e) {
      // logger-guard
      void e;
    }
  }

  /**
   * 设置事件监听
   * @private
   */
  #setupEventListeners() {
    // 监听收起/展开事件
    const unsubToggled = this.#scopedEventBus.on(SIDEBAR_EVENTS.TOGGLE.COMPLETED, (data) => {
      this.#logger.info("[SidebarFeature] Sidebar toggle completed:", data.collapsed);
      this.#saveCollapsedState(data.collapsed);
    });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubToggled);
    }

    this.#logger.info("[SidebarFeature] Event listeners setup");
  }

  /**
   * 保存收起状态到localStorage
   * @private
   */
  #saveCollapsedState(collapsed) {
    try {
      localStorage.setItem("pdf-home:sidebar-collapsed", JSON.stringify(collapsed));
      this.#logger.debug("[SidebarFeature] Collapsed state saved:", collapsed);
    } catch (error) {
      this.#logger.error("[SidebarFeature] Failed to save collapsed state", error);
    }
  }

  /**
   * 从localStorage恢复收起状态
   * @private
   */
  #restoreCollapsedState() {
    try {
      const collapsedData = localStorage.getItem("pdf-home:sidebar-collapsed");
      if (collapsedData) {
        const isCollapsed = JSON.parse(collapsedData);
        if (isCollapsed) {
          const sidebar = document.getElementById("sidebar");
          const toggleBtn = document.getElementById("sidebar-toggle-btn");
          if (sidebar) {
            sidebar.classList.add("collapsed");
          }
          if (toggleBtn) {
            toggleBtn.classList.add("collapsed");
            toggleBtn.innerHTML = "▶";
            toggleBtn.title = "展开侧边栏";
          }
          this.#logger.info("[SidebarFeature] Collapsed state restored");
        }
      }
    } catch (error) {
      this.#logger.error("[SidebarFeature] Failed to restore collapsed state", error);
    }
  }

  /**
   * 卸载Feature
   */
  async uninstall() {
    this.#logger.info("[SidebarFeature] Uninstalling...");

    // 取消事件订阅
    if (this.#subscriptionBag) {
      this.#subscriptionBag.clear();
      this.#subscriptionBag = null;
    }

    // 销毁组件
    if (this.#sidebarContainer) {
      this.#sidebarContainer.destroy();
      this.#sidebarContainer = null;
    }

    this.#logger.info("[SidebarFeature] Uninstalled");
  }
}

export default SidebarFeature;

