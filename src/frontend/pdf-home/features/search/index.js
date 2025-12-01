/**
 * Search Feature - PDF搜索功能插件
 * 面向用户的搜索起点，提供搜索框UI和基础搜索逻辑
 */

import { SearchBar } from "./components/search-bar.js";
import { SearchManager } from "./services/search-manager.js";

// 导入样式
import "./styles/search-bar.css";
import "./styles/search-panel.css";
import { showInfoWithId, dismissById } from "../../../common/utils/notification.js";
import { SEARCH_EVENTS, FILTER_EVENTS } from "../../../common/event/event-constants.js";
import { setupGlobalSearchShortcut } from "../../../common/features/search-shortcut/index.js";
import { createSubscriptionBag } from "../../../common/event/subscription-bag.js";

export class SearchFeature {
  name = "search";
  version = "1.0.0";
  dependencies = [];  // 不需要 wsClient，使用 EventBus 通信

  #logger = null;
  #scopedEventBus = null;  // 内部事件总线（带@search/前缀）
  #globalEventBus = null;  // 全局事件总线（跨Feature通信）
  #searchBar = null;
  #searchPanel = null;
  #searchManager = null;  // 搜索管理器
  #subscriptionBag = null;
  #shortcutDisposer = null;

  /**
   * 安装插件
   */
  async install(context) {
    this.#logger = context.logger;
    this.#scopedEventBus = context.scopedEventBus;
    this.#globalEventBus = context.globalEventBus;
    const sidBase = `se-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

    this.#logger.info("[SearchFeature] Installing...");

    // 初始化订阅袋，用于统一管理事件取消订阅函数
    this.#subscriptionBag = createSubscriptionBag({ loggerName: "SearchFeature.Subscriptions" });

    try {
      // 1. 创建搜索面板DOM
      this.#createSearchPanel();
      this.#logger.info("[SearchFeature] Step1: Search panel created");

      // 2. 初始化SearchBar组件（使用scopedEventBus用于内部事件）
      this.#searchBar = new SearchBar(this.#logger, this.#scopedEventBus);
      this.#searchBar.render(this.#searchPanel.querySelector(".search-panel-content"));
      this.#logger.info("[SearchFeature] Step2: SearchBar rendered");

      // 3. 创建 SearchManager（使用全局 EventBus）
      this.#searchManager = new SearchManager(this.#globalEventBus);

      // 4. 注册 SearchManager 到容器（可选，供其他 Feature 使用）
      try {
        if (typeof context.container?.has === "function" && !context.container.has("searchManager")) {
          context.container.register("searchManager", this.#searchManager);
          this.#logger.info("[SearchFeature] Step3: searchManager registered in container");
        } else {
          this.#logger.warn("[SearchFeature] searchManager already registered in container, reusing existing");
        }
      } catch (e) {
        // 避免重复注册导致安装失败，记录并继续
        this.#logger.warn("[SearchFeature] Register searchManager failed (will continue)", e);
      }

      // 5. 监听内部事件，转发到全局EventBus
      this.#setupEventBridge(sidBase);
      this.#logger.info("[SearchFeature] Step4: Event bridge set up");

      // 6. 监听全局事件（搜索结果更新）
      this.#setupGlobalEventListeners(sidBase);
      this.#logger.info("[SearchFeature] Step5: Global listeners set up");

      // 7. 安装全局搜索快捷键（Ctrl/Cmd+F 聚焦顶部搜索框）
      this.#shortcutDisposer = setupGlobalSearchShortcut({
        logger: this.#logger,
        actorId: "PDFHomeSearchFeature:GlobalShortcut",
        onOpen: () => {
          try {
            this.#searchBar?.focus();
          } catch (e) {
            this.#logger?.warn?.("[SearchFeature] Failed to focus search bar on shortcut", e);
          }
        }
      });

      this.#logger.info("[SearchFeature] Installed successfully");
    } catch (error) {
      try { this.#logger.error("[SearchFeature] Installation failed (stack)", error?.stack || "(no stack)"); } catch (e) { void e; /* logger-guard */ }
      try { this.#logger.error("[SearchFeature] Installation failed (message)", error?.message || String(error)); } catch (e) { void e; /* logger-guard */ }
      try { this.#logger.error("[SearchFeature] Installation failed (object)", error); } catch (e) { void e; /* logger-guard */ }
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async uninstall() {
    this.#logger.info("[SearchFeature] Uninstalling...");

    // 取消所有事件订阅
    if (this.#subscriptionBag) {
      this.#subscriptionBag.clear();
      this.#subscriptionBag = null;
    }

    // 取消全局快捷键
    if (typeof this.#shortcutDisposer === "function") {
      try { this.#shortcutDisposer(); } catch (e) { void e; /* logger-guard */ }
    }
    this.#shortcutDisposer = null;

    // 销毁 SearchManager
    if (this.#searchManager) {
      this.#searchManager.destroy();
      this.#searchManager = null;
    }

    // 销毁组件
    if (this.#searchBar) {
      this.#searchBar.destroy();
      this.#searchBar = null;
    }

    // 移除DOM
    if (this.#searchPanel) {
      this.#searchPanel.remove();
      this.#searchPanel = null;
    }

    this.#logger.info("[SearchFeature] Uninstalled");
  }

  /**
   * 创建搜索面板DOM
   * @private
   */
  #createSearchPanel() {
    this.#searchPanel = document.createElement("div");
    this.#searchPanel.className = "search-panel active";
    this.#searchPanel.innerHTML = `
      <div class="search-panel-content">
        <!-- SearchBar组件将在这里渲染 -->
      </div>
    `;

    // 优先挂载到主内容区域上方，避免遮挡 HTML 标题栏
    const mainContent = document.querySelector(".main-content");
    if (mainContent && mainContent.firstChild) {
      mainContent.insertBefore(this.#searchPanel, mainContent.firstChild);
      this.#logger?.debug?.("[SearchFeature] Search panel mounted into .main-content as first child");
      return;
    }

    // 退化方案：挂到 app-root 内部（仍然不盖住自定义标题栏）
    const appRoot = document.querySelector(".app-root");
    if (appRoot) {
      appRoot.insertBefore(this.#searchPanel, appRoot.firstChild);
      this.#logger?.debug?.("[SearchFeature] Search panel mounted into .app-root (fallback)");
      return;
    }

    // 最保守兜底：仍然插入到 body 顶部（旧行为），但仅在找不到布局容器时使用
    document.body.insertBefore(this.#searchPanel, document.body.firstChild);
    this.#logger?.warn?.("[SearchFeature] .main-content/.app-root not found, mounted search panel into <body> (legacy fallback)");
  }

  /**
   * 设置事件桥接（内部事件 -> 全局事件）
   * @param {string} sidBase - 订阅者ID基础字符串
   * @private
   */
  #setupEventBridge(sidBase) {
    // 搜索请求 -> 转发到全局
    const unsubSearch = this.#scopedEventBus.on(SEARCH_EVENTS.QUERY.REQUESTED, (data) => {
      this.#logger.info("[SearchFeature] Forwarding search query to global", data);
      this.#globalEventBus.emit(SEARCH_EVENTS.QUERY.REQUESTED, data);
    }, { subscriberId: `${this.name}:${sidBase}:forward-search-query` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubSearch);
    }

    // 清除请求 -> 转发到全局
    const unsubClear = this.#scopedEventBus.on(SEARCH_EVENTS.QUERY.CLEARED, () => {
      this.#logger.info("[SearchFeature] Forwarding clear request to global");
      this.#globalEventBus.emit(SEARCH_EVENTS.QUERY.CLEARED);
    }, { subscriberId: `${this.name}:${sidBase}:forward-clear` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubClear);
    }

    // 添加按钮点击 -> 转发到全局
    const unsubAdd = this.#scopedEventBus.on(SEARCH_EVENTS.ACTIONS.ADD_REQUESTED, () => {
      this.#logger.info("[SearchFeature] Forwarding add request to global");
      this.#globalEventBus.emit(SEARCH_EVENTS.ACTIONS.ADD_REQUESTED);
    }, { subscriberId: `${this.name}:${sidBase}:forward-add` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubAdd);
    }

    // 排序按钮点击 -> 转发到全局
    const unsubSort = this.#scopedEventBus.on(SEARCH_EVENTS.ACTIONS.SORT_REQUESTED, () => {
      this.#logger.info("[SearchFeature] Forwarding sort request to global");
      this.#globalEventBus.emit(SEARCH_EVENTS.ACTIONS.SORT_REQUESTED);
    }, { subscriberId: `${this.name}:${sidBase}:forward-sort` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubSort);
    }

    // 高级筛选按钮点击 -> 转发到全局
    const unsubAdvanced = this.#scopedEventBus.on(FILTER_EVENTS.ADVANCED.OPEN, () => {
      this.#logger.info("[SearchFeature] Forwarding advanced click to global");
      this.#globalEventBus.emit(FILTER_EVENTS.ADVANCED.OPEN);
    }, { subscriberId: `${this.name}:${sidBase}:forward-advanced` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubAdvanced);
    }

    // 保存预设 -> 转发到全局
    const unsubPreset = this.#scopedEventBus.on(FILTER_EVENTS.PRESET.SAVE, (data) => {
      this.#logger.info("[SearchFeature] Forwarding preset save to global", data);
      this.#globalEventBus.emit(FILTER_EVENTS.PRESET.SAVE, data);
    }, { subscriberId: `${this.name}:${sidBase}:forward-preset-save` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubPreset);
    }
  }

  /**
   * 监听全局事件
   * @param {string} sidBase - 订阅者ID基础字符串
   * @private
   */
  #setupGlobalEventListeners(sidBase) {
    // 搜索开始：显示"搜索中"
    const unsubStarted = this.#globalEventBus.on(SEARCH_EVENTS.QUERY.STARTED, () => {
      try {
        // 用户偏好：非粘性 3000ms
        showInfoWithId("search:busy", "搜索中", 3000);
      } catch (e) {
        this.#logger?.warn("[SearchFeature] showInfoWithId failed", e);
      }
    }, { subscriberId: `${this.name}:${sidBase}:search-query-started` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubStarted);
    }

    // 监听搜索结果更新
    const unsubResults = this.#globalEventBus.on(SEARCH_EVENTS.RESULTS.UPDATED, (data) => {
      this.#logger.debug("[SearchFeature] Search results updated", data);

      if (this.#searchBar) {
        this.#searchBar.updateStats({
          count: data.count || 0,
          hasResults: data.count > 0
        });
      }
      try { dismissById("search:busy"); } catch { /* ignore dismiss errors */ }
    }, { subscriberId: `${this.name}:${sidBase}:search-results-updated` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubResults);
    }

    // 搜索失败：隐藏进行中的提示
    const unsubFailed = this.#globalEventBus.on(SEARCH_EVENTS.RESULTS.FAILED, () => {
      try { dismissById("search:busy"); } catch { /* ignore dismiss errors */ }
    }, { subscriberId: `${this.name}:${sidBase}:search-results-failed` });
    if (this.#subscriptionBag) {
      this.#subscriptionBag.add(unsubFailed);
    }
  }
}

